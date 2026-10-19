import { useMemo, useState } from 'react'
import { formatMoney } from '../../../shared/penalty'
import { uid, type Checklist } from '../../../shared/settings'
import { buildMemos, calculate, filterMemos, formatFineRange, formatYears, partLabel, type MemoItem } from './memos'
import { api, useSettings, useStore, type MemoFilter } from './store'
import { Icon, LawBadge, plural, Stars } from './ui'

const FILTERS: { id: MemoFilter; label: string }[] = [
  { id: 'fav', label: 'Избранное' },
  { id: 'all', label: 'Все' },
  { id: 'uk', label: 'УК' },
  { id: 'koap', label: 'КоАП' },
  { id: 'pk', label: 'ПК' },
  { id: 'fz18', label: 'ФЗ о ФСВНГ' },
  { id: 'checklists', label: 'Алгоритмы' }
]

/** Сколько карточек рисовать сразу — остальные по кнопке */
const PAGE = 60

export function MemosTab() {
  const settings = useSettings()
  const docs = useStore((s) => s.docs)
  const lawsLoading = useStore((s) => s.app!.lawsLoading)
  const query = useStore((s) => s.memoQuery)
  const filter = useStore((s) => s.memoFilter)
  const setQuery = useStore((s) => s.setMemoQuery)
  const setFilter = useStore((s) => s.setMemoFilter)
  const calc = useStore((s) => s.calc)
  const [limit, setLimit] = useState(PAGE)
  const [sheet, setSheet] = useState(false)

  const memos = useMemo(() => buildMemos(docs), [docs])
  const list = filter === 'checklists' ? [] : filterMemos(memos, query, filter, settings.favorites)
  const noLaws = !docs.uk && !docs.koap

  return (
    <>
      <div className="content">
        <div className="page">
          {filter !== 'checklists' && (
            <label className="search glass-hide">
              <Icon name="search" />
              <input
                type="search"
                placeholder="Номер или слово: «44», «8.7», «кража»"
                aria-label="Поиск по памяткам"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setLimit(PAGE)
                }}
              />
            </label>
          )}

          <div className="chips glass-hide" role="group" aria-label="Раздел">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="chip"
                aria-pressed={filter === f.id}
                onClick={() => {
                  setFilter(f.id)
                  setLimit(PAGE)
                }}
              >
                {f.id === 'fav' && <Icon name="star" size={13} />}
                {f.label}
              </button>
            ))}
          </div>

          {filter === 'checklists' ? (
            <Checklists />
          ) : (
            <>
              {noLaws && (filter === 'all' || filter === 'fav' || filter === 'uk' || filter === 'koap') && (
                <div className="empty-state">
                  {lawsLoading ? 'Загружаю УК и КоАП с форума…' : 'УК и КоАП ещё не загружены с форума.'}
                  {!lawsLoading && (
                    <button type="button" className="btn small" onClick={() => api.refreshLaws()}>
                      <Icon name="refresh" size={16} />
                      Загрузить
                    </button>
                  )}
                </div>
              )}
              {list.length === 0 && !noLaws && (
                <div className="empty-state">
                  {filter === 'fav' && !query
                    ? 'В избранном пусто — отметьте звёздочкой нужные статьи.'
                    : 'Ничего не нашлось. Попробуйте номер статьи или другое слово.'}
                </div>
              )}
              {list.slice(0, limit).map((item) => (
                <MemoCard key={item.key} item={item} />
              ))}
              {list.length > limit && (
                <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>
                  Показать ещё {Math.min(PAGE, list.length - limit)} из {list.length - limit}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {filter !== 'checklists' && <CalcBar memos={memos} calc={calc} onOpen={() => setSheet(true)} />}
      {sheet && <CalcSheet memos={memos} onClose={() => setSheet(false)} />}
    </>
  )
}

function MemoCard({ item }: { item: MemoItem }) {
  const favorites = useSettings().favorites
  const patchSettings = useStore((s) => s.patchSettings)
  const calc = useStore((s) => s.calc)
  const toggleCalc = useStore((s) => s.toggleCalc)
  const openLaw = useStore((s) => s.openLaw)
  const fav = favorites.includes(item.key)
  const single = item.parts.length === 1 ? item.parts[0] : null

  const toggleFav = () =>
    patchSettings((s) => ({
      ...s,
      favorites: fav ? s.favorites.filter((k) => k !== item.key) : [...s.favorites, item.key]
    }))

  return (
    <article className="memo">
      <div className="memo-head">
        <LawBadge law={item.law} />
        <span className="num">ст. {item.number}</span>
        <button
          type="button"
          className={`icon-btn${fav ? ' on' : ''}`}
          aria-label={fav ? 'Убрать из избранного' : 'В избранное'}
          aria-pressed={fav}
          onClick={toggleFav}
        >
          <Icon name="star" size={17} filled={fav} />
        </button>
      </div>
      <h3>{item.title}</h3>

      {item.points.length > 0 && (
        <ul>
          {item.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {single && (
        <p className="penalty">
          <span className="label">Наказание: </span>
          {single.summary} <Stars count={single.penalty.stars} />
          {item.court && <span className="label"> · определяет суд</span>}
        </p>
      )}

      {!single &&
        item.parts.map((part) => (
          <label key={part.key} className="memo-part">
            <input type="checkbox" checked={calc.includes(part.key)} onChange={() => toggleCalc(part.key)} aria-label={`В калькулятор: ${partLabel(item, part)}`} />
            <span className="part-body">
              <span className="penalty" style={{ margin: 0, fontSize: 13, color: '#b4b8bf' }}>
                <b style={{ color: 'var(--text)' }}>ч. {part.part}</b> — {part.summary} <Stars count={part.penalty.stars} />
              </span>
              <span className="part-text">{part.text}</span>
            </span>
          </label>
        ))}

      <div className="memo-actions">
        {single ? (
          <label>
            <input type="checkbox" checked={calc.includes(single.key)} onChange={() => toggleCalc(single.key)} />В калькулятор
          </label>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <button type="button" className="link-btn" onClick={() => openLaw(item.law, item.number)}>
          Полный текст →
        </button>
      </div>
    </article>
  )
}

// ---------- Калькулятор ----------

function CalcBar({ memos, calc, onOpen }: { memos: MemoItem[]; calc: string[]; onOpen: () => void }) {
  if (calc.length === 0) return null
  const result = calculate(calc, memos)
  const list = result.picks.map(({ item, part }) => `${item.law === 'uk' ? 'УК' : 'КоАП'} ${partLabel(item, part).replace('ст. ', '')}`)
  return (
    <footer className="footer calc-bar">
      <div className="calc-info">
        <span>
          Калькулятор наказания · {calc.length} {plural(calc.length, 'статья', 'статьи', 'статей')}
        </span>
        <span className="calc-list">{list.join(' + ')}</span>
      </div>
      <button type="button" className="btn primary" onClick={onOpen}>
        Посчитать итог
      </button>
    </footer>
  )
}

function CalcSheet({ memos, onClose }: { memos: MemoItem[]; onClose: () => void }) {
  const calc = useStore((s) => s.calc)
  const clearCalc = useStore((s) => s.clearCalc)
  const r = calculate(calc, memos)
  const [copied, setCopied] = useState(false)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-label="Итог наказания" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Итог по {r.picks.length} {plural(r.picks.length, 'статье', 'статьям', 'статьям')}</h2>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        {r.prisonYears > 0 && (
          <div className="total">
            <span className="hint">Лишение свободы</span>
            <span className="value">{formatYears(r.prisonYears)}</span>
            <span className="note">
              Сроки складываются, но не больше 15 лет (ч. 2 ст. 30 УК){r.prisonCapped ? ' — сумма упёрлась в предел' : ''}.
            </span>
          </div>
        )}

        {r.ukFines.length > 0 && (
          <div className="total">
            <span className="hint">Вместо срока можно назначить штраф (ч. 2 ст. 13 ПК)</span>
            {r.ukFines.map((f) => (
              <span key={f.label} style={{ fontSize: 14 }}>
                {f.label} — {formatMoney(f.fine)}
              </span>
            ))}
          </div>
        )}

        {r.koapFine && (
          <div className="total">
            <span className="hint">Штрафы КоАП</span>
            <span className="value">{formatFineRange(r.koapFine)}</span>
            <span className="note">Одну статью дважды подряд не штрафуют (ст. 4.5 КоАП).</span>
          </div>
        )}

        {r.koapArrestDays > 0 && (
          <div className="total">
            <span className="hint">Или административный арест</span>
            <span className="value">
              {r.koapArrestDays} {plural(r.koapArrestDays, 'сутки', 'суток', 'суток')}
            </span>
            <span className="note">Штраф и арест равнозначны; отказ платить — арест (ст. 4.6 КоАП). 1 сутки = 1 минута.</span>
          </div>
        )}

        {r.stars > 0 && (
          <div className="total">
            <span className="hint">Розыск по СПРП</span>
            <span className="value stars" style={{ fontSize: 20 }}>
              {'★'.repeat(r.stars)}
            </span>
          </div>
        )}

        <div className="total">
          <span className="hint">Для протокола</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{r.articlesText}</span>
        </div>

        <p className="hint" style={{ margin: 0 }}>
          Итог ориентировочный — окончательное решение за сотрудником по УК, КоАП и ПК.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn grow"
            onClick={() => {
              clearCalc()
              onClose()
            }}
          >
            Очистить
          </button>
          <button
            type="button"
            className="btn primary grow"
            onClick={() => {
              api.copyText(r.articlesText)
              setCopied(true)
            }}
          >
            <Icon name="copy" size={16} />
            {copied ? 'Скопировано' : 'Копировать статьи'}
          </button>
        </div>
      </section>
    </div>
  )
}

// ---------- Чек-листы ----------

function Checklists() {
  const settings = useSettings()
  const patchSettings = useStore((s) => s.patchSettings)
  const [editing, setEditing] = useState<string | null>(null)

  const add = () => {
    const list: Checklist = { id: uid(), title: 'Новый алгоритм', steps: ['Первый шаг'] }
    patchSettings((s) => ({ ...s, checklists: [...s.checklists, list] }))
    setEditing(list.id)
  }

  return (
    <>
      <p className="hint" style={{ margin: 0 }}>
        Отмечайте шаги сами — галочки сохраняются, пока не нажмёте «Сбросить».
      </p>
      {settings.checklists.map((c) =>
        editing === c.id ? (
          <ChecklistEditor key={c.id} list={c} onDone={() => setEditing(null)} />
        ) : (
          <ChecklistCard key={c.id} list={c} onEdit={() => setEditing(c.id)} />
        )
      )}
      <button type="button" className="add-line" onClick={add}>
        <Icon name="plus" size={14} />
        Новый алгоритм
      </button>
    </>
  )
}

function ChecklistCard({ list, onEdit }: { list: Checklist; onEdit: () => void }) {
  const checks = useSettings().checks[list.id] ?? []
  const patchSettings = useStore((s) => s.patchSettings)
  const done = list.steps.filter((_, i) => checks.includes(i)).length
  const next = list.steps.findIndex((_, i) => !checks.includes(i))

  const toggle = (i: number) =>
    patchSettings((s) => {
      const cur = s.checks[list.id] ?? []
      return { ...s, checks: { ...s.checks, [list.id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] } }
    })

  return (
    <section className="card" aria-label={list.title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="caps" style={{ fontSize: 12 }}>
            Алгоритм{list.source ? ` · ${list.source}` : ''}
          </span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{list.title}</h2>
        </div>
        <span className="kbd" style={{ height: 26, fontFamily: 'var(--font)', fontSize: 12, fontWeight: 500 }}>
          {done === list.steps.length ? 'Готово' : `Шаг ${next + 1} из ${list.steps.length}`}
        </span>
        <button type="button" className="icon-btn" aria-label={`Изменить «${list.title}»`} onClick={onEdit}>
          <Icon name="pencil" size={16} />
        </button>
      </div>
      <div className="progress" aria-hidden="true">
        <div style={{ width: `${(done / Math.max(1, list.steps.length)) * 100}%` }} />
      </div>
      <ol className="steps">
        {list.steps.map((step, i) => {
          const checked = checks.includes(i)
          return (
            <li key={i}>
              <label className={checked ? 'done' : i === next ? 'next' : ''}>
                <input type="checkbox" checked={checked} onChange={() => toggle(i)} />
                <span>{step}</span>
              </label>
            </li>
          )
        })}
      </ol>
      {done > 0 && (
        <button
          type="button"
          className="btn small"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => patchSettings((s) => ({ ...s, checks: { ...s.checks, [list.id]: [] } }))}
        >
          Сбросить
        </button>
      )}
    </section>
  )
}

function ChecklistEditor({ list, onDone }: { list: Checklist; onDone: () => void }) {
  const patchSettings = useStore((s) => s.patchSettings)
  const [title, setTitle] = useState(list.title)
  const [source, setSource] = useState(list.source ?? '')
  const [steps, setSteps] = useState(list.steps.join('\n'))

  const save = () => {
    const clean = steps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    patchSettings((s) => ({
      ...s,
      checklists: s.checklists.map((c) =>
        c.id === list.id ? { ...c, title: title.trim() || 'Без названия', source: source.trim() || undefined, steps: clean } : c
      ),
      checks: { ...s.checks, [list.id]: [] }
    }))
    onDone()
  }

  const remove = () => {
    if (!window.confirm(`Удалить алгоритм «${list.title}»?`)) return
    patchSettings((s) => ({ ...s, checklists: s.checklists.filter((c) => c.id !== list.id) }))
    onDone()
  }

  return (
    <section className="card" aria-label="Редактор алгоритма">
      <div className="grid-2">
        <label className="field">
          Название
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          Основание
          <input value={source} placeholder="ст. 10 ПК" onChange={(e) => setSource(e.target.value)} />
        </label>
      </div>
      <label className="field">
        Шаги — по одному на строку
        <textarea className="steps-edit" value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn small danger" onClick={remove}>
          <Icon name="trash" size={16} />
          Удалить
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn small" onClick={onDone}>
          Отмена
        </button>
        <button type="button" className="btn small primary" onClick={save}>
          Сохранить
        </button>
      </div>
    </section>
  )
}
