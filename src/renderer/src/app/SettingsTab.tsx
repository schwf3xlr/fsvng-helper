import { useEffect, useState, type ReactNode } from 'react'
import {
  ACCENTS,
  DEFAULT_BINDS,
  HOTKEY_ACTIONS,
  RANKS,
  UNITS,
  uid,
  type HotkeyAction,
  type Profile,
  type Settings
} from '../../../shared/settings'
import { findOwner, HotkeyButton } from './hotkey'
import { api, useSettings, useStore } from './store'
import { Alert, formatDate, Icon, Segmented } from './ui'

export function SettingsTab() {
  const saved = useSettings()
  const [draft, setDraft] = useState<Settings>(saved)
  const [errors, setErrors] = useState<string[]>([])
  const [savedFlash, setSavedFlash] = useState(false)
  const saveSettings = useStore((s) => s.saveSettings)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  // Настройки поменялись снаружи (трей, избранное) — подхватываем, если нет своих правок
  const [base, setBase] = useState(saved)
  useEffect(() => {
    if (saved === base) return
    if (JSON.stringify(draft) === JSON.stringify(base)) setDraft(saved)
    setBase(saved)
  }, [saved, base, draft])

  const save = async () => {
    const errs = await saveSettings(draft)
    setErrors(errs)
    if (errs.length === 0) {
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
    }
  }

  return (
    <>
      <div className="content">
        <div className="page">
          <ProfileSection draft={draft} setDraft={setDraft} />
          <HotkeysSection draft={draft} setDraft={setDraft} />
          <ChatSection draft={draft} setDraft={setDraft} />
          <LookSection draft={draft} setDraft={setDraft} />
          <GameSection draft={draft} setDraft={setDraft} />
          <LawsSection />
          <DataSection draft={draft} setDraft={setDraft} />
          <AboutSection />
        </div>
      </div>
      <footer className="footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        {errors.map((e) => (
          <Alert key={e}>{e}</Alert>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn grow" disabled={!dirty} onClick={() => setDraft(saved)}>
            Сбросить
          </button>
          <button type="button" className="btn primary" style={{ flex: 2 }} disabled={!dirty} onClick={save}>
            {savedFlash ? 'Сохранено' : 'Сохранить'}
          </button>
        </div>
      </footer>
    </>
  )
}

interface SectionProps {
  draft: Settings
  setDraft: (fn: (s: Settings) => Settings) => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <h2 className="caps">{title}</h2>
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
    <Section title="Профиль персонажа">
      <div style={{ display: 'flex', gap: 8 }}>
        <select
          className="input"
          style={{ flex: 1, height: 44, fontWeight: 600 }}
          aria-label="Профиль"
          value={profile.id}
          onChange={(e) => setDraft((s) => ({ ...s, activeProfileId: e.target.value }))}
        >
          {draft.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {label(p)}
            </option>
          ))}
        </select>
        <button type="button" className="btn small" style={{ height: 44 }} aria-label="Добавить профиль" title="Добавить профиль" onClick={addProfile}>
          <Icon name="plus" size={16} />
        </button>
        <button
          type="button"
          className="btn small"
          style={{ height: 44 }}
          aria-label="Удалить профиль"
          title="Удалить профиль"
          disabled={draft.profiles.length < 2}
          onClick={removeProfile}
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
      <div className="grid-2">
        <label className="field">
          Имя
          <input value={profile.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          Фамилия
          <input value={profile.surname} onChange={(e) => set({ surname: e.target.value })} />
        </label>
        <label className="field">
          Звание
          <input list="ranks" value={profile.rank} onChange={(e) => set({ rank: e.target.value })} />
        </label>
        <label className="field">
          Подразделение
          <input list="units" value={profile.unit} onChange={(e) => set({ unit: e.target.value })} />
        </label>
        <label className="field">
          Номер жетона
          <input className="mono" value={profile.badge} onChange={(e) => set({ badge: e.target.value })} />
        </label>
        <label className="field">
          Позывной
          <input value={profile.callsign} onChange={(e) => set({ callsign: e.target.value })} />
        </label>
      </div>
      <datalist id="ranks">
        {RANKS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <datalist id="units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="field">
        Пол — для форм «снял / сняла»
        <Segmented
          label="Пол персонажа"
          value={profile.gender}
          options={[
            { value: 'm', label: 'Мужской' },
            { value: 'f', label: 'Женский' }
          ]}
          onChange={(gender) => set({ gender })}
        />
      </div>
      <p className="hint" style={{ margin: 0 }}>
        Подставляются в отыгровки вместо {'{имя}'}, {'{фамилия}'}, {'{звание}'}, {'{подразделение}'}, {'{жетон}'} и {'{позывной}'}.
      </p>
    </Section>
  )
}

// ---------- Горячие клавиши ----------

function HotkeysSection({ draft, setDraft }: SectionProps) {
  const [conflict, setConflict] = useState<{ action: HotkeyAction; value: string } | null>(null)

  const assign = (action: HotkeyAction, value: string | null) =>
    setDraft((s) => ({ ...s, hotkeys: { ...s.hotkeys, [action]: value } }))

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
    <Section title="Горячие клавиши">
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
      {conflict && conflictOwner && (
        <Alert>
          <span>
            {conflict.value} уже занята{' '}
            {conflictOwner.kind === 'bind' ? conflictOwner.label : `действием «${conflictOwner.label}»`}.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn small primary" style={{ background: 'var(--warn)' }} onClick={take}>
              Переназначить
            </button>
            <button type="button" className="btn small" onClick={() => setConflict(null)}>
              Выбрать другую
            </button>
          </div>
        </Alert>
      )}
      <p className="hint" style={{ margin: 0 }}>
        Клавиши отыгровок назначаются в редакторе на вкладке «Отыгровки». Срабатывают, только когда GTA на переднем плане.
      </p>
    </Section>
  )
}

