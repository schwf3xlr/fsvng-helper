import { useEffect } from 'react'
import type { TabId } from '../../../shared/api'
import { activeProfile } from '../../../shared/settings'
import { BindsTab } from './BindsTab'
import { LawsTab } from './LawsTab'
import { MemosTab } from './MemosTab'
import { SettingsTab } from './SettingsTab'
import { api, useStore } from './store'
import { Alert, Icon, Kbd, type IconName } from './ui'

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'binds', label: 'Отыгровки', icon: 'chat' },
  { id: 'memos', label: 'Памятки', icon: 'memo' },
  { id: 'laws', label: 'Законы', icon: 'book' },
  { id: 'settings', label: 'Настройки', icon: 'sliders' }
]

export function App() {
  const app = useStore((s) => s.app)
  const tab = useStore((s) => s.tab)
  const accent = app?.settings.ui.accent

  useEffect(() => {
    void useStore.getState().init()
  }, [])

  useEffect(() => {
    if (!accent) return
    const root = document.documentElement.style
    root.setProperty('--accent', accent)
    root.setProperty('--accent-soft', `${accent}24`)
    root.setProperty('--accent-line', `${accent}73`)
  }, [accent])

  if (!app) return <div className="app" />

  return (
    <div className={`app${app.mode === 'glass' ? ' glass' : ''}`}>
      <Header />
      <Nav />
      <Banners />
      {tab === 'binds' && <BindsTab />}
      {tab === 'memos' && <MemosTab />}
      {tab === 'laws' && <LawsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}

function Header() {
  const settings = useStore((s) => s.app!.settings)
  const mode = useStore((s) => s.app!.mode)
  const p = activeProfile(settings)
  const who = [[p.rank, p.surname].filter(Boolean).join(' '), p.unit, p.badge && `№${p.badge}`].filter(Boolean).join(' · ')
  const windowKey = settings.hotkeys.window

  return (
    <header className="header">
      <div className="logo">
        <Icon name="shield" />
      </div>
      <div className="brand">
        <span className="brand-name">ФСВНГ HELPER</span>
        <span className="brand-sub">{who || 'Заполните профиль в настройках'}</span>
      </div>
      <span className="glass-pill">
        <Icon name="layers" size={14} />
        стекло{windowKey ? ` · ${windowKey} — окно` : ''}
      </span>
      <button
        type="button"
        className={`icon-btn${mode === 'glass' ? ' on' : ''}`}
        aria-label="Режим «стекло» поверх игры"
        title={`Режим «стекло»${settings.hotkeys.glass ? ` (${settings.hotkeys.glass})` : ''}`}
        onClick={() => api.windowAction('glass')}
      >
        <Icon name="layers" />
      </button>
      <button type="button" className="icon-btn" aria-label="Свернуть" onClick={() => api.windowAction('minimize')}>
        <Icon name="minus" />
      </button>
      <button
        type="button"
        className="icon-btn danger"
        aria-label="Скрыть в трей"
        title="Скрыть в трей — приложение продолжит работать"
        onClick={() => api.windowAction('hide')}
      >
        <Icon name="close" />
      </button>
    </header>
  )
}

function Nav() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  return (
    <nav className="nav" aria-label="Разделы">
      {TABS.map((t) => (
        <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
          <Icon name={t.icon} />
          {t.label}
        </button>
      ))}
    </nav>
  )
}

function Banners() {
  const game = useStore((s) => s.app!.game)
  const errors = useStore((s) => s.app!.settingsErrors)
  const testMode = useStore((s) => s.app!.settings.testMode)
  if (!game.fullscreenSeen && errors.length === 0 && !testMode) return null
  return (
    <div className="banner" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {game.fullscreenSeen && (
        <Alert>
          GTA запущена в полноэкранном режиме — поверх неё окна не видны. Поставьте в настройках графики игры режим
          «Оконный без рамки».
        </Alert>
      )}
      {errors.map((e) => (
        <Alert key={e}>{e}</Alert>
      ))}
      {testMode && (
        <Alert>
          Включён тестовый режим: отыгровки печатаются в любое активное окно. Выключить — в настройках или в меню трея.
        </Alert>
      )}
    </div>
  )
}

/** Строка состояния внизу вкладок */
export function StatusFooter() {
  const game = useStore((s) => s.app!.game)
  const windowKey = useStore((s) => s.app!.settings.hotkeys.window)
  return (
    <footer className="footer">
      <span className={`dot${game.active ? ' ok' : ''}`} aria-hidden="true" />
      <span style={{ flex: 1 }}>{game.active ? 'GTA активна' : 'GTA не на переднем плане'}</span>
      {windowKey && (
        <>
          <span>Скрыть</span>
          <Kbd>{windowKey}</Kbd>
        </>
      )}
    </footer>
  )
}
