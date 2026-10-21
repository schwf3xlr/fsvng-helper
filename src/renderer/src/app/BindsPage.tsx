import { useRef, useState, type DragEvent } from 'react'
import {
  activeProfile,
  CHAT_LINE_LIMIT,
  formatCalcArticles,
  renderLine,
  uid,
  usesArticles,
  VARIABLES,
  type Bind,
  type Profile,
  type Settings
} from '../../../shared/settings'
import { findOwner, HotkeyButton } from '../common/hotkey'
import { api, useSettings, useStore } from '../common/store'
import { Alert, Icon, Kbd, normalize, plural } from '../common/ui'
import { TitleBar } from './App'

function estimateSeconds(bind: Bind, s: Settings): number {
  const ms = bind.lines.reduce((sum, l) => sum + (l.delayMs ?? s.chat.lineDelayMs), s.chat.openDelayMs)
  return Math.max(1, Math.round(ms / 1000))
}

const newBind = (): Bind => ({
  id: uid(),
  name: 'Новая отыгровка',
  hotkey: null,
  enterAfterEach: true,
  lines: [{ text: '', delayMs: null }]
})

export function BindsPage() {
  const settings = useSettings()
  const running = useStore((s) => s.app!.runningBind)
  const [selected, setSelected] = useState<string | null>(settings.binds[0]?.id ?? null)
  const [draftNew, setDraftNew] = useState<Bind | null>(null)

  const current = draftNew ?? settings.binds.find((b) => b.id === selected) ?? null

  return (
    <div className="page">
      <TitleBar
        title="Отыгровки"
        sub={`${settings.binds.length} ${plural(settings.binds.length, 'отыгровка', 'отыгровки', 'отыгровок')} · клавиши работают, когда GTA на переднем плане`}
        actions={
          running ? (
            <button type="button" className="btn small" onClick={() => api.stopBind()}>
              <Icon name="stop" size={14} />
              Остановить
            </button>
          ) : null
        }
      />
      <div className="split">
        <BindList
          settings={settings}
          selected={draftNew ? null : selected}
          onSelect={(id) => {
            setDraftNew(null)
            setSelected(id)
          }}
          onNew={() => setDraftNew(newBind())}
        />
        <div className="detail-pane">
          {current ? (
            <BindEditor
              key={current.id}
              initial={current}
              isNew={!!draftNew}
              onSaved={(id) => {
                setDraftNew(null)
                setSelected(id)
              }}
              onDeleted={() => {
                setDraftNew(null)
                setSelected(settings.binds.find((b) => b.id !== current.id)?.id ?? null)
              }}
              onCancelNew={() => setDraftNew(null)}
            />
          ) : (
            <div className="empty-state">Выберите отыгровку слева или создайте новую.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function BindList({
  settings,
  selected,
  onSelect,
  onNew
}: {
  settings: Settings
  selected: string | null
  onSelect: (id: string) => void
  onNew: () => void
}) {
  const running = useStore((s) => s.app!.runningBind)
  const patchSettings = useStore((s) => s.patchSettings)
  const [query, setQuery] = useState('')
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const q = normalize(query.trim())
  const binds = settings.binds
    .map((b, index) => ({ b, index }))
    .filter(({ b }) => !q || normalize(`${b.name} ${b.hotkey ?? ''} ${b.lines.map((l) => l.text).join(' ')}`).includes(q))

  const drop = (to: number) => {
    if (dragFrom === null || dragFrom === to) return
    patchSettings((s) => {
      const list = [...s.binds]
      const [moved] = list.splice(dragFrom, 1)
      list.splice(to, 0, moved)
      return { ...s, binds: list }
    })
  }

  return (
    <div className="list-pane">
      <div className="list-tools">
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Найти отыгровку" aria-label="Найти отыгровку" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="button" className="btn primary" onClick={onNew}>
          <Icon name="plus" size={16} />
          Новая
        </button>
      </div>
      <div className="list-scroll">
        {binds.length === 0 && <div className="empty-state">Ничего не нашлось</div>}
        <ul className="bind-list">
          {binds.map(({ b, index }) => (
            <li
              key={b.id}
              className={[
                'bind-item',
                selected === b.id && 'selected',
                running === b.id && 'running',
                dragOver === index && 'drop-target'
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={!q}
              onDragStart={() => setDragFrom(index)}
              onDragOver={(e: DragEvent) => {
                e.preventDefault()
                setDragOver(index)
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => {
                drop(index)
                setDragFrom(null)
                setDragOver(null)
              }}
              onDragEnd={() => {
                setDragFrom(null)
                setDragOver(null)
              }}
            >
              <button type="button" className="open" onClick={() => onSelect(b.id)} aria-label={`Изменить «${b.name}»`}>
                <Kbd accent={running === b.id} className={b.hotkey ? '' : 'empty'}>
                  {b.hotkey ?? '—'}
                </Kbd>
                <span className="meta">
                  <span className="name">{b.name}</span>
                  <span className="sub">
                    {b.lines.length} {plural(b.lines.length, 'строка', 'строки', 'строк')} · ≈{estimateSeconds(b, settings)} с
                    {usesArticles(b.lines.map((l) => l.text).join(' ')) && ' · статьи из калькулятора'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Запустить «${b.name}»`}
                title="Окно спрячется, и отыгровка уйдёт в чат игры"
                onClick={() => api.runBind(b.id)}
              >
                <Icon name="play" size={15} />
              </button>
            </li>
          ))}
        </ul>
        <p className="hint" style={{ margin: '12px 2px 0' }}>
          Порядок меняется перетаскиванием. ▶ прячет окно и отправляет отыгровку в игру.
        </p>
      </div>
    </div>
  )
}

// ---------- Редактор ----------

function previewLine(text: string, profile: Profile): { cls: string; text: string } {
  const who = `${profile.name} ${profile.surname}`.trim() || 'Персонаж'
  const m = /^\/(\w+)\s*(.*)$/s.exec(text)
  if (!m) return { cls: 'say', text: `${who} говорит: ${text}` }
  const [, cmd, rest] = m
  if (cmd === 'me') return { cls: 'me', text: `${who} ${rest}` }
  if (cmd === 'do') return { cls: 'do', text: `${rest} (( ${who} ))` }
  if (cmd === 'try') return { cls: 'me', text: `${who} ${rest} | Удачно` }
  return { cls: 'say', text }
}

function BindEditor({
  initial,
  isNew,
  onSaved,
  onDeleted,
  onCancelNew
}: {
  initial: Bind
  isNew: boolean
  onSaved: (id: string) => void
  onDeleted: () => void
  onCancelNew: () => void
}) {
  const settings = useSettings()
  const saveSettings = useStore((s) => s.saveSettings)
  const [draft, setDraft] = useState<Bind>(() => structuredClone(initial))
  const [focused, setFocused] = useState(0)
  const [errors, setErrors] = useState<string[]>([])
  const areas = useRef<(HTMLTextAreaElement | null)[]>([])
  const profile = activeProfile(settings)
  const owner = findOwner(settings, draft.hotkey, { kind: 'bind', id: draft.id })
  const dirty = isNew || JSON.stringify(draft) !== JSON.stringify(initial)
  const needsArticles = usesArticles(draft.lines.map((l) => l.text).join(' '))

  const setLine = (i: number, patch: Partial<Bind['lines'][number]>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))

  const insertVar = (token: string) => {
    const el = areas.current[focused]
    const line = draft.lines[focused]
    if (!line) return
    const start = el?.selectionStart ?? line.text.length
    const end = el?.selectionEnd ?? start
    setLine(focused, { text: line.text.slice(0, start) + token + line.text.slice(end) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const save = async (takeHotkey = false) => {
    let binds = isNew ? [...settings.binds, draft] : settings.binds.map((b) => (b.id === draft.id ? draft : b))
    let hotkeys = settings.hotkeys
    if (takeHotkey && owner) {
      if (owner.kind === 'bind') binds = binds.map((b) => (b.id === owner.id ? { ...b, hotkey: null } : b))
      else hotkeys = { ...hotkeys, [owner.id]: null }
    }
    const errs = await saveSettings({ ...settings, binds, hotkeys })
    setErrors(errs)
    if (errs.length === 0) onSaved(draft.id)
  }

  const remove = async () => {
    if (isNew) return onCancelNew()
    if (!window.confirm(`Удалить отыгровку «${initial.name}»?`)) return
    await saveSettings({ ...settings, binds: settings.binds.filter((b) => b.id !== initial.id) })
    onDeleted()
  }

  const rendered = draft.lines.map((l) => renderLine(l.text, profile, settings.calc))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="caps" style={{ fontSize: 12 }}>
            {isNew ? 'Новая отыгровка' : 'Редактор'}
          </span>
          <input className="editor-title" aria-label="Название отыгровки" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-3)', paddingTop: 18 }}>
          Клавиша
          <HotkeyButton label="Клавиша отыгровки" value={draft.hotkey} conflict={!!owner} onChange={(hotkey) => setDraft((d) => ({ ...d, hotkey }))} />
        </div>
      </div>

      {owner && (
        <Alert>
          <span>
            {draft.hotkey} уже занята {owner.kind === 'bind' ? owner.label : `действием «${owner.label}»`}.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn small primary" onClick={() => save(true)}>
              Переназначить
            </button>
            <button type="button" className="btn small" onClick={() => setDraft({ ...draft, hotkey: null })}>
              Выбрать другую
            </button>
          </div>
        </Alert>
      )}

      <div className="editor-grid">
        <section className="card" aria-label="Строки отыгровки">
          <ol className="lines">
            {draft.lines.map((l, i) => (
              <li key={i}>
                <div className={`line${focused === i ? ' focused' : ''}`}>
                  <span className="line-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <textarea
                    ref={(el) => {
                      areas.current[i] = el
                    }}
                    rows={1}
                    aria-label={`Строка ${i + 1}`}
                    placeholder="/me достал жетон · /do Жетон на груди. · или обычный текст"
                    value={l.text}
                    onFocus={() => setFocused(i)}
                    onChange={(e) => setLine(i, { text: e.target.value.replace(/\n/g, ' ') })}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Удалить строку ${i + 1}`}
                    disabled={draft.lines.length === 1}
                    onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((_, j) => j !== i) }))}
                  >
                    <Icon name="close" size={15} />
                  </button>
                </div>
                {rendered[i].length > CHAT_LINE_LIMIT && (
                  <div className="line-len">
                    {rendered[i].length} символов — чат может обрезать строку длиннее {CHAT_LINE_LIMIT}
                  </div>
                )}
                <div className="pause">
                  <Icon name="clock" size={14} />
                  пауза
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    aria-label={`Пауза после строки ${i + 1}, секунд`}
                    placeholder={(settings.chat.lineDelayMs / 1000).toFixed(1)}
                    value={l.delayMs === null ? '' : l.delayMs / 1000}
                    onChange={(e) => setLine(i, { delayMs: e.target.value === '' ? null : Math.round(Number(e.target.value) * 1000) })}
                  />
                  с
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="add-line"
            onClick={() => {
              setDraft((d) => ({ ...d, lines: [...d.lines, { text: '', delayMs: null }] }))
              setFocused(draft.lines.length)
              requestAnimationFrame(() => areas.current[draft.lines.length]?.focus())
            }}
          >
            <Icon name="plus" size={14} />
            Добавить строку
          </button>
          <label className="check" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={draft.enterAfterEach} onChange={(e) => setDraft({ ...draft, enterAfterEach: e.target.checked })} />
            Нажимать Enter после каждой строки
          </label>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section className="card" aria-label="Переменные">
            <span className="caps" style={{ fontSize: 12 }}>
              Вставить в строку {focused + 1}
            </span>
            <div className="chips">
              {VARIABLES.map((v) => (
                <button key={v.token} type="button" className="var-btn" title={v.label} onClick={() => insertVar(v.token)}>
                  {v.token}
                </button>
              ))}
              <button type="button" className="var-btn" title="Форма по полу из профиля" onClick={() => insertVar('{снял|сняла}')}>
                {'{м|ж}'}
              </button>
            </div>
            {needsArticles && (
              <span className="hint">
                {'{статьи}'} берёт статьи из калькулятора на вкладке «Памятки»
                {settings.calc.length ? `: ${formatCalcArticles(settings.calc)}` : ' — сейчас там пусто'}.
              </span>
            )}
          </section>
          <section className="card" aria-label="Предпросмотр">
            <span className="caps" style={{ fontSize: 12 }}>
              Так это увидят в чате
            </span>
            <div className="chat-preview">
              {rendered.filter((t) => t.trim()).length === 0 && <span className="hint">Пока пусто</span>}
              {rendered.map((t, i) => {
                if (!t.trim()) return null
                const p = previewLine(t, profile)
                return (
                  <span key={i} className={p.cls}>
                    {p.text}
                  </span>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {errors.map((e) => (
        <Alert key={e}>{e}</Alert>
      ))}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn danger" onClick={remove}>
          <Icon name="trash" size={16} />
          {isNew ? 'Отменить' : 'Удалить'}
        </button>
        <span style={{ flex: 1 }} />
        {!isNew && (
          <button type="button" className="btn" disabled={dirty} title={dirty ? 'Сначала сохраните' : undefined} onClick={() => api.runBind(draft.id)}>
            <Icon name="play" size={14} />
            Запустить
          </button>
        )}
        <button type="button" className="btn" disabled={!dirty || isNew} onClick={() => setDraft(structuredClone(initial))}>
          Сбросить
        </button>
        <button type="button" className="btn primary" disabled={!dirty} onClick={() => save()}>
          Сохранить
        </button>
      </div>
    </div>
  )
}