// ---------- Чат ----------

function ChatSection({ draft, setDraft }: SectionProps) {
  const chat = draft.chat
  const set = (patch: Partial<Settings['chat']>) => setDraft((s) => ({ ...s, chat: { ...s.chat, ...patch } }))
  return (
    <Section title="Отправка в чат">
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
      <label className="field">
        <span className="row-between">
          Пауза между строками <span className="mono" style={{ color: 'var(--text)' }}>{(chat.lineDelayMs / 1000).toFixed(1)} с</span>
        </span>
        <input type="range" min={0} max={3000} step={100} value={chat.lineDelayMs} onChange={(e) => set({ lineDelayMs: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span className="row-between">
          Пауза после открытия чата <span className="mono" style={{ color: 'var(--text)' }}>{(chat.openDelayMs / 1000).toFixed(1)} с</span>
        </span>
        <input type="range" min={100} max={1500} step={50} value={chat.openDelayMs} onChange={(e) => set({ openDelayMs: Number(e.target.value) })} />
      </label>
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
    <Section title="Оверлей и вид">
      <label className="field">
        <span className="row-between">
          Прозрачность «стекла» <span className="mono" style={{ color: 'var(--text)' }}>{ui.glassOpacity}%</span>
        </span>
        <input type="range" min={30} max={100} step={5} value={ui.glassOpacity} onChange={(e) => set({ glassOpacity: Number(e.target.value) })} />
      </label>
      <div className="setting-row" style={{ borderBottom: 0, minHeight: 40 }}>
        <label className="label" htmlFor="scale">
          Масштаб интерфейса
        </label>
        <select id="scale" className="input" style={{ height: 40 }} value={ui.scale} onChange={(e) => set({ scale: Number(e.target.value) })}>
          {[90, 100, 110, 125, 150].map((v) => (
            <option key={v} value={v}>
              {v}%
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="check">
          <input type="checkbox" checked={ui.alwaysOnTop} onChange={(e) => set({ alwaysOnTop: e.target.checked })} />
          Окно всегда поверх игры
        </label>
        <label className="check">
          <input type="checkbox" checked={ui.autostart} onChange={(e) => set({ autostart: e.target.checked })} />
          Запускать вместе с Windows (в трее)
        </label>
      </div>
      <div className="field">
        Акцентный цвет
        <div role="group" aria-label="Акцентный цвет" style={{ display: 'flex', gap: 10 }}>
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
                  width: 40,
                  height: 40,
                  padding: 0,
                  borderRadius: 20,
                  background: a.color,
                  border: `3px solid ${on ? 'var(--text)' : 'var(--card)'}`,
                  boxShadow: '0 0 0 1px var(--line-3)'
                }}
              />
            )
          })}
        </div>
      </div>
    </Section>
  )
}

// ---------- Игра ----------

function GameSection({ draft, setDraft }: SectionProps) {
  const game = useStore((s) => s.app!.game)
  const [names, setNames] = useState(draft.game.processNames.join(', '))
  useEffect(() => setNames(draft.game.processNames.join(', ')), [draft.game.processNames])

  return (
    <Section title="Игра и проверка">
      <div className="setting-row" style={{ minHeight: 40 }}>
        <span className={`dot${game.active ? ' ok' : ''}`} aria-hidden="true" />
        <span className="label">
          {game.active ? 'GTA на переднем плане' : 'GTA не на переднем плане'}
          <small>Последнее активное окно: {game.foregroundExe || '—'}</small>
        </span>
      </div>
      {game.fullscreenSeen && (
        <Alert>Windows сообщила о полноэкранном режиме игры. Поверх него окна не видны — нужен «Оконный без рамки».</Alert>
      )}
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
    </Section>
  )
}

// ---------- Законы ----------

function LawsSection() {
  const laws = useStore((s) => s.app!.laws)
  const loading = useStore((s) => s.app!.lawsLoading)
  return (
    <Section title="Законы с форума">
      <div>
        {laws.map((l) => (
          <div key={l.id} className="setting-row" style={{ minHeight: 44 }}>
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
        Законы берутся из тем на forum.rmrp.ru и обновляются сами раз в 12 часов. Краткие памятки по УК и КоАП собираются из
        свежего текста.
      </p>
    </Section>
  )
}

// ---------- Данные ----------

function DataSection({ draft, setDraft }: SectionProps) {
  const [message, setMessage] = useState('')
  return (
    <Section title="Данные">
      <div className="grid-2" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn"
          onClick={async () => setMessage((await api.exportPack()) ? 'Пак сохранён.' : '')}
        >
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
        Пак — один файл с отыгровками и алгоритмами. Можно скинуть всему отделу: при импорте они добавятся к своим.
        {draft.binds.length ? ` Сейчас отыгровок: ${draft.binds.length}.` : ''}
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
    unsupported: 'Автообновление не настроено для этой сборки'
  }
  return (
    <Section title="О программе">
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
    </Section>
  )
}
