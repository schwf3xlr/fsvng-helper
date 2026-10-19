import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LAW_SOURCES, type LawArticle, type LawDoc, type LawId } from '../../../shared/laws'
import { api, useSettings, useStore } from '../common/store'
import { formatDate, Icon, LawBadge, plural } from '../common/ui'
import { TitleBar } from './App'

const articleId = (n: string) => `art-${n.replace(/[^\w-]/g, '_')}`

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Регэксп поиска: без учёта регистра, «е» и «ё» — одно и то же */
function searchRe(query: string): RegExp | null {
  const q = query.trim()
  if (q.length < 2) return null
  return new RegExp(escapeRe(q).replace(/[её]/gi, '[её]'), 'gi')
}

/** Подсвечивает совпадения; start — сквозной номер первого совпадения в этом тексте */
function highlight(text: string, re: RegExp | null, start: number, current: number): ReactNode {
  if (!re) return text
  const out: ReactNode[] = []
  let last = 0
  let idx = start
  re.lastIndex = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const n = idx++
    out.push(
      <mark key={m.index} data-match={n} className={n === current ? 'current' : undefined}>
        {m[0]}
      </mark>
    )
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const headingText = (a: LawArticle) => `Статья ${a.number}. ${a.title}`

/**
 * Нумерация совпадений по всему закону заранее: ключ «номер статьи#текст»
 * (0 — заголовок, 1… — абзацы) → номер первого совпадения в этом тексте.
 */
function indexMatches(doc: LawDoc | undefined, re: RegExp | null): { starts: Map<string, number>; total: number } {
  const starts = new Map<string, number>()
  let total = 0
  if (!doc || !re) return { starts, total }
  for (const a of doc.articles) {
    ;[headingText(a), ...a.paragraphs].forEach((t, i) => {
      starts.set(`${a.number}#${i}`, total)
      total += t.match(re)?.length ?? 0
    })
  }
  return { starts, total }
}

type SideView = 'toc' | 'bookmarks' | 'changes'

export function LawsPage() {
  const docs = useStore((s) => s.docs)
  const metas = useStore((s) => s.app!.laws)
  const lawsLoading = useStore((s) => s.app!.lawsLoading)
  const target = useStore((s) => s.lawTarget)
  const settings = useSettings()
  const patchSettings = useStore((s) => s.patchSettings)
  const openMemo = useStore((s) => s.openMemo)
  const openLaw = useStore((s) => s.openLaw)

  const [law, setLaw] = useState<LawId>(target?.law ?? 'uk')
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const [matchIdx, setMatchIdx] = useState(0)
  const [current, setCurrent] = useState<string | null>(null)
  const [side, setSide] = useState<SideView>('toc')
  const scroller = useRef<HTMLDivElement>(null)
  const tocRef = useRef<HTMLDivElement>(null)

  const doc = docs[law]
  const meta = metas.find((m) => m.id === law)
  const re = useMemo(() => searchRe(deferred), [deferred])
  const { starts, total } = useMemo(() => indexMatches(doc, re), [doc, re])

  const scrollToArticle = (number: string) => {
    const el = scroller.current?.querySelector<HTMLElement>(`#${articleId(number)}`)
    if (!el) return
    el.scrollIntoView({ block: 'start' })
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
  }

  // Переход из памятки или закладки
  useEffect(() => {
    if (!target) return
    setLaw(target.law)
    setQuery('')
  }, [target])
  const handledTarget = useRef(0)
  useEffect(() => {
    if (!target || target.seq === handledTarget.current || target.law !== law || !doc) return
    handledTarget.current = target.seq
    requestAnimationFrame(() => scrollToArticle(target.number))
  }, [target, law, doc])

  // Новый закон — с начала
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
    setCurrent(null)
  }, [law])

  // К найденному совпадению
  useEffect(() => {
    setMatchIdx(0)
  }, [re, law])
  useEffect(() => {
    if (!re || total === 0) return
    scroller.current?.querySelector<HTMLElement>(`mark[data-match="${matchIdx}"]`)?.scrollIntoView({ block: 'center' })
  }, [matchIdx, re, total])

  // Какая статья сейчас вверху экрана — подсвечиваем её в оглавлении
  useEffect(() => {
    const root = scroller.current
    if (!root || !doc) return
    const visible = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = (e.target as HTMLElement).dataset.number!
          if (e.isIntersecting) visible.set(n, e.boundingClientRect.top)
          else visible.delete(n)
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0]
        if (top) setCurrent(top[0])
      },
      { root, rootMargin: '0px 0px -60% 0px' }
    )
    root.querySelectorAll<HTMLElement>('.article').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [doc])
  useEffect(() => {
    if (side !== 'toc' || !current) return
    tocRef.current?.querySelector<HTMLElement>(`[data-toc="${CSS.escape(current)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current, side])

  const bookmarks = settings.bookmarks
  const toggleBookmark = (number: string) => {
    const key = `${law}:${number}`
    patchSettings((s) => ({
      ...s,
      bookmarks: s.bookmarks.includes(key) ? s.bookmarks.filter((k) => k !== key) : [...s.bookmarks, key]
    }))
  }
  const fontSize = (d: number) =>
    patchSettings((s) => ({ ...s, ui: { ...s.ui, lawFontSize: Math.min(22, Math.max(12, s.ui.lawFontSize + d)) } }))

  let lastChapter: string | undefined

  return (
    <div className="page">
      <TitleBar
        title="Законы"
        sub="полный текст с forum.rmrp.ru · обновляется сам"
        actions={
          <button type="button" className="btn small" disabled={lawsLoading} onClick={() => api.refreshLaws()}>
            <Icon name="refresh" size={15} />
            {lawsLoading ? 'Загружаю…' : 'Обновить'}
          </button>
        }
      />
      <div className="laws-layout">
        <aside className="laws-side">
          <div className="law-list" role="list">
            {LAW_SOURCES.map((s) => {
              const m = metas.find((x) => x.id === s.id)
              return (
                <button key={s.id} type="button" aria-current={law === s.id} onClick={() => setLaw(s.id)} title={s.title}>
                  <LawBadge law={s.id} />
                  <span className="grow" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.short}
                  </span>
                  <span className="n">{m?.error ? '!' : m?.articles || '—'}</span>
                </button>
              )
            })}
          </div>
          <div style={{ padding: '10px 10px 0' }}>
            <div className="segmented" role="group" aria-label="Боковая панель">
              <button type="button" aria-pressed={side === 'toc'} onClick={() => setSide('toc')}>
                Оглавление
              </button>
              <button type="button" aria-pressed={side === 'bookmarks'} onClick={() => setSide('bookmarks')}>
                Закладки · {bookmarks.length}
              </button>
              <button type="button" aria-pressed={side === 'changes'} onClick={() => setSide('changes')}>
                Поправки
              </button>
            </div>
          </div>
          <div className="toc-scroll" ref={tocRef}>
            {side === 'toc' && doc && <Toc doc={doc} current={current} onPick={scrollToArticle} />}
            {side === 'bookmarks' && <Bookmarks onPick={(l, n) => openLaw(l, n)} />}
            {side === 'changes' && doc && <Changes doc={doc} />}
          </div>
        </aside>

        <section className="law-main">
          <div className="law-tools">
            <label className="search">
              <Icon name="search" />
              <input type="search" placeholder="Поиск по тексту закона" aria-label="Поиск по тексту закона" value={query} onChange={(e) => setQuery(e.target.value)} />
              {re && <span className="count">{total ? `${matchIdx + 1} / ${total}` : '0'}</span>}
              <button type="button" className="icon-btn" aria-label="Предыдущее совпадение" disabled={!total} onClick={() => setMatchIdx((i) => (i - 1 + total) % total)}>
                <Icon name="up" size={16} />
              </button>
              <button type="button" className="icon-btn" aria-label="Следующее совпадение" disabled={!total} onClick={() => setMatchIdx((i) => (i + 1) % total)}>
                <Icon name="down" size={16} />
              </button>
            </label>
            <span className="grow" />
            <button type="button" className="btn small ghost" disabled={!current} onClick={() => current && openMemo(law, current)}>
              К памятке
            </button>
            <button type="button" className="btn small" aria-label="Уменьшить текст" onClick={() => fontSize(-1)}>
              A−
            </button>
            <button type="button" className="btn small" aria-label="Увеличить текст" onClick={() => fontSize(1)}>
              A+
            </button>
            {doc && (
              <button type="button" className="icon-btn" aria-label="Открыть на форуме" title="Открыть на форуме" onClick={() => api.openExternal(doc.url)}>
                <Icon name="external" size={17} />
              </button>
            )}
          </div>

          <div className="law-scroll" ref={scroller}>
            {!doc && (
              <div className="empty-state">
                {lawsLoading ? 'Загружаю закон с форума…' : meta?.error ? `Не удалось загрузить: ${meta.error}` : 'Закон ещё не загружен.'}
                {!lawsLoading && (
                  <button type="button" className="btn small" onClick={() => api.refreshLaws()}>
                    <Icon name="refresh" size={16} />
                    Загрузить с форума
                  </button>
                )}
              </div>
            )}

            {doc && (
              <div className="law-doc" style={{ fontSize: settings.ui.lawFontSize }}>
                <div>
                  <h1 className="law-title">{doc.title}</h1>
                  <span className="law-meta">
                    {doc.articles.length} {plural(doc.articles.length, 'статья', 'статьи', 'статей')} · изменён на форуме{' '}
                    {formatDate(doc.editedAt)} · загружен {formatDate(doc.fetchedAt)}
                  </span>
                </div>
                {doc.articles.map((a) => {
                  const showChapter = a.chapter && a.chapter !== lastChapter
                  lastChapter = a.chapter
                  return (
                    <Fragment key={a.number}>
                      {showChapter && <h3 className="law-chapter">{a.chapter}</h3>}
                      <ArticleView
                        article={a}
                        bookmarked={bookmarks.includes(`${law}:${a.number}`)}
                        onBookmark={() => toggleBookmark(a.number)}
                        render={(t, i) => highlight(t, re, starts.get(`${a.number}#${i}`) ?? 0, matchIdx)}
                      />
                    </Fragment>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ArticleView({
  article,
  bookmarked,
  onBookmark,
  render
}: {
  article: LawArticle
  bookmarked: boolean
  onBookmark: () => void
  /** i: 0 — заголовок, 1… — абзацы по порядку */
  render: (text: string, i: number) => ReactNode
}) {
  const noteAt = article.paragraphs.findIndex((p) => /^примечани/i.test(p))
  const body = noteAt >= 0 ? article.paragraphs.slice(0, noteAt) : article.paragraphs
  const note = noteAt >= 0 ? article.paragraphs.slice(noteAt) : []
  return (
    <article id={articleId(article.number)} data-number={article.number} className={`article${article.repealed ? ' repealed' : ''}`}>
      <div className="article-head">
        <h2>{render(headingText(article), 0)}</h2>
        <button type="button" className={`icon-btn${bookmarked ? ' on' : ''}`} aria-label={bookmarked ? 'Убрать закладку' : 'Добавить закладку'} aria-pressed={bookmarked} onClick={onBookmark}>
          <Icon name="bookmark" size={17} filled={bookmarked} />
        </button>
      </div>
      {body.map((p, i) => (
        <p key={i} className={/^(наказыва|влеч[её]т)/i.test(p) ? 'sanction' : undefined}>
          {render(p, i + 1)}
        </p>
      ))}
      {note.length > 0 && (
        <aside className="article-note">
          {note.map((p, i) => (
            <p key={i}>{render(p, noteAt + i + 1)}</p>
          ))}
        </aside>
      )}
    </article>
  )
}

function Toc({ doc, current, onPick }: { doc: LawDoc; current: string | null; onPick: (n: string) => void }) {
  let lastChapter: string | undefined
  return (
    <div className="toc-list">
      {doc.articles.map((a) => {
        const chapter = a.chapter !== lastChapter ? a.chapter : undefined
        lastChapter = a.chapter
        return (
          <Fragment key={a.number}>
            {chapter && <div className="toc-chapter">{chapter}</div>}
            <button type="button" data-toc={a.number} aria-current={a.number === current} onClick={() => onPick(a.number)}>
              <span className="toc-num">{a.number}</span>
              <span style={{ color: a.repealed ? 'var(--faint)' : undefined }}>{a.title}</span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

function Bookmarks({ onPick }: { onPick: (law: LawId, n: string) => void }) {
  const bookmarks = useSettings().bookmarks
  const docs = useStore((s) => s.docs)
  if (bookmarks.length === 0) return <div className="empty-state">Закладок нет — нажмите значок закладки у статьи.</div>
  return (
    <div className="toc-list">
      {bookmarks.map((key) => {
        const [law, number] = key.split(':') as [LawId, string]
        const title = docs[law]?.articles.find((a) => a.number === number)?.title ?? ''
        return (
          <button key={key} type="button" onClick={() => onPick(law, number)}>
            <LawBadge law={law} />
            <span className="toc-num">{number}</span>
            <span>{title}</span>
          </button>
        )
      })}
    </div>
  )
}

function Changes({ doc }: { doc: LawDoc }) {
  const changes = [...doc.changes].reverse().slice(0, 12)
  if (changes.length === 0) return <div className="empty-state">Поправок в теме нет.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
      {changes.map((c) => (
        <div key={c.date + c.text} className="total" style={{ padding: '9px 10px' }}>
          <span className="hint">{formatDate(c.date)}</span>
          <span style={{ fontSize: 12.5, whiteSpace: 'pre-line', color: 'var(--text-3)' }}>{c.text}</span>
        </div>
      ))}
    </div>
  )
}
