import { useState } from 'react'
import { isCheckable, uid, type Checklist } from '../../../shared/settings'
import { Masonry } from '../common/Masonry'
import { useSettings, useStore } from '../common/store'
import { Icon, Kbd, Segmented } from '../common/ui'
import { TitleBar } from './App'

export function ChecklistsPage() {
  const settings = useSettings()
  const patchSettings = useStore((s) => s.patchSettings)
  const [editing, setEditing] = useState<string | null>(null)
  const { step, stepBack } = settings.hotkeys

  const add = () => {
    const list: Checklist = { id: uid(), title: 'Новый алгоритм', steps: ['Первый шаг'], checkable: true }
    patchSettings((s) => ({ ...s, checklists: [...s.checklists, list] }))
    setEditing(list.id)
  }

  return (
    <div className="page">
      <TitleBar
        title="Алгоритмы действий"
        sub={
          step ? (
            <>
              в игре шаги отмечаются клавишей <Kbd>{step}</Kbd>
              {stepBack && (
                <>
                  , отмена — <Kbd>{stepBack}</Kbd>
                </>
              )}
            </>
          ) : (
            'один алгоритм можно держать в игровой панели'
          )
        }
        actions={
          <button type="button" className="btn small primary" onClick={add}>
            <Icon name="plus" size={15} />
            Новый алгоритм
          </button>
        }
      />
      <div className="page-scroll">
        <Masonry
          items={settings.checklists}
          keyOf={(c) => c.id}
          minColumn={360}
          gap={14}
          // Карточка меняет высоту при правке и смене режима — раскладываем заново
          layoutKey={`${editing}|${settings.checklists.map((c) => `${c.steps.length}${c.checkable}`).join()}`}
          render={(c) =>
            editing === c.id ? (
              <ChecklistEditor list={c} onDone={() => setEditing(null)} />
            ) : (
              <ChecklistCard list={c} inPanel={settings.overlay.checklistId === c.id} onEdit={() => setEditing(c.id)} />
            )
          }
        />
      </div>
    </div>
  )
}

export function useChecklistToggle(list: Checklist) {
  const checks = useSettings().checks[list.id] ?? []
  const patchSettings = useStore((s) => s.patchSettings)
  const done = list.steps.filter((_, i) => checks.includes(i)).length
  const next = list.steps.findIndex((_, i) => !checks.includes(i))
  const toggle = (i: number) =>
    patchSettings((s) => {
      const cur = s.checks[list.id] ?? []
      return { ...s, checks: { ...s.checks, [list.id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] } }
    })
  const reset = () => patchSettings((s) => ({ ...s, checks: { ...s.checks, [list.id]: [] } }))
  return { checks, done, next, toggle, reset }
}

export function ChecklistSteps({ list }: { list: Checklist }) {
  const { checks, next, toggle } = useChecklistToggle(list)
  if (!isCheckable(list)) {
    return (
      <ol className="steps plain">
        {list.steps.map((step, i) => (
          <li key={i}>
            <span className="step-num">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    )
  }
  return (
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
  )
}

function ChecklistCard({ list, inPanel, onEdit }: { list: Checklist; inPanel: boolean; onEdit: () => void }) {
  const { done, next, reset } = useChecklistToggle(list)
  const patchSettings = useStore((s) => s.patchSettings)
  const checkable = isCheckable(list)

  return (
    <section className="card" aria-label={list.title}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="caps" style={{ fontSize: 12 }}>
            {checkable ? 'Алгоритм' : 'Список'}
            {list.source ? ` · ${list.source}` : ''}
          </span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{list.title}</h2>
        </div>
        {checkable && (
          <span className={`pill${done === list.steps.length ? ' done' : ''}`}>
            {done === list.steps.length ? 'Готово' : `Шаг ${next + 1} из ${list.steps.length}`}
          </span>
        )}
        <button type="button" className="icon-btn" aria-label={`Изменить «${list.title}»`} onClick={onEdit}>
          <Icon name="pencil" size={16} />
        </button>
      </div>
      {checkable && (
        <div className="progress" aria-hidden="true">
          <div style={{ width: `${(done / Math.max(1, list.steps.length)) * 100}%` }} />
        </div>
      )}
      <ChecklistSteps list={list} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {checkable && (
          <button type="button" className="btn small" disabled={done === 0} onClick={reset}>
            Сбросить
          </button>
        )}
        <span className="grow" />
        {inPanel ? (
          <span className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="panel" size={15} />в игровой панели
          </span>
        ) : (
          <button
            type="button"
            className="btn small ghost"
            onClick={() => patchSettings((s) => ({ ...s, overlay: { ...s.overlay, checklistId: list.id } }))}
          >
            <Icon name="panel" size={15} />
            Показывать в игре
          </button>
        )}
      </div>
    </section>
  )
}

function ChecklistEditor({ list, onDone }: { list: Checklist; onDone: () => void }) {
  const patchSettings = useStore((s) => s.patchSettings)
  const [title, setTitle] = useState(list.title)
  const [source, setSource] = useState(list.source ?? '')
  const [steps, setSteps] = useState(list.steps.join('\n'))
  const [checkable, setCheckable] = useState(isCheckable(list))

  const save = () => {
    const clean = steps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    patchSettings((s) => ({
      ...s,
      checklists: s.checklists.map((c) =>
        c.id === list.id ? { ...c, title: title.trim() || 'Без названия', source: source.trim() || undefined, steps: clean, checkable } : c
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
      <div className="field">
        Вид
        <Segmented
          label="Вид алгоритма"
          value={checkable ? 'check' : 'plain'}
          options={[
            { value: 'check', label: 'С галочками' },
            { value: 'plain', label: 'Просто список' }
          ]}
          onChange={(v) => setCheckable(v === 'check')}
        />
        <span className="hint">
          {checkable ? 'Шаги отмечаются по ходу — мышью или клавишей в игре.' : 'Шпаргалка без отметок: шаги просто пронумерованы.'}
        </span>
      </div>
      <label className="field">
        Шаги — по одному на строку
        <textarea rows={8} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn small danger" onClick={remove}>
          <Icon name="trash" size={15} />
          Удалить
        </button>
        <span className="grow" />
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
