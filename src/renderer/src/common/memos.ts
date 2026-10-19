// Памятки: УК и КоАП собираются из текста закона (санкции разбираются автоматически),
// остальные законы — короткие пересказы из shared/memos.ts.
import { LAW_SOURCES, type LawDoc, type LawId } from '../../../shared/laws'
import { CURATED_MEMOS } from '../../../shared/memos'
import { formatMoney, formatPenalty, splitParts, yearsWord, type Penalty } from '../../../shared/penalty'
import { formatCalcArticles } from '../../../shared/settings'
import { normalize } from './ui'

export interface MemoPart {
  /** Ключ для калькулятора: "uk:37:2", "koap:8.7:" */
  key: string
  part: string | null
  text: string
  penalty: Penalty
  summary: string
}

export interface MemoItem {
  /** "uk:44" — ключ для избранного */
  key: string
  law: LawId
  number: string
  title: string
  /** Решение принимает суд («определяется судом») */
  court: boolean
  parts: MemoPart[]
  points: string[]
  haystack: string
}

const COURT_RE = /\s*\(определяется судом\)/i

export function buildMemos(docs: Partial<Record<LawId, LawDoc>>): MemoItem[] {
  const out: MemoItem[] = []
  for (const src of LAW_SOURCES) {
    if (src.id === 'uk' || src.id === 'koap') {
      const doc = docs[src.id]
      if (!doc) continue
      for (const a of doc.articles) {
        if (a.repealed) continue
        const parts = splitParts(a).filter((p): p is typeof p & { penalty: Penalty } => p.penalty !== null)
        if (parts.length === 0) continue
        const title = a.title.replace(COURT_RE, '')
        out.push({
          key: `${src.id}:${a.number}`,
          law: src.id,
          number: a.number,
          title,
          court: COURT_RE.test(a.title),
          parts: parts.map((p) => ({
            key: `${src.id}:${a.number}:${p.part ?? ''}`,
            part: p.part,
            text: p.text,
            penalty: p.penalty,
            summary: formatPenalty(p.penalty)
          })),
          points: [],
          haystack: normalize(`${title} ${parts.map((p) => p.text).join(' ')}`)
        })
      }
    } else {
      for (const m of CURATED_MEMOS.filter((c) => c.law === src.id)) {
        out.push({
          key: `${m.law}:${m.number}`,
          law: m.law,
          number: m.number,
          title: m.title,
          court: false,
          parts: [],
          points: m.points,
          haystack: normalize(`${m.title} ${m.points.join(' ')}`)
        })
      }
    }
  }
  return out
}

const NUMBER_QUERY = /^\d+([.\-]\d+)*$/

// ---------- Поиск по-русски: окончания и беглые гласные ----------

const ENDINGS = /(?:ями|ами|ого|его|ому|ему|ыми|ими|ах|ях|ых|их|ой|ей|ий|ый|ая|яя|ое|ее|ые|ие|ую|юю|ом|ем|ам|ям|ов|ев|а|я|о|е|ы|и|у|ю|ь|й)$/

/** «масками» → «маск», «оружия» → «оружи» */
function stem(word: string): string {
  const s = word.replace(ENDINGS, '')
  return s.length >= 3 ? s : word
}

/** «масок» → «маск»: беглая гласная перед последней согласной */
function withoutFleeting(s: string): string {
  return s.replace(/[ое]([^аеёиоуыэюяьй])$/, '$1')
}

const wordsOf = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1)

/**
 * Насколько текст подходит под запрос: 0 — не подходит. Каждое слово запроса
 * должно найтись точно (2 очка) или по основе (1 очко).
 */
