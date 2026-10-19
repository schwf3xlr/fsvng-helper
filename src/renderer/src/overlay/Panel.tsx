// Панель поверх игры. Видимая — клики идут в игру; активная (клавиша «Управлять
// панелью») — мышь и клавиатура у панели, Esc возвращает в игру.
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { lawSource, type LawId } from '../../../shared/laws'
import type { PanelTab } from '../../../shared/settings'
import { ChecklistSteps, useChecklistToggle } from '../app/ChecklistsPage'
import { buildMemos, calculate, filterMemos, formatYears, matchScore, partLabel, type MemoItem } from '../common/memos'
import { api, useSettings, useStore } from '../common/store'
import { Emblem, Icon, Kbd, LawBadge, normalize, Stars, type IconName } from '../common/ui'

const TABS: { id: PanelTab; icon: IconName; label: string }[] = [
  { id: 'memos', icon: 'star', label: 'Избранное' },
  { id: 'search', icon: 'search', label: 'Поиск статьи' },
  { id: 'checklist', icon: 'checklist', label: 'Алгоритм' },
  { id: 'binds', icon: 'chat', label: 'Отыгровки' }
]

type ArticleRef = { law: LawId; number: string }

export function Panel() {
  const settings = useSettings()
  const mode = useStore((s) => s.app!.panel)
  const patchSettings = useStore((s) => s.patchSettings)
  const interactive = mode === 'interactive'
  const o = settings.overlay
  const zoom = o.scale / 100
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [article, setArticle] = useState<ArticleRef | null>(null)
  const dragFrom = useRef<{ dx: number; dy: number } | null>(null)
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Esc — назад в игру
  useEffect(() => {
    if (!interactive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (article) setArticle(null)
      else api.panelAction('passive')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [interactive, article])

  // Панель стала не активной — курсор над ней больше не важен
  useEffect(() => {
    if (!interactive) api.setPanelMouse(false)
  }, [interactive])

  const width = o.width * zoom
  const left = drag?.x ?? (o.x !== null ? (o.x / 100) * viewport.w : viewport.w - width - 28)
  const top = drag?.y ?? (o.y !== null ? (o.y / 100) * viewport.h : viewport.h * 0.12)
  const clampedLeft = Math.min(Math.max(0, left), Math.max(0, viewport.w - width))
  const clampedTop = Math.min(Math.max(0, top), viewport.h - 80)

  const onHeadDown = (e: ReactPointerEvent) => {
    if (!interactive || (e.target as HTMLElement).closest('button')) return
    dragFrom.current = { dx: e.clientX - clampedLeft, dy: e.clientY - clampedTop }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onHeadMove = (e: ReactPointerEvent) => {
    if (!dragFrom.current) return
    setDrag({ x: e.clientX - dragFrom.current.dx, y: e.clientY - dragFrom.current.dy })
  }
  const onHeadUp = () => {
    if (!dragFrom.current || !drag) {
      dragFrom.current = null
      return
    }
    dragFrom.current = null
    const x = Math.round((Math.min(Math.max(0, drag.x), viewport.w - width) / viewport.w) * 1000) / 10
    const y = Math.round((Math.min(Math.max(0, drag.y), viewport.h - 80) / viewport.h) * 1000) / 10
    patchSettings((s) => ({ ...s, overlay: { ...s.overlay, x, y } }))
    setDrag(null)
  }

  const setTab = (tab: PanelTab) => {
    if (!interactive) return
    setArticle(null)
    patchSettings((s) => ({ ...s, overlay: { ...s.overlay, tab } }))
  }

  return (
    <section
      className={`panel${interactive ? ' interactive' : ''}`}
      aria-label="Панель ФСВНГ Helper"
      style={{
        left: clampedLeft,
        top: clampedTop,
        width: o.width,
        maxHeight: (viewport.h * o.maxHeight) / 100 / zoom,
        zoom,
        background: `rgba(18, 14, 16, ${o.opacity / 100})`
      }}
      onMouseEnter={() => interactive && api.setPanelMouse(true)}
      onMouseLeave={() => interactive && !dragFrom.current && api.setPanelMouse(false)}
    >
      <header className="panel-head" onPointerDown={onHeadDown} onPointerMove={onHeadMove} onPointerUp={onHeadUp}>
        <Emblem size={22} />
        <span className="title">ФСВНГ</span>
        <div className="panel-tabs" role="group" aria-label="Вкладки панели">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-label={t.label} title={t.label} aria-pressed={o.tab === t.id} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={16} filled={t.icon === 'star' ? o.tab === t.id : undefined} />
            </button>
          ))}
        </div>
      </header>

      <div className="panel-body">
        {article ? (
          <ArticleView refTo={article} onBack={() => setArticle(null)} interactive={interactive} />
        ) : (
          <>
            {o.tab === 'memos' && <FavoritesTab interactive={interactive} onOpen={setArticle} />}
            {o.tab === 'search' && <SearchTab interactive={interactive} onOpen={setArticle} />}
            {o.tab === 'checklist' && <ChecklistTab interactive={interactive} />}
            {o.tab === 'binds' && <BindsTab interactive={interactive} />}
          </>
        )}
      </div>

      <CalcBar interactive={interactive} />

      <footer className="panel-foot">
        {interactive ? (
          <>
            <Kbd>Esc</Kbd> {article ? 'назад' : 'в игру'}
            <span className="grow" />
            <span>перетащить — за заголовок</span>
          </>
        ) : (
          <>
            {settings.hotkeys.interact && (
              <>
                <Kbd>{settings.hotkeys.interact}</Kbd> управлять
              </>
            )}
            <span className="grow" />
            {settings.hotkeys.panel && (
              <>
                <Kbd>{settings.hotkeys.panel}</Kbd> скрыть
              </>
            )}
          </>
        )}
      </footer>
    </section>
  )
}

