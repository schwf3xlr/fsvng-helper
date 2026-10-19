import { Fragment, useMemo, useState } from 'react'
import { LAW_SOURCES } from '../../../shared/laws'
import { formatMoney } from '../../../shared/penalty'
import { buildMemos, calculate, filterMemos, formatFineRange, formatYears, partLabel, type MemoItem } from '../common/memos'
import { api, useSettings, useStore, type MemoFilter } from '../common/store'
import { Icon, LawBadge, plural, Stars } from '../common/ui'
import { TitleBar } from './App'

const FILTERS: { id: MemoFilter; label: string }[] = [
  { id: 'fav', label: 'Избранное' },
  { id: 'all', label: 'Все' },
  ...LAW_SOURCES.map((s) => ({ id: s.id as MemoFilter, label: s.short }))
]

/** Сколько карточек рисовать сразу — остальные по кнопке */
const PAGE = 80

export function MemosPage() {
  const settings = useSettings()
  const docs = useStore((s) => s.docs)
  const lawsLoading = useStore((s) => s.app!.lawsLoading)
  const query = useStore((s) => s.memoQuery)
  const filter = useStore((s) => s.memoFilter)
  const setQuery = useStore((s) => s.setMemoQuery)
  const setFilter = useStore((s) => s.setMemoFilter)
  const [limit, setLimit] = useState(PAGE)
  const [calcOpen, setCalcOpen] = useState(true)

  const memos = useMemo(() => buildMemos(docs), [docs])
  const list = filterMemos(memos, query, filter, settings.favorites)
  const noLaws = !docs.uk && !docs.koap
  const showCalc = calcOpen && settings.calc.length > 0
  // «Все» без поиска — разбиваем по законам
  const grouped = filter === 'all' && !query.trim()

  return (
    <div className="page">
      <TitleBar
        title="Памятки"
        sub="кратко по статьям · ★ в избранное · галочка — в калькулятор"
        actions={
          settings.calc.length > 0 && (
            <button type="button" className={`btn small${showCalc ? '' : ' primary'}`} onClick={() => setCalcOpen((v) => !v)}>
              <Icon name="calc" size={16} />
              Калькулятор · {settings.calc.length}
            </button>
          )
        }
      />
      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Номер или слово: «44», «8.7», «кража», «бронежилет»"
            aria-label="Поиск по памяткам"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
          />
        </label>
        <div className="chips" role="group" aria-label="Раздел">
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
      </div>

      <div className={`with-side${showCalc ? ' open' : ''}`}>
        <div className="page-scroll">
          {noLaws && (
            <div className="empty-state">
              {lawsLoading ? 'Загружаю законы с форума…' : 'Законы ещё не загружены с форума.'}
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

          {grouped ? (
            LAW_SOURCES.map((src) => {
              const items = list.filter((i) => i.law === src.id)
              if (!items.length) return null
              return (
                <Fragment key={src.id}>
                  <h2 className="caps section-title">
                    {src.title} · {items.length}
                  </h2>
                  <div className="memo-grid">
                    {items.map((item) => (
                      <MemoCard key={item.key} item={item} />
                    ))}
                  </div>
                </Fragment>
              )
            })
          ) : (
            <div className="memo-grid">
              {list.slice(0, limit).map((item) => (
                <MemoCard key={item.key} item={item} />
              ))}
            </div>
          )}
          {!grouped && list.length > limit && (
            <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => setLimit((l) => l + PAGE)}>
              Показать ещё
            </button>
          )}
        </div>
        {showCalc && <CalcPanel memos={memos} />}
      </div>
    </div>
  )
}

export function MemoCard({ item }: { item: MemoItem }) {
  const settings = useSettings()
  const patchSettings = useStore((s) => s.patchSettings)
  const toggleCalc = useStore((s) => s.toggleCalc)
  const openLaw = useStore((s) => s.openLaw)
  const fav = settings.favorites.includes(item.key)
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
        <button type="button" className={`icon-btn${fav ? ' on' : ''}`} aria-label={fav ? 'Убрать из избранного' : 'В избранное'} aria-pressed={fav} onClick={toggleFav}>
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
            <input
              type="checkbox"
              checked={settings.calc.includes(part.key)}
              onChange={() => toggleCalc(part.key)}
              aria-label={`В калькулятор: ${partLabel(item, part)}`}
            />
            <span className="part-body">
              <span className="penalty" style={{ margin: 0, fontSize: 13, color: '#bdb3b3' }}>
                <b style={{ color: 'var(--text)' }}>ч. {part.part}</b> — {part.summary} <Stars count={part.penalty.stars} />
              </span>
              <span className="part-text">{part.text}</span>
            </span>
          </label>
        ))}

      <div className="memo-actions">
        {single ? (
          <label>
            <input type="checkbox" checked={settings.calc.includes(single.key)} onChange={() => toggleCalc(single.key)} />В калькулятор
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

function CalcPanel({ memos }: { memos: MemoItem[] }) {
  const settings = useSettings()
  const toggleCalc = useStore((s) => s.toggleCalc)
  const clearCalc = useStore((s) => s.clearCalc)
  const r = calculate(settings.calc, memos)
  const [copied, setCopied] = useState(false)
  const articlesBind = settings.binds.find((b) => /\{статьи\}/i.test(b.lines.map((l) => l.text).join(' ')))

  return (
    <aside className="calc-panel" aria-label="Калькулятор наказания">
      <div className="row-between" style={{ alignItems: 'center' }}>
        <h2 className="caps">Калькулятор</h2>
        <button type="button" className="btn small ghost" onClick={clearCalc}>
          Очистить
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {r.picks.map(({ item, part }) => (
          <div key={part.key} className="calc-pick">
            <LawBadge law={item.law} />
            <span className="grow" title={item.title}>
              {partLabel(item, part)} · {item.title}
            </span>
            <button type="button" className="icon-btn" aria-label="Убрать" onClick={() => toggleCalc(part.key)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>

      {r.prisonYears > 0 && (
        <div className="total">
          <span className="hint">Лишение свободы</span>
          <span className="value">{formatYears(r.prisonYears)}</span>
          <span className="note">Сроки складываются, но не больше 15 лет (ч. 2 ст. 30 УК){r.prisonCapped ? ' — упёрлись в предел' : ''}.</span>
        </div>
      )}
      {r.ukFines.length > 0 && (
        <div className="total">
          <span className="hint">Вместо срока можно штраф (ч. 2 ст. 13 ПК)</span>
          {r.ukFines.map((f) => (
            <span key={f.label} style={{ fontSize: 13.5 }}>
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
          <span className="note">Штраф и арест равнозначны; отказ платить — арест (ст. 4.6 КоАП).</span>
        </div>
      )}
      {r.stars > 0 && (
        <div className="total">
          <span className="hint">Розыск по СПРП</span>
          <span className="value" style={{ color: 'var(--gold-text)' }}>
            {'★'.repeat(r.stars)}
          </span>
        </div>
      )}

      <div className="total">
        <span className="hint">Для протокола</span>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.articlesText}</span>
        <button
          type="button"
          className="btn small"
          style={{ marginTop: 8 }}
          onClick={() => {
            api.copyText(r.articlesText)
            setCopied(true)
          }}
        >
          <Icon name="copy" size={15} />
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>

      <p className="hint" style={{ margin: 0 }}>
        {articlesBind
          ? `Отыгровка «${articlesBind.name}»${articlesBind.hotkey ? ` (${articlesBind.hotkey})` : ''} огласит эти статьи в чат.`
          : 'Переменная {статьи} в отыгровке подставит эти статьи в чат.'}{' '}
        Итог ориентировочный — решение за сотрудником.
      </p>
    </aside>
  )
}