export function matchScore(haystack: string, query: string): number {
  const q = normalize(query.trim())
  if (!q) return 1
  const words = wordsOf(q)
  if (words.length === 0) return 1
  let score = 0
  let textWords: string[] | null = null
  for (const w of words) {
    if (haystack.includes(w)) {
      score += 2
      continue
    }
    const qs = stem(w)
    if (qs.length < 3) return 0
    textWords ??= wordsOf(haystack)
    const hit = textWords.some((tw) => {
      const ts = stem(tw)
      return ts.startsWith(qs) || withoutFleeting(ts).startsWith(qs) || withoutFleeting(tw).startsWith(qs)
    })
    if (!hit) return 0
    score += 1
  }
  return score
}

export function filterMemos(items: MemoItem[], query: string, law: LawId | 'all' | 'fav', favorites: string[]): MemoItem[] {
  let list = items
  if (law === 'fav') list = list.filter((i) => favorites.includes(i.key))
  else if (law !== 'all') list = list.filter((i) => i.law === law)

  const q = normalize(query.trim().replace(/^ст\.?\s*/i, ''))
  if (!q) return list
  if (NUMBER_QUERY.test(q)) {
    return list.filter((i) => i.number === q || i.number.startsWith(`${q}.`) || i.number.startsWith(`${q}-`))
  }
  // Совпадение в названии и точные совпадения — выше; внутри — порядок законов
  return list
    .map((item, index) => {
      const inText = matchScore(item.haystack, q)
      return { item, index, score: inText && inText + matchScore(normalize(item.title), q) }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item)
}

// ---------- Калькулятор наказания ----------

/** ч. 2 ст. 30 УК: сроки суммируются, но не больше 15 лет */
export const MAX_PRISON_YEARS = 15

export interface CalcResult {
  picks: { item: MemoItem; part: MemoPart }[]
  prisonYears: number
  prisonCapped: boolean
  /** Статьи УК, где вместо срока можно назначить штраф (ч. 2 ст. 13 ПК) */
  ukFines: { label: string; fine: number }[]
  koapFine: { min: number; max: number } | null
  koapArrestDays: number
  stars: number
  /** «УК РФ: ст. 44, ст. 37 ч. 2; КоАП РФ: ст. 8.7» — для протокола */
  articlesText: string
}

export function partLabel(item: MemoItem, part: MemoPart): string {
  return `ст. ${item.number}${part.part ? ` ч. ${part.part}` : ''}`
}

export function calculate(keys: string[], items: MemoItem[]): CalcResult {
  const picks: CalcResult['picks'] = []
  for (const key of keys) {
    for (const item of items) {
      const part = item.parts.find((p) => p.key === key)
      if (part) picks.push({ item, part })
    }
  }

  let prison = 0
  let stars = 0
  let arrest = 0
  let fineMin = 0
  let fineMax = 0
  let hasKoapFine = false
  const ukFines: CalcResult['ukFines'] = []

  for (const { item, part } of picks) {
    const p = part.penalty
    stars = Math.max(stars, p.stars ?? 0)
    if (item.law === 'uk') {
      if (p.prisonYears) prison += p.prisonYears.max
      if (p.fine) ukFines.push({ label: `УК ${partLabel(item, part)}`, fine: p.fine.max })
    } else {
      if (p.arrestDays) arrest += p.arrestDays.max
      if (p.fine) {
        hasKoapFine = true
        fineMin += p.fine.min
        fineMax += p.fine.max
      }
    }
  }

  const articlesText = formatCalcArticles(picks.map(({ part }) => part.key))

  return {
    picks,
    prisonYears: Math.min(prison, MAX_PRISON_YEARS),
    prisonCapped: prison > MAX_PRISON_YEARS,
    ukFines,
    koapFine: hasKoapFine ? { min: fineMin, max: fineMax } : null,
    koapArrestDays: arrest,
    stars,
    articlesText
  }
}

export function formatYears(n: number): string {
  return `${n} ${yearsWord(n)}`
}

export function formatFineRange(r: { min: number; max: number }): string {
  return r.min === r.max ? formatMoney(r.max) : `${formatMoney(r.min).replace(' ₽', '')}–${formatMoney(r.max)}`
}
