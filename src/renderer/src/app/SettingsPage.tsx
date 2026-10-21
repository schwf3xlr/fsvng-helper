import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ACCENTS,
  DEFAULT_BINDS,
  HOTKEY_ACTIONS,
  RANKS,
  reservedKeyNote,
  SCALE_MAX,
  SCALE_MIN,
  TOAST_PRESETS,
  toastAnchor,
  UNITS,
  uid,
  type HotkeyAction,
  type Profile,
  type Settings
} from '../../../shared/settings'
import { Combo, Select, Slider } from '../common/controls'
import { findOwner, HotkeyButton } from '../common/hotkey'
import { api, useSettings, useStore } from '../common/store'
import { Alert, formatDate, Icon, Segmented } from '../common/ui'
import { TitleBar } from './App'

export function SettingsPage() {
  const saved = useSettings()
  const [draft, setDraft] = useState<Settings>(saved)
  const [errors, setErrors] = useState<string[]>([])
  const [savedFlash, setSavedFlash] = useState(false)
  const saveSettings = useStore((s) => s.saveSettings)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  // Настройки поменялись снаружи (трей, избранное, панель) — подхватываем, если своих правок нет
  const [base, setBase] = useState(saved)
  useEffect(() => {
    if (saved === base) return
    if (JSON.stringify(draft) === JSON.stringify(base)) setDraft(saved)
    setBase(saved)
  }, [saved, base, draft])

  const save = async () => {
    // Сохраняем только то, что правится здесь: панель, калькулятор, избранное и места
    // на экране меняются в других окнах — их не откатываем старой копией
    const next: Settings = {
      ...saved,
      profiles: draft.profiles,
      activeProfileId: draft.activeProfileId,
      hotkeys: draft.hotkeys,
      chat: draft.chat,
      ui: draft.ui,
      game: draft.game,
      testMode: draft.testMode,
      binds: JSON.stringify(draft.binds) !== JSON.stringify(base.binds) ? draft.binds : saved.binds,
      overlay: {
        ...saved.overlay,
        width: draft.overlay.width,
        maxHeight: draft.overlay.maxHeight,
        opacity: draft.overlay.opacity,
        scale: draft.overlay.scale
      }
    }
    const errs = await saveSettings(next)
    setErrors(errs)
    if (errs.length === 0) {
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
    }
  }

  return (
    <div className="page">
      <TitleBar title="Настройки" sub="изменения применяются после «Сохранить»" />
      <div className="page-scroll">
        <div className="settings-grid">
          <ProfileSection draft={draft} setDraft={setDraft} />
          <HotkeysSection draft={draft} setDraft={setDraft} />
          <PanelSection draft={draft} setDraft={setDraft} />
          <ToastSection />
          <ChatSection draft={draft} setDraft={setDraft} />
          <LookSection draft={draft} setDraft={setDraft} />
          <LaunchSection draft={draft} setDraft={setDraft} />
          <GameSection draft={draft} setDraft={setDraft} />
          <LawsSection />
          <DataSection setDraft={setDraft} draft={draft} />
          <AboutSection />
        </div>
      </div>
      {(dirty || errors.length > 0 || savedFlash) && (
        <div className="save-bar">
          <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {errors.map((e) => (
              <Alert key={e}>{e}</Alert>
            ))}
            {errors.length === 0 && (savedFlash ? 'Сохранено' : 'Есть несохранённые изменения')}
          </div>
          <button type="button" className="btn" disabled={!dirty} onClick={() => setDraft(saved)}>
            Сбросить
          </button>
          <button type="button" className="btn primary" disabled={!dirty} onClick={save}>
            Сохранить
          </button>
        </div>
      )}
    </div>
  )
}

interface SectionProps {
  draft: Settings
  setDraft: (fn: (s: Settings) => Settings) => void
}

