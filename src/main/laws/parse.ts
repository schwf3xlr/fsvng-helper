// Разбор темы форума (XenForo) с законом: первый пост — текст закона с заголовками
// h2 (раздел), h3 (глава), h4 (статья); следующие посты — поправки.
import { HTMLElement, Node, NodeType, parse } from 'node-html-parser'
import type { LawArticle, LawChange, LawDoc, LawId } from '../../shared/laws'

type Token = { t: 'text'; s: string } | { t: 'br' } | { t: 'h'; level: number; s: string }

const BLOCK_TAGS = new Set(['div', 'p', 'li', 'ul', 'ol', 'blockquote', 'table', 'tr', 'section'])
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'img', 'template', 'button'])
const SKIP_CLASSES = ['bbCodeBlock-expandLink', 'bbCodeBlock-title', 'js-unfurl', 'bbImageWrapper']

/** Невидимые символы, которыми форум засоряет текст */
function clean(s: string): string {
  return s
    .replace(/[​‌‍‎‏⁠﻿]/g, '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
}

function walk(node: Node, out: Token[]): void {
  for (const child of node.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      out.push({ t: 'text', s: child.text })
      continue
    }
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue
    const el = child as HTMLElement
    const tag = el.tagName?.toLowerCase() ?? ''
    if (SKIP_TAGS.has(tag)) continue
    const cls = el.getAttribute('class') ?? ''
    if (SKIP_CLASSES.some((c) => cls.includes(c))) continue

    if (tag === 'br') {
      out.push({ t: 'br' })
    } else if (/^h[1-6]$/.test(tag)) {
      out.push({ t: 'h', level: Number(tag[1]), s: clean(el.text).trim() })
    } else if (BLOCK_TAGS.has(tag)) {
      out.push({ t: 'br' })
      walk(el, out)
      out.push({ t: 'br' })
    } else {
      walk(el, out)
    }
  }
}

/** Текст между заголовками → абзацы (пустая строка разделяет абзацы) */
function toParagraphs(tokens: Token[]): string[] {
  let text = ''
  for (const tok of tokens) {
    if (tok.t === 'text') text += tok.s
    else if (tok.t === 'br') text += '\n'
  }
  return clean(text)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}

const ARTICLE_RE = /^Стать[яи]\s+([0-9][0-9.\s\-–—]*?)\.?\s+(.+)$/i

function parseArticleHeading(s: string): { number: string; title: string } | null {
  const m = ARTICLE_RE.exec(s.trim())
  if (!m) return null
  return {
    number: m[1].replace(/\s+/g, '').replace(/[–—]/g, '-').replace(/\.$/, ''),
    title: m[2].trim().replace(/\.$/, '')
  }
}

function lastEdit(post: HTMLElement): string | undefined {
  return post.querySelector('.message-lastEdit time')?.getAttribute('datetime') ?? undefined
}

function postDate(post: HTMLElement): string {
  return post.querySelector('.message-attribution time, time')?.getAttribute('datetime') ?? ''
}

export function parseLawThread(html: string, id: LawId, url: string): LawDoc {
  const root = parse(html)
  const posts = root.querySelectorAll('article.message--post')
  if (posts.length === 0) throw new Error('на странице нет постов — форум изменил разметку или не открылся')

  const first = posts[0]
  const body = first.querySelector('.bbWrapper')
  if (!body) throw new Error('не найден текст первого поста')

  const tokens: Token[] = []
  walk(body, tokens)

  const articles: LawArticle[] = []
  let section: string | undefined
  let chapter: string | undefined
  let current: { head: { number: string; title: string }; tokens: Token[] } | null = null

  const flush = () => {
    if (!current) return
    const paragraphs = toParagraphs(current.tokens)
    const repealed = /утрат(ил[аи]?|или) силу/i.test(current.head.title) && paragraphs.join('').length < 40
    articles.push({ ...current.head, section, chapter, paragraphs, repealed })
    current = null
  }

  for (const tok of tokens) {
    if (tok.t !== 'h') {
      current?.tokens.push(tok)
      continue
    }
    // Уровень заголовка на форуме не всегда верный (КоАП 8.12 оформлена как h3),
    // поэтому статью, главу и раздел узнаём по тексту
    const head = parseArticleHeading(tok.s)
    if (head) {
      flush()
      current = { head, tokens: [] }
    } else if (/^глава\s/i.test(tok.s)) {
      flush()
      chapter = tok.s
    } else if (/^раздел\s/i.test(tok.s) || (tok.level <= 2 && tok.s)) {
      flush()
      section = tok.s
      chapter = undefined
    } else if (tok.level === 3 && tok.s) {
      flush()
      chapter = tok.s
    } else {
      // Подзаголовок внутри статьи — оставляем как абзац
      current?.tokens.push({ t: 'br' }, { t: 'text', s: tok.s }, { t: 'br' })
    }
  }
  flush()

  if (articles.length === 0) throw new Error('в тексте не найдено ни одной статьи')

  // Подпись «Президент Российской Федерации, Москва, Кремль…» прилипает к последней статье
  const last = articles[articles.length - 1]
  const sign = last.paragraphs.findIndex((p) => /^Президент(\s|$)/.test(p))
  if (sign > 0) last.paragraphs = last.paragraphs.slice(0, sign)

  const changes: LawChange[] = posts.slice(1).map((post) => {
    const bb = post.querySelector('.bbWrapper')
    const t: Token[] = []
    if (bb) walk(bb, t)
    return { date: postDate(post), text: toParagraphs(t).join('\n') }
  })

  const title = clean(root.querySelector('h1.p-title-value')?.text ?? '')
    .replace(/^ЗАКОНОДАТЕЛЬСТВО\s*/i, '')
    .trim()

  return {
    id,
    title,
    url,
    fetchedAt: new Date().toISOString(),
    editedAt: lastEdit(first),
    articles,
    changes
  }
}
