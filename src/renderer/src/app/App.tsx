import { useEffect, type ReactNode } from 'react'
import type { TabId } from '../../../shared/api'
import { activeProfile, HOTKEY_ACTIONS, reservedKeyNote } from '../../../shared/settings'
import { api, useStore } from '../common/store'
import { Alert, Emblem, Icon, Kbd, type IconName } from '../common/ui'
import { BindsPage } from './BindsPage'
import { ChecklistsPage } from './ChecklistsPage'
import { LawsPage } from './LawsPage'
import { MemosPage } from './MemosPage'
import { Onboarding } from './Onboarding'
import { SettingsPage } from './SettingsPage'

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'binds', label: 'Отыгровки', icon: 'chat' },
  { id: 'memos', label: 'Памятки', icon: 'memo' },
  { id: 'laws', label: 'Законы', icon: 'book' },
  { id: 'checklists', label: 'Алгоритмы', icon: 'checklist' },
  { id: 'settings', label: 'Настройки', icon: 'sliders' }
]

export function App() {
  const app = useStore((s) => s.app)
  const tab = useStore((s) => s.tab)

  useEffect(() => {
    void useStore.getState().init()
  }, [])

  if (!app) return <div className="shell" />

  return (
    <div className="shell">
      <div className="ambient" aria-hidden="true" />
      <Sidebar />
      <main className="main">
        {tab === 'binds' && <BindsPage />}
        {tab === 'memos' && <MemosPage />}
        {tab === 'laws' && <LawsPage />}
        {tab === 'checklists' && <ChecklistsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
      {!app.settings.onboarded && <Onboarding />}
    </div>
  )
}

/** Заголовок страницы с кнопками окна — вызывается каждой страницей */
export function TitleBar({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <header className="titlebar">
        <div className="title-block">
          <h1>{title}</h1>
          {sub && <span className="sub">{sub}</span>}
        </div>
        <div className="actions">{actions}</div>
        <div className="win-buttons">
          <button type="button" aria-label="Свернуть" onClick={() => api.windowAction('minimize')}>
            <Icon name="minus" size={16} />
          </button>
          <button type="button" aria-label="Развернуть" onClick={() => api.windowAction('maximize')}>
            <Icon name="maximize" size={14} />
          </button>
          <button
            type="button"
            className="close"
            aria-label="Скрыть в трей"
            title="Скрыть в трей — приложение продолжит работать"
            onClick={() => api.windowAction('hide')}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>
      <Banners />
    </>
  )
}

function Sidebar() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const settings = useStore((s) => s.app!.settings)
  const game = useStore((s) => s.app!.game)
  const elevated = useStore((s) => s.app!.elevated)
  const panel = useStore((s) => s.app!.panel)
  const docs = useStore((s) => s.docs)
  const p = activeProfile(settings)
  const fullName = [p.name, p.surname].filter(Boolean).join(' ')
  const initials = (p.surname || p.name || '?').slice(0, 1).toUpperCase()
  const counts: Partial<Record<TabId, number>> = {
    binds: settings.binds.length,
    laws: Object.values(docs).length,
    checklists: settings.checklists.length
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <Emblem size={40} />
        <div>
          <div className="brand-name">ФСВНГ</div>
          <div className="brand-sub">Helper · RMRP</div>
        </div>
      </div>

      <button type="button" className="profile-card" onClick={() => setTab('settings')} title="Профиль — в настройках">
        <span className="avatar">{initials}</span>
        <span className="who">
          <b>{fullName || 'Заполните профиль'}</b>
          {p.rank && <span>{p.rank}</span>}
          {(p.unit || p.badge || p.callsign) && (
            <span className="who-meta">
              {[p.unit, p.badge && `жетон ${p.badge}`, p.callsign && `«${p.callsign}»`].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
      </button>

      <nav className="nav" aria-label="Разделы">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span className="nav-icon">
              <Icon name={t.icon} size={17} />
            </span>
            {t.label}
            {counts[t.id] !== undefined && <span className="count">{counts[t.id]}</span>}
          </button>
        ))}
      </nav>

      <div className="side-foot">
        <div className="panel-card">
          <div className="row-between" style={{ alignItems: 'center' }}>
            <span className="caps" style={{ fontSize: 12 }}>
              Панель в игре
            </span>
            <span className={`dot${panel !== 'hidden' ? ' ok' : ''}`} title={panel !== 'hidden' ? 'Показана' : 'Скрыта'} />
          </div>
          <div className="keys">
            {settings.hotkeys.panel && (
              <span>
                <Kbd>{settings.hotkeys.panel}</Kbd> показать / скрыть
              </span>
            )}
            {settings.hotkeys.interact && (
              <span>
                <Kbd>{settings.hotkeys.interact}</Kbd> управлять мышью
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn small block"
            onClick={() => api.panelAction(panel === 'hidden' ? 'passive' : 'hidden')}
          >
            <Icon name="panel" size={16} />
            {panel === 'hidden' ? 'Показать панель' : 'Скрыть панель'}
          </button>
        </div>
        <div className="status-pills">
          <span className="status-row" title={game.active ? 'GTA на переднем плане' : 'GTA не на переднем плане'}>
            <span className={`dot${game.active ? ' ok' : ''}`} />
            {game.active ? 'GTA активна' : 'GTA не активна'}
          </span>
          <span className="status-row" title={elevated ? 'Права администратора есть' : 'Нет прав администратора'}>
            <span className={`dot${elevated ? ' ok' : ' warn'}`} />
            {elevated ? 'Админ' : 'Без прав'}
            {!elevated && (
              <button type="button" onClick={() => api.restartAsAdmin()}>
                дать
              </button>
            )}
          </span>
        </div>
      </div>
    </aside>
  )
}

function Banners() {
  const game = useStore((s) => s.app!.game)
  const errors = useStore((s) => s.app!.settingsErrors)
  const testMode = useStore((s) => s.app!.settings.testMode)
  const elevated = useStore((s) => s.app!.elevated)
  const hotkeys = useStore((s) => s.app!.settings.hotkeys)
  const patchSettings = useStore((s) => s.patchSettings)
  const setTab = useStore((s) => s.setTab)
  // Клавиша, на которую реагирует и сама игра (Home — оверлей Rockstar с курсором)
  const reserved = HOTKEY_ACTIONS.map((a) => ({ a, note: reservedKeyNote(hotkeys[a.id]) })).find((r) => r.note)
  if (!game.fullscreenSeen && errors.length === 0 && !testMode && elevated && !reserved) return null
  return (
    <div className="banners">
      {game.fullscreenSeen && (
        <Alert>
          GTA запущена в полноэкранном режиме — поверх неё окна не видны. Поставьте в настройках графики игры режим
          «Оконный без рамки».
        </Alert>
      )}
      {!elevated && (
        <Alert>
          <span>
            Приложение запущено без прав администратора. Если RMRP запущен от администратора, клавиши и панель в игре
            работать не будут.
          </span>
          <button type="button" className="btn small" onClick={() => api.restartAsAdmin()}>
            Перезапустить с правами
          </button>
        </Alert>
      )}
      {errors.map((e) => (
        <Alert key={e}>{e}</Alert>
      ))}
      {reserved && (
        <Alert>
          <span>
            «{reserved.a.label}» на {hotkeys[reserved.a.id]}: {reserved.note}. Поставьте другую клавишу.
          </span>
          <button type="button" className="btn small" onClick={() => setTab('settings')}>
            Сменить
          </button>
        </Alert>
      )}
      {testMode && (
        <Alert>
          <span>Включён тестовый режим: отыгровки печатаются в любое активное окно.</span>
          <button type="button" className="btn small" onClick={() => patchSettings((s) => ({ ...s, testMode: false }))}>
            Выключить
          </button>
        </Alert>
      )}
    </div>
  )
}