function Section({ title, icon, children }: { title: string; icon?: Parameters<typeof Icon>[0]['name']; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <div className="card-title">
        {icon && <Icon name={icon} size={18} />}
        <h2 className="caps" style={{ margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

// ---------- Профиль ----------

function ProfileSection({ draft, setDraft }: SectionProps) {
  const profile = draft.profiles.find((p) => p.id === draft.activeProfileId) ?? draft.profiles[0]
  const set = (patch: Partial<Profile>) =>
    setDraft((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === profile.id ? { ...p, ...patch } : p)) }))

  const addProfile = () =>
    setDraft((s) => {
      const p: Profile = { ...profile, id: uid(), name: '', surname: '', badge: '', callsign: '' }
      return { ...s, profiles: [...s.profiles, p], activeProfileId: p.id }
    })

  const removeProfile = () => {
    if (draft.profiles.length < 2) return
    setDraft((s) => {
      const profiles = s.profiles.filter((p) => p.id !== profile.id)
      return { ...s, profiles, activeProfileId: profiles[0].id }
    })
  }

  const label = (p: Profile) => [p.name, p.surname].filter(Boolean).join(' ') || 'Без имени'

  return (
    <Section title="Профиль персонажа" icon="user">
      <div style={{ display: 'flex', gap: 8 }}>
        <Select
          label="Профиль"
          style={{ flex: 1 }}
          value={profile.id}
          options={draft.profiles.map((p) => ({ value: p.id, label: label(p), hint: [p.rank, p.unit].filter(Boolean).join(' · ') }))}
          onChange={(id) => setDraft((s) => ({ ...s, activeProfileId: id }))}
        />
        <button type="button" className="btn small" style={{ height: 40 }} title="Добавить профиль" aria-label="Добавить профиль" onClick={addProfile}>
          <Icon name="plus" size={16} />
        </button>
        <button type="button" className="btn small" style={{ height: 40 }} title="Удалить профиль" aria-label="Удалить профиль" disabled={draft.profiles.length < 2} onClick={removeProfile}>
          <Icon name="trash" size={16} />
        </button>
      </div>
      <ProfileFields profile={profile} onChange={set} />
      <p className="hint" style={{ margin: 0 }}>
        Подставляются в отыгровки вместо {'{имя}'}, {'{фамилия}'}, {'{звание}'}, {'{подразделение}'}, {'{жетон}'} и {'{позывной}'}.
      </p>
    </Section>
  )
}

/** Поля профиля — и в настройках, и в мастере первого запуска */
export function ProfileFields({ profile, onChange }: { profile: Profile; onChange: (patch: Partial<Profile>) => void }) {
  return (
    <>
      <div className="grid-2">
        <label className="field">
          Имя
          <input value={profile.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="field">
          Фамилия
          <input value={profile.surname} onChange={(e) => onChange({ surname: e.target.value })} />
        </label>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          Звание
          <Combo label="Звание" value={profile.rank} options={RANKS} onChange={(rank) => onChange({ rank })} />
        </div>
        <div className="field">
          Подразделение
          <Combo label="Подразделение" value={profile.unit} options={UNITS} onChange={(unit) => onChange({ unit })} />
        </div>
        <label className="field">
          Номер жетона
          <input className="mono" value={profile.badge} onChange={(e) => onChange({ badge: e.target.value })} />
        </label>
        <label className="field">
          Позывной
          <input value={profile.callsign} onChange={(e) => onChange({ callsign: e.target.value })} />
        </label>
      </div>
      <div className="field">
        Пол — для форм «снял / сняла»
        <Segmented
          label="Пол персонажа"
          value={profile.gender}
          options={[
            { value: 'm', label: 'Мужской' },
            { value: 'f', label: 'Женский' }
          ]}
          onChange={(gender) => onChange({ gender })}
        />
      </div>
    </>
  )
}

// ---------- Горячие клавиши ----------

function HotkeysSection({ draft, setDraft }: SectionProps) {
  const [conflict, setConflict] = useState<{ action: HotkeyAction; value: string } | null>(null)

  const assign = (action: HotkeyAction, value: string | null) => setDraft((s) => ({ ...s, hotkeys: { ...s.hotkeys, [action]: value } }))

  const take = () => {
    if (!conflict) return
    const owner = findOwner(draft, conflict.value, { kind: 'action', id: conflict.action })
    setDraft((s) => {
      let next = { ...s, hotkeys: { ...s.hotkeys, [conflict.action]: conflict.value } }
      if (owner?.kind === 'bind') next = { ...next, binds: next.binds.map((b) => (b.id === owner.id ? { ...b, hotkey: null } : b)) }
      if (owner?.kind === 'action') next = { ...next, hotkeys: { ...next.hotkeys, [owner.id]: null } }
      return next
    })
    setConflict(null)
  }

  const conflictOwner = conflict ? findOwner(draft, conflict.value, { kind: 'action', id: conflict.action }) : null

  return (
    <Section title="Горячие клавиши" icon="keyboard">
      <div>
        {HOTKEY_ACTIONS.map((a) => {
          const owner = findOwner(draft, draft.hotkeys[a.id], { kind: 'action', id: a.id })
          return (
            <div key={a.id} className="setting-row">
              <span className="label">
                {a.label}
                {a.hint && <small>{a.hint}</small>}
              </span>
              <HotkeyButton
                label={a.label}
                value={conflict?.action === a.id ? conflict.value : draft.hotkeys[a.id]}
                conflict={!!owner || conflict?.action === a.id}
                onChange={(v) => {
                  const o = findOwner(draft, v, { kind: 'action', id: a.id })
                  if (v && o) setConflict({ action: a.id, value: v })
                  else {
                    setConflict(null)
                    assign(a.id, v)
                  }
                }}
              />
            </div>
          )
        })}
      </div>
      {HOTKEY_ACTIONS.map((a) => {
        const note = reservedKeyNote(draft.hotkeys[a.id])
        return note ? (
          <Alert key={a.id}>
            <span>
              «{a.label}» на {draft.hotkeys[a.id]}: {note}. Лучше выбрать другую клавишу.
            </span>
          </Alert>
        ) : null
      })}
      {conflict && conflictOwner && (
        <Alert>
          <span>
            {conflict.value} уже занята {conflictOwner.kind === 'bind' ? conflictOwner.label : `действием «${conflictOwner.label}»`}.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn small primary" onClick={take}>
              Переназначить
            </button>
            <button type="button" className="btn small" onClick={() => setConflict(null)}>
              Выбрать другую
            </button>
          </div>
        </Alert>
      )}
      <p className="hint" style={{ margin: 0 }}>
        Клавиши отыгровок задаются в редакторе на странице «Отыгровки». Срабатывают, только когда GTA на переднем плане.
      </p>
    </Section>
  )
}

// ---------- Панель в игре ----------

function PanelSection({ draft, setDraft }: SectionProps) {
  const o = draft.overlay
  const set = (patch: Partial<Settings['overlay']>) => setDraft((s) => ({ ...s, overlay: { ...s.overlay, ...patch } }))
  const panel = useStore((s) => s.app!.panel)
  return (
    <Section title="Панель в игре" icon="panel">
      <p className="hint" style={{ margin: 0 }}>
        Компактная панель поверх GTA: избранные памятки, поиск статьи, алгоритм, отыгровки. Перетащить её можно за заголовок,
        когда она активна ({draft.hotkeys.interact ?? 'клавиша не назначена'}).
      </p>
      <Slider label="Масштаб панели" value={o.scale} min={SCALE_MIN} max={SCALE_MAX} step={5} marks={[SCALE_MIN, 100, SCALE_MAX]} resetTo={100} format={(v) => `${v}%`} onChange={(scale) => set({ scale })} />
      <Slider label="Ширина" value={o.width} min={320} max={560} step={10} resetTo={400} format={(v) => `${v} px`} onChange={(width) => set({ width })} />
      <Slider label="Наибольшая высота" value={o.maxHeight} min={35} max={95} step={5} resetTo={70} format={(v) => `${v}%`} onChange={(maxHeight) => set({ maxHeight })} />
      <Slider label="Непрозрачность фона" value={o.opacity} min={55} max={100} step={5} resetTo={94} format={(v) => `${v}%`} onChange={(opacity) => set({ opacity })} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn small" onClick={() => api.panelAction(panel === 'hidden' ? 'passive' : 'hidden')}>
          <Icon name="panel" size={15} />
          {panel === 'hidden' ? 'Показать панель' : 'Скрыть панель'}
        </button>
        <button type="button" className="btn small" onClick={() => api.panelAction('layout')}>
          <Icon name="cursor" size={15} />
          Расставить на экране
        </button>
      </div>
    </Section>
  )
}

// ---------- Уведомления ----------

function ToastSection() {
  const o = useSettings().overlay
  const patchSettings = useStore((s) => s.patchSettings)
  const current = TOAST_PRESETS.find((p) => Math.abs(p.x - o.toastX) < 0.6 && Math.abs(p.y - o.toastY) < 0.6)
  return (
    <Section title="Уведомления в игре" icon="chat">
      <p className="hint" style={{ margin: 0 }}>
        Где появляются уведомления отыгровок. Выберите место на схеме экрана или расставьте мышью прямо поверх игры —
        вместе с панелью. Меняется сразу, без «Сохранить».
      </p>
      <div className="screen-map" role="group" aria-label="Место уведомлений на экране">
        {TOAST_PRESETS.map((p) => {
          const { ax, ay } = toastAnchor(p.x, p.y)
          return (
            <button
              key={p.label}
              type="button"
              title={p.label}
              aria-label={p.label}
              aria-pressed={current === p}
              style={{ left: `${p.x}%`, top: `${p.y}%`, '--ax': ax, '--ay': ay } as CSSProperties}
              onClick={() => patchSettings((s) => ({ ...s, overlay: { ...s.overlay, toastX: p.x, toastY: p.y } }))}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn small primary" onClick={() => api.panelAction('layout')}>
          <Icon name="cursor" size={15} />
          Расставить на экране
        </button>
        <span className="hint">{current ? current.label : 'Своё место — выбрано мышью'}</span>
      </div>
    </Section>
  )
}

// ---------- Чат ----------

function ChatSection({ draft, setDraft }: SectionProps) {
  const chat = draft.chat
  const set = (patch: Partial<Settings['chat']>) => setDraft((s) => ({ ...s, chat: { ...s.chat, ...patch } }))
  return (
    <Section title="Отправка в чат" icon="chat">
      <div className="setting-row" style={{ borderBottom: 0, minHeight: 40 }}>
        <span className="label">Клавиша открытия чата</span>
        <HotkeyButton label="Клавиша чата" allowModifiers={false} value={chat.openKey} onChange={(v) => v && set({ openKey: v })} />
      </div>
      <div className="field">
        Способ ввода текста
        <Segmented
          label="Способ ввода текста"
          value={chat.method}
          options={[
            { value: 'keys', label: 'Эмуляция клавиш' },
            { value: 'paste', label: 'Вставка из буфера' }
          ]}
          onChange={(method) => set({ method })}
        />
        <span className="hint">
          {chat.method === 'keys'
            ? 'Печатает текст символами, как старый AHK. Раскладка не важна.'
            : 'Вставляет строку через Ctrl+V. Попробуйте, если в чате теряются буквы.'}
        </span>
      </div>
      <Slider label="Пауза между строками" value={chat.lineDelayMs} min={0} max={3000} step={100} resetTo={200} format={(v) => `${(v / 1000).toFixed(1)} с`} onChange={(lineDelayMs) => set({ lineDelayMs })} />
      <Slider label="Пауза после открытия чата" value={chat.openDelayMs} min={100} max={1500} step={50} resetTo={200} format={(v) => `${(v / 1000).toFixed(2)} с`} onChange={(openDelayMs) => set({ openDelayMs })} />
      <label className="check">
        <input type="checkbox" checked={chat.closeWithEnter} onChange={(e) => set({ closeWithEnter: e.target.checked })} />
        Закрывать чат Enter после отыгровки
      </label>
    </Section>
  )
}

// ---------- Вид ----------

function LookSection({ draft, setDraft }: SectionProps) {
  const ui = draft.ui
  const set = (patch: Partial<Settings['ui']>) => setDraft((s) => ({ ...s, ui: { ...s.ui, ...patch } }))
  return (
    <Section title="Вид" icon="monitor">
      <div className="field">
        Акцентный цвет
        <div role="group" aria-label="Акцентный цвет" style={{ display: 'flex', gap: 12 }}>
          {ACCENTS.map((a) => {
            const on = a.color.toLowerCase() === ui.accent.toLowerCase()
            return (
              <button
                key={a.color}
                type="button"
                aria-label={a.label}
                aria-pressed={on}
                title={a.label}
                onClick={() => set({ accent: a.color })}
                style={{
                  width: 38,
                  height: 38,
                  padding: 0,
                  borderRadius: 19,
                  background: a.color,
                  border: `3px solid ${on ? 'var(--text)' : 'var(--card)'}`,
                  boxShadow: '0 0 0 1px var(--line-3)'
                }}
              />
            )
          })}
        </div>
      </div>
      <Slider
        label="Масштаб окна"
        value={ui.scale}
        min={SCALE_MIN}
        max={SCALE_MAX}
        step={5}
        marks={[SCALE_MIN, 100, SCALE_MAX]}
        resetTo={100}
        format={(v) => `${v}%`}
        onChange={(scale) => set({ scale })}
      />
      <p className="hint" style={{ margin: 0 }}>
        Окно приложения — обычное: уходит назад, когда переключаешься в игру или другую программу. Поверх игры остаётся только
        панель.
      </p>
    </Section>
  )
}

// ---------- Запуск и права ----------

function LaunchSection({ draft, setDraft }: SectionProps) {
  const elevated = useStore((s) => s.app!.elevated)
  return (
    <Section title="Запуск и права" icon="admin">
      <div className="setting-row" style={{ minHeight: 40 }}>
        <span className={`dot${elevated ? ' ok' : ' warn'}`} aria-hidden="true" />
        <span className="label">
          {elevated ? 'Запущено с правами администратора' : 'Запущено без прав администратора'}
          <small>
            {elevated
              ? 'Клавиши и панель работают, даже если RMRP запущен от администратора.'
              : 'Если игра запущена от администратора, клавиши в ней не сработают.'}
          </small>
        </span>
        {!elevated && (
          <button type="button" className="btn small primary" onClick={() => api.restartAsAdmin()}>
            Перезапустить
          </button>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={draft.ui.autostart} onChange={(e) => setDraft((s) => ({ ...s, ui: { ...s.ui, autostart: e.target.checked } }))} />
        Запускать вместе с Windows — в трее, с правами администратора
      </label>
      <p className="hint" style={{ margin: 0 }}>
        Права приложение просит само. Окно Windows с вопросом появится один раз — дальше запуск идёт без него.
      </p>
    </Section>
  )
}

// ---------- Игра ----------

function GameSection({ draft, setDraft }: SectionProps) {
  const game = useStore((s) => s.app!.game)
  const patchSettings = useStore((s) => s.patchSettings)
  const [names, setNames] = useState(draft.game.processNames.join(', '))
  useEffect(() => setNames(draft.game.processNames.join(', ')), [draft.game.processNames])

  return (
    <Section title="Игра и проверка" icon="monitor">
      <div className="setting-row" style={{ minHeight: 40 }}>
        <span className={`dot${game.active ? ' ok' : ''}`} aria-hidden="true" />
        <span className="label">
          {game.active ? 'GTA на переднем плане' : 'GTA не на переднем плане'}
          <small>Последнее активное окно: {game.foregroundExe || '—'}</small>
        </span>
      </div>
      {game.fullscreenSeen && <Alert>Windows сообщила о полноэкранном режиме игры. Поверх него окна не видны — нужен «Оконный без рамки».</Alert>}
      <label className="field">
        Файл игры (.exe), через запятую
        <input
          value={names}
          onChange={(e) => setNames(e.target.value)}
          onBlur={() =>
            setDraft((s) => ({
              ...s,
              game: {
                ...s.game,
                processNames: names
                  .split(',')
                  .map((n) => n.trim())
                  .filter(Boolean)
              }
            }))
          }
        />
        <span className="hint">Если отыгровки пишут «окно не GTA» — впишите сюда имя из строки выше, пока игра открыта.</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={draft.testMode} onChange={(e) => setDraft((s) => ({ ...s, testMode: e.target.checked }))} />
        Тестовый режим — отыгровки печатаются в любое окно (например, Блокнот)
      </label>
      <button type="button" className="btn small ghost" style={{ alignSelf: 'flex-start' }} onClick={() => patchSettings((s) => ({ ...s, onboarded: false }))}>
        Пройти первую настройку заново
      </button>
    </Section>
  )
}

// ---------- Законы ----------

function LawsSection() {
  const laws = useStore((s) => s.app!.laws)
  const loading = useStore((s) => s.app!.lawsLoading)
  return (
    <Section title="Законы с форума" icon="book">
      <div>
        {laws.map((l) => (
          <div key={l.id} className="setting-row" style={{ minHeight: 42 }}>
            <span className="label">
              {l.title}
              <small style={{ color: l.error ? 'var(--warn-text)' : undefined }}>
                {l.error ? `Ошибка: ${l.error}` : l.fetchedAt ? `${l.articles} статей · загружено ${formatDate(l.fetchedAt)}` : 'не загружен'}
              </small>
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="btn" disabled={loading} onClick={() => api.refreshLaws()}>
        <Icon name="refresh" size={16} />
        {loading ? 'Загружаю…' : 'Проверить обновления законов'}
      </button>
      <p className="hint" style={{ margin: 0 }}>
        Законы берутся из тем на forum.rmrp.ru и обновляются сами раз в 12 часов. Памятки по УК и КоАП собираются из свежего текста.
      </p>
    </Section>
  )
}

// ---------- Данные ----------

function DataSection({ draft, setDraft }: SectionProps) {
  const [message, setMessage] = useState('')
  return (
    <Section title="Данные" icon="download">
      <div className="grid-2" style={{ gap: 8 }}>
        <button type="button" className="btn" onClick={async () => setMessage((await api.exportPack()) ? 'Пак сохранён.' : '')}>
          <Icon name="upload" size={16} />
          Экспорт пака
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              const r = await api.importPack()
              if (r) setMessage(`Добавлено отыгровок: ${r.binds}, алгоритмов: ${r.checklists}.`)
            } catch (e) {
              setMessage((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
            }
          }}
        >
          <Icon name="download" size={16} />
          Импорт пака
        </button>
      </div>
      <button
        type="button"
        className="btn"
        onClick={() => {
          if (!window.confirm('Добавить стандартные отыгровки, которых у вас нет? Ваши останутся.')) return
          setDraft((s) => {
            const have = new Set(s.binds.map((b) => b.name))
            const extra = DEFAULT_BINDS.filter((b) => !have.has(b.name)).map((b) => ({ ...structuredClone(b), id: uid(), hotkey: null }))
            return { ...s, binds: [...s.binds, ...extra] }
          })
        }}
      >
        Вернуть стандартные отыгровки
      </button>
      {message && <span className="hint">{message}</span>}
      <p className="hint" style={{ margin: 0 }}>
        Пак — один файл с отыгровками и алгоритмами. Можно скинуть всему отделу: при импорте они добавятся к своим. Сейчас
        отыгровок: {draft.binds.length}.
      </p>
    </Section>
  )
}

// ---------- О программе ----------

function AboutSection() {
  const version = useStore((s) => s.app!.version)
  const update = useStore((s) => s.app!.update)
  const text: Record<string, string> = {
    idle: 'Обновления проверяются автоматически',
    checking: 'Проверяю обновления…',
    available: `Найдена версия ${update.version}, скачиваю…`,
    downloading: `Скачиваю ${update.version}: ${Math.round((update.progress ?? 0) * 100)}%`,
    ready: `Версия ${update.version} готова к установке`,
    none: 'Установлена последняя версия',
    error: `Не удалось проверить: ${update.message ?? ''}`,
    unsupported: 'Автообновление работает в установленной версии'
  }
  return (
    <Section title="О программе" icon="shield">
      <div className="setting-row" style={{ borderBottom: 0, minHeight: 40 }}>
        <span className="label">
          ФСВНГ Helper {version}
          <small>{text[update.state]}</small>
        </span>
        {update.state === 'ready' ? (
          <button type="button" className="btn small primary" onClick={() => api.installUpdate()}>
            Перезапустить
          </button>
        ) : (
          <button
            type="button"
            className="btn small"
            disabled={update.state === 'unsupported' || update.state === 'checking' || update.state === 'downloading'}
            onClick={() => api.checkUpdates()}
          >
            Проверить
          </button>
        )}
      </div>
      <button type="button" className="btn small ghost" style={{ alignSelf: 'flex-start' }} onClick={() => api.openExternal('https://github.com/schwf3xlr/fsvng-helper/releases')}>
        <Icon name="external" size={15} />
        Все версии на GitHub
      </button>
    </Section>
  )
}
