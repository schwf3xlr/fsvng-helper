import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { LAW_SOURCES, type LawArticle, type LawDoc, type LawId } from '../../../shared/laws'
import { api, useSettings, useStore } from './store'
import { formatDate, Icon, LawBadge, plural } from './ui'

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
    idx++
    out.push(
      <mark key={m.index} data-match={idx - 1} className={idx - 1 === current ? 'current' : undefined}>
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

export function LawsTab() {
  const docs = useStore((s) => s.docs)
  const metas = useStore((s) => s.app!.laws)
  const lawsLoading = useStore((s) => s.app!.lawsLoading)
  const target = useStore((s) => s.lawTarget)
  const settings = useSettings()
  const patchSettings = useStore((s) => s.patchSettings)
  const openMemo = useStore((s) => s.openMemo)

  const [law, setLaw] = useState<LawId>(target?.law ?? 'uk')
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const [matchIdx, setMatchIdx] = useState(0)
  const [current, setCurrent] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'toc' | 'bookmarks' | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

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

  // Переход из памятки: «Полный текст →»
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

  // К найденному совпадению
  useEffect(() => {
    setMatchIdx(0)
  }, [re, law])
  useEffect(() => {
    if (!re || total === 0) return
    scroller.current?.querySelector<HTMLElement>(`mark[data-match="${matchIdx}"]`)?.scrollIntoView({ block: 'center' })
  }, [matchIdx, re, total])

  // Какая статья сейчас вверху экрана
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
      { root, rootMargin: '-140px 0px -55% 0px' }
    )
    root.querySelectorAll<HTMLElement>('.article').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [doc])

  const articles = doc?.articles ?? []
  const curIdx = Math.max(0, articles.findIndex((a) => a.number === current))
  const neighbors = articles.slice(Math.max(0, Math.min(curIdx - 2, articles.length - 5)), Math.max(0, Math.min(curIdx - 2, articles.length - 5)) + 5)
  const bookmarks = settings.bookmarks
  let lastChapter: string | undefined

  const toggleBookmark = (number: string) => {
    const key = `${law}:${number}`
    patchSettings((s) => ({
      ...s,
      bookmarks: s.bookmarks.includes(key) ? s.bookmarks.filter((k) => k !== key) : [...s.bookmarks, key]
    }))
  }

  return (
    <>
      <div className="content" ref={scroller}>
        <div className="law-tools">
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" style={{ flex: 1, height: 44, fontWeight: 600 }} aria-label="Закон" value={law} onChange={(e) => setLaw(e.target.value as LawId)}>
              {LAW_SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <button type="button" className="btn" disabled={!doc} onClick={() => setSheet('toc')}>
              <Icon name="toc" size={16} />
              Оглавление
            </button>
          </div>

          <label className="search">
            <Icon name="search" />
            <input type="search" placeholder="Поиск по тексту закона" aria-label="Поиск по тексту закона" value={query} onChange={(e) => setQuery(e.target.value)} />
            {re && (
              <span className="count">
                {total ? `${matchIdx + 1} / ${total}` : '0'}
              </span>
            )}
            <button type="button" className="icon-btn" aria-label="Предыдущее совпадение" disabled={!total} onClick={() => setMatchIdx((i) => (i - 1 + total) % total)}>
              <Icon name="up" size={16} />
            </button>
            <button type="button" className="icon-btn" aria-label="Следующее совпадение" disabled={!total} onClick={() => setMatchIdx((i) => (i + 1) % total)}>
              <Icon name="down" size={16} />
            </button>
          </label>

          {doc && (
            <div role="group" aria-label="Соседние статьи" className="neighbors">
              {neighbors.map((a) => (
                <button key={a.number} type="button" aria-current={a.number === current} onClick={() => scrollToArticle(a.number)}>
                  {a.number}
                </button>
              ))}
            </div>
          )}
          <span className="law-meta">
            {doc
              ? `${articles.length} ${plural(articles.length, 'статья', 'статьи', 'статей')} · изменён на форуме ${formatDate(doc.editedAt)} · загружен ${formatDate(doc.fetchedAt)}`
              : ''}
          </span>
        </div>

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
            {articles.map((a) => {
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

      <footer className="footer">
        <button type="button" className="btn small" onClick={() => setSheet('bookmarks')}>
          <Icon name="bookmark" size={15} />
          Закладки · {bookmarks.length}
        </button>
        <button type="button" className="btn small ghost" disabled={!current} onClick={() => current && openMemo(law, current)}>
          К памятке
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn small"
          aria-label="Уменьшить текст"
          onClick={() => patchSettings((s) => ({ ...s, ui: { ...s.ui, lawFontSize: Math.max(12, s.ui.lawFontSize - 1) } }))}
        >
          A−
        </button>
        <button
          type="button"
          className="btn small"
          aria-label="Увеличить текст"
          onClick={() => patchSettings((s) => ({ ...s, ui: { ...s.ui, lawFontSize: Math.min(22, s.ui.lawFontSize + 1) } }))}
        >
          A+
        </button>
      </footer>

      {sheet === 'toc' && doc && (
        <TocSheet
          doc={doc}
          onPick={(n) => {
            setSheet(null)
            requestAnimationFrame(() => scrollToArticle(n))
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'bookmarks' && (
        <BookmarksSheet
          onPick={(l, n) => {
            setSheet(null)
            useStore.getState().openLaw(l, n)
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </>
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
        <button
          type="button"
          className={`icon-btn${bookmarked ? ' on' : ''}`}
          aria-label={bookmarked ? 'Убрать закладку' : 'Добавить закладку'}
          aria-pressed={bookmarked}
          onClick={onBookmark}
        >
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

function TocSheet({ doc, onPick, onClose }: { doc: LawDoc; onPick: (n: string) => void; onClose: () => void }) {
  let lastChapter: string | undefined
  const changes = [...doc.changes].reverse().slice(0, 6)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label="Оглавление" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <LawBadge law={doc.id} />
          <h2>Оглавление</h2>
          <button type="button" className="icon-btn" aria-label="Открыть на форуме" title="Открыть на форуме" onClick={() => api.openExternal(doc.url)}>
            <Icon name="external" />
          </button>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="toc-list">
          {doc.articles.map((a) => {
            const chapter = a.chapter !== lastChapter ? a.chapter : undefined
            lastChapter = a.chapter
            return (
              <Fragment key={a.number}>
                {chapter && <div className="toc-chapter">{chapter}</div>}
                <button type="button" onClick={() => onPick(a.number)}>
                  <span className="toc-num">{a.number}</span>
                  <span style={{ color: a.repealed ? 'var(--faint)' : undefined }}>{a.title}</span>
                </button>
              </Fragment>
            )
          })}
        </div>
        {changes.length > 0 && (
          <>
            <h3 className="caps" style={{ marginTop: 8 }}>
              Последние поправки
            </h3>
            {changes.map((c) => (
              <div key={c.date + c.text} className="total">
                <span className="hint">{formatDate(c.date)}</span>
                <span style={{ fontSize: 13, whiteSpace: 'pre-line', color: 'var(--text-3)' }}>{c.text}</span>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  )
}

function BookmarksSheet({ onPick, onClose }: { onPick: (law: LawId, n: string) => void; onClose: () => void }) {
  const bookmarks = useSettings().bookmarks
  const docs = useStore((s) => s.docs)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label="Закладки" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Закладки</h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {bookmarks.length === 0 && <div className="empty-state">Закладок нет — нажмите значок закладки у статьи.</div>}
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
      </section>
    </div>
  )
}