function useMemos(): MemoItem[] {
  const docs = useStore((s) => s.docs)
  return useMemo(() => buildMemos(docs), [docs])
}

// ---------- Строка памятки ----------

function MemoRow({ item, interactive, onOpen }: { item: MemoItem; interactive: boolean; onOpen: (r: ArticleRef) => void }) {
  const calc = useSettings().calc
  const toggleCalc = useStore((s) => s.toggleCalc)
  const [open, setOpen] = useState(false)
  const single = item.parts.length === 1 ? item.parts[0] : null

  return (
    <div className="p-memo" onClick={() => interactive && setOpen((v) => !v)} style={{ cursor: interactive ? 'pointer' : 'default' }}>
      <div className="p-head">
        <LawBadge law={item.law} />
        <span className="p-num">ст. {item.number}</span>
        <span className="grow" />
        {single && <Stars count={single.penalty.stars} />}
      </div>
      <span className="p-title">{item.title}</span>
      {single && <span className="p-pen">{single.summary}</span>}
      {!single && !open && item.parts.length > 1 && (
        <span className="p-pen">
          {item.parts.map((p) => `ч.${p.part} ${p.summary.toLowerCase()}`).join(' · ')}
        </span>
      )}
      {!open && item.points.length > 0 && <span className="p-pen">{item.points[0]}</span>}

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {item.points.length > 0 && (
            <ul>
              {item.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {item.parts.map((part) => (
            <label key={part.key} className="p-part">
              <input type="checkbox" checked={calc.includes(part.key)} onChange={() => toggleCalc(part.key)} />
              <span>
                {item.parts.length > 1 && <b>ч. {part.part} — </b>}
                {part.summary} <Stars count={part.penalty.stars} />
              </span>
            </label>
          ))}
          <div className="p-actions">
            <button type="button" className="link-btn" onClick={() => onOpen({ law: item.law, number: item.number })}>
              Полный текст →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Вкладки ----------

function FavoritesTab({ interactive, onOpen }: { interactive: boolean; onOpen: (r: ArticleRef) => void }) {
  const favorites = useSettings().favorites
  const memos = useMemos()
  const list = filterMemos(memos, '', 'fav', favorites)
  if (list.length === 0) {
    return <div className="empty-state">Избранное пусто. Отметьте статьи звёздочкой в приложении или найдите через поиск.</div>
  }
  return (
    <>
      {list.map((item) => (
        <MemoRow key={item.key} item={item} interactive={interactive} onOpen={onOpen} />
      ))}
    </>
  )
}

function SearchTab({ interactive, onOpen }: { interactive: boolean; onOpen: (r: ArticleRef) => void }) {
  const docs = useStore((s) => s.docs)
  const memos = useMemos()
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (interactive) input.current?.focus()
  }, [interactive])

  const q = query.trim()
  const found = q ? filterMemos(memos, q, 'all', []).slice(0, 25) : []
  // Статьи законов без памяток (86-ФЗ, ст. общей части и т. п.) — по номеру или названию
  const memoKeys = new Set(found.map((m) => m.key))
  const nq = normalize(q.replace(/^ст\.?\s*/i, ''))
  const articles = q
    ? Object.values(docs)
        .flatMap((doc) => doc!.articles.map((a) => ({ law: doc!.id, a })))
        .filter(({ law, a }) => !memoKeys.has(`${law}:${a.number}`) && !a.repealed && (a.number === nq || matchScore(normalize(a.title), nq) > 0))
        .slice(0, 15)
    : []

  return (
    <>
      <label className="search">
        <Icon name="search" size={16} />
        <input
          ref={input}
          type="search"
          placeholder={interactive ? 'Номер или слово: «44», «маска»' : 'Сначала сделайте панель активной'}
          aria-label="Поиск статьи"
          value={query}
          disabled={!interactive}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {!q && <span className="hint">Ищет по памяткам и по названиям статей всех семи законов.</span>}
      {q && found.length === 0 && articles.length === 0 && <div className="empty-state">Ничего не нашлось</div>}
      {found.map((item) => (
        <MemoRow key={item.key} item={item} interactive={interactive} onOpen={onOpen} />
      ))}
      {articles.length > 0 && <span className="panel-section">Статьи законов</span>}
      {articles.map(({ law, a }) => (
        <button key={`${law}:${a.number}`} type="button" className="p-memo" onClick={() => interactive && onOpen({ law, number: a.number })}>
          <span className="p-head">
            <LawBadge law={law} />
            <span className="p-num">ст. {a.number}</span>
          </span>
          <span className="p-title">{a.title}</span>
        </button>
      ))}
    </>
  )
}

function ChecklistTab({ interactive }: { interactive: boolean }) {
  const settings = useSettings()
  const patchSettings = useStore((s) => s.patchSettings)
  const list = settings.checklists.find((c) => c.id === settings.overlay.checklistId) ?? settings.checklists[0]
  if (!list) return <div className="empty-state">Алгоритмов нет — добавьте их в приложении.</div>
  return (
    <>
      {interactive ? (
        <select
          className="input"
          aria-label="Алгоритм"
          value={list.id}
          onChange={(e) => patchSettings((s) => ({ ...s, overlay: { ...s.overlay, checklistId: e.target.value } }))}
        >
          {settings.checklists.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      ) : (
        <span className="panel-section">
          {list.title}
          {list.source ? ` · ${list.source}` : ''}
        </span>
      )}
      <ChecklistProgress listId={list.id} />
      <ChecklistSteps list={list} />
    </>
  )
}

function ChecklistProgress({ listId }: { listId: string }) {
  const list = useSettings().checklists.find((c) => c.id === listId)!
  const { done, reset } = useChecklistToggle(list)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="progress grow">
        <div style={{ width: `${(done / Math.max(1, list.steps.length)) * 100}%` }} />
      </div>
      <span className="hint">
        {done}/{list.steps.length}
      </span>
      {done > 0 && (
        <button type="button" className="link-btn" onClick={reset}>
          Сбросить
        </button>
      )}
    </div>
  )
}

function BindsTab({ interactive }: { interactive: boolean }) {
  const binds = useSettings().binds
  const running = useStore((s) => s.app!.runningBind)
  return (
    <>
      {binds.map((b) => (
        <button
          key={b.id}
          type="button"
          className="p-bind"
          onClick={() => interactive && api.runBind(b.id)}
          title={interactive ? 'Запустить — панель вернёт фокус игре' : undefined}
        >
          <Kbd accent={running === b.id} className={b.hotkey ? '' : 'empty'}>
            {b.hotkey ?? '—'}
          </Kbd>
          <span className="grow">{b.name}</span>
          {interactive && <Icon name="play" size={13} />}
        </button>
      ))}
    </>
  )
}

function ArticleView({ refTo, onBack, interactive }: { refTo: ArticleRef; onBack: () => void; interactive: boolean }) {
  const doc = useStore((s) => s.docs[refTo.law])
  const a = doc?.articles.find((x) => x.number === refTo.number)
  return (
    <div className="p-article">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {interactive && (
          <button type="button" className="link-btn" onClick={onBack}>
            ← Назад
          </button>
        )}
        <LawBadge law={refTo.law} />
        <span className="hint">{lawSource(refTo.law).short}</span>
      </div>
      {!a ? (
        <div className="empty-state">Статья не найдена — обновите законы в приложении.</div>
      ) : (
        <>
          <h3>
            Статья {a.number}. {a.title}
          </h3>
          {a.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </>
      )}
    </div>
  )
}

// ---------- Калькулятор ----------

function CalcBar({ interactive }: { interactive: boolean }) {
  const calc = useSettings().calc
  const clearCalc = useStore((s) => s.clearCalc)
  const memos = useMemos()
  if (calc.length === 0) return null
  const r = calculate(calc, memos)
  const summary = [r.prisonYears ? formatYears(r.prisonYears) : '', r.koapArrestDays ? `арест ${r.koapArrestDays} сут.` : '', r.stars ? '★'.repeat(r.stars) : '']
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="p-calc">
      <Icon name="calc" size={16} />
      <div className="grow">
        <b>{r.picks.map(({ item, part }) => `${item.law === 'uk' ? 'УК' : 'КоАП'} ${partLabel(item, part).replace('ст. ', '')}`).join(' + ')}</b>
        {summary && <span className="hint">{summary}</span>}
      </div>
      {interactive && (
        <button type="button" className="icon-btn" aria-label="Очистить калькулятор" title="Очистить" onClick={clearCalc}>
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  )
}
