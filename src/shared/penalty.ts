// Разбор санкций статей УК и КоАП: «наказывается лишением свободы на срок семи лет
// (СПРП «★★★★»)», «влечет наложение административного штрафа в размере от десяти
// тысяч (10.000) до двадцати тысяч (20.000) рублей» и т. п.
import type { LawArticle } from './laws'

export interface Range {
  min: number
  max: number
  /** «до N» — нижняя граница не указана */
  upTo?: boolean
}

export interface Penalty {
  fine?: Range
  arrestDays?: Range
  prisonYears?: Range
  /** Уровень розыска по СПРП (число звёзд) */
  stars?: number
  /** Прочее: лишение прав, конфискация, предупреждение, оклады госслужащим */
  extras: string[]
  /** Исходный текст санкции */
  raw: string
}

export interface ArticlePart {
  /** Номер части ("1", "2") или null, если статья не делится на части */
  part: string | null
  /** Описание деяния без санкции */
  text: string
  penalty: Penalty | null
}

// Длинные основы раньше коротких: «четырнадцат» проверяется до «четыр»
const NUMBER_STEMS: [string, number][] = [
  ['одиннадцат', 11],
  ['двенадцат', 12],
  ['тринадцат', 13],
  ['четырнадцат', 14],
  ['пятнадцат', 15],
  ['шестнадцат', 16],
  ['семнадцат', 17],
  ['восемнадцат', 18],
  ['девятнадцат', 19],
  ['двадцат', 20],
  ['тридцат', 30],
  ['один', 1],
  ['одн', 1],
  ['дв', 2],
  ['тр', 3],
  ['четыр', 4],
  ['пят', 5],
  ['шест', 6],
  ['сем', 7],
  ['восем', 8],
  ['восьм', 8],
  ['девят', 9],
  ['десят', 10]
]

const SKIP_WORDS = new Set(['от', 'до', 'в', 'на', 'срок', 'размере', 'размер'])

function wordToNumber(word: string): number | null {
  const w = word.toLowerCase().replace(/ё/g, 'е')
  if (/^\d+$/.test(w)) return Number(w)
  for (const [stem, n] of NUMBER_STEMS) if (w.startsWith(stem)) return n
  return null
}

/** «от двух до пяти», «семи», «в два», «(14)» → числа по порядку */
function numbersIn(chunk: string): number[] {
  const digits = [...chunk.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]))
  if (digits.length) return digits
  return chunk
    .split(/[\s,]+/)
    .filter((w) => w && !SKIP_WORDS.has(w.toLowerCase()))
    .map(wordToNumber)
    .filter((n): n is number => n !== null)
}

function toRange(nums: number[], chunk: string): Range | undefined {
  if (nums.length === 0) return undefined
  const upTo = /(^|\s)до\s/i.test(chunk) && !/(^|\s)от\s/i.test(chunk)
  return { min: Math.min(...nums), max: Math.max(...nums), upTo: upTo || undefined }
}

function parseMoney(s: string): number {
  return Number(s.replace(/[.\s]/g, ''))
}

/** Санкция одной части статьи → структура. null, если санкции нет. */
export function parsePenalty(text: string): Penalty | null {
  const at = text.search(/наказыва|влеч[её]т/i)
  if (at < 0) return null
  const raw = text.slice(at).replace(/\s+/g, ' ').trim()
  const p: Penalty = { extras: [], raw }

  const prison = /лишени\p{L}*\s+свободы\s+(?:на\s+срок\s+)?(.{0,40}?)\s(?:лет|года|год)(?![\p{L}])/iu.exec(raw)
  if (prison) p.prisonYears = toRange(numbersIn(prison[1]), prison[1])

  const arrest = /арест\p{L}*\s+на\s+срок\s+(.{0,40}?)\s?сут/iu.exec(raw)
  if (arrest) p.arrestDays = toRange(numbersIn(arrest[1]), arrest[1])

  const fineAt = raw.search(/штраф/i)
  if (fineAt >= 0) {
    const end = raw.indexOf('рубл', fineAt)
    const chunk = raw.slice(fineAt, end > 0 ? end : fineAt + 200)
    const sums = [...chunk.matchAll(/\((\d[\d.\s]*\d|\d)\)/g)].map((m) => parseMoney(m[1]))
    if (sums.length) p.fine = { min: Math.min(...sums), max: Math.max(...sums) }
  }

  const stars = /СПРП\s*[«"]?\s*(★+)/.exec(raw)
  if (stars) p.stars = stars[1].length

  if (/оклад/i.test(raw)) {
    const n = numbersIn(/(\S+)\s+оклад/i.exec(raw)?.[1] ?? '')
    p.extras.push(n.length ? `госслужащим ${n[0]} окл.` : 'оклады госслужащим')
  }
  if (/лишени\p{L}*\s+права/iu.test(raw)) p.extras.push('лишение прав')
  if (/конфискац/i.test(raw)) p.extras.push('конфискация')
  if (/предупреждени/i.test(raw)) p.extras.push('предупреждение')

  return p
}

function plural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return one
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few
  return many
}

export function formatMoney(n: number): string {
  return n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽'
}

function formatRange(r: Range, unit: (n: number) => string): string {
  if (r.min === r.max) return `${r.upTo ? 'до ' : ''}${r.max} ${unit(r.max)}`
  return `от ${r.min} до ${r.max} ${unit(r.max)}`
}

export const yearsWord = (n: number) => plural(n, 'год', 'года', 'лет')

/** Короткая строка для памятки: «Штраф 30 000 ₽ или 3 года» */
export function formatPenalty(p: Penalty): string {
  const parts: string[] = []
  if (p.fine) {
    parts.push(
      p.fine.min === p.fine.max
        ? `штраф ${formatMoney(p.fine.max)}`
        : `штраф ${formatMoney(p.fine.min).replace(' ₽', '')}–${formatMoney(p.fine.max)}`
    )
  }
  if (p.arrestDays) parts.push(`арест ${formatRange(p.arrestDays, () => 'сут.')}`)
  if (p.prisonYears) parts.push(formatRange(p.prisonYears, yearsWord))
  let text = parts.join(' или ')
  const extras = p.extras.filter((e) => !(e === 'предупреждение' && parts.length))
  if (extras.length) text += (text ? '; ' : '') + extras.join(', ')
  if (!text) text = p.raw.replace(/^(наказыва\p{L}*|влеч[её]т)\s*/iu, '').replace(/\(СПРП.*$/, '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Делит статью на части («37.1.», «87.1», «9.45.1.») и разбирает санкцию каждой */
export function splitParts(article: LawArticle): ArticlePart[] {
  const partRe = new RegExp(`^${escapeRe(article.number)}\\.(\\d+)\\.?\\s*`)
  const groups: { part: string | null; paras: string[] }[] = []
  let current: { part: string | null; paras: string[] } = { part: null, paras: [] }

  // Примечание бывает и между частями (ст. 63 УК: после ч. 2 идут ч. 3 и 4) —
  // пропускаем его до следующей части, а не до конца статьи
  let inNote = false
  for (const para of article.paragraphs) {
    const m = partRe.exec(para)
    if (m) {
      inNote = false
      if (current.paras.length || current.part) groups.push(current)
      current = { part: m[1], paras: [para.slice(m[0].length)] }
    } else if (/^примечани/i.test(para)) {
      inNote = true
    } else if (!inNote) {
      current.paras.push(para)
    }
  }
  groups.push(current)

  const hasParts = groups.some((g) => g.part)
  return groups
    .filter((g) => !hasParts || g.part)
    .map((g) => {
      const text = g.paras.join('\n')
      const at = text.search(/наказыва|влеч[её]т/i)
      return {
        part: g.part,
        text: (at >= 0 ? text.slice(0, at) : text).replace(/[\s,–—-]+$/, '').trim(),
        penalty: parsePenalty(text)
      }
    })
}
