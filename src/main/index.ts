import { app, clipboard, ipcMain, Menu, nativeImage, Notification, shell, Tray } from 'electron'
import { join } from 'node:path'
import { IPC, type AppState, type GameStatus, type TabId, type Toast, type WindowMode } from '../shared/api'
import type { LawId } from '../shared/laws'
import { activeProfile, renderLine, type Bind, type Settings } from '../shared/settings'
import { BindCancelled, BindRunner } from './binds'
import { HotkeyManager, hotkeyId, parseHotkey, type Binding } from './hotkeys'
import { LawsService } from './laws/service'
import { exportPack, importPack } from './pack'
import { loadSettings, normalizeSettings, writeSettings } from './settings'
import { Updater } from './updater'
import { getForeground, isD3DFullscreen, type ForegroundWindow } from './win32'
import { MainWindow, markQuitting, OverlayWindow } from './windows'

let settings: Settings
let settingsErrors: string[] = []
let mainWin: MainWindow
let overlay: OverlayWindow
let tray: Tray | null = null
let overlayReady = false
let currentTab: TabId = 'binds'
let game: GameStatus = { active: false, foregroundExe: '', fullscreen: false, fullscreenSeen: false }
let fullscreenNotified = false

const hotkeys = new HotkeyManager()
const runner = new BindRunner()
const laws = new LawsService(() => pushState({ laws: laws.meta(), lawsLoading: laws.loading }))
const updater = new Updater((update) => pushState({ update }))

// ---------- Состояние для окна ----------

function fullState(): AppState {
  return {
    settings,
    game,
    mode: mainWin?.mode ?? 'hidden',
    tab: null,
    laws: laws.meta(),
    lawsLoading: laws.loading,
    runningBind: runner.running,
    update: updater.status,
    version: app.getVersion(),
    settingsErrors
  }
}

function pushState(patch: Partial<AppState>): void {
  if (mainWin && !mainWin.win.isDestroyed()) mainWin.win.webContents.send(IPC.state, patch)
}

function toast(t: Toast): void {
  if (!overlayReady) return
  overlay.raise()
  overlay.win.webContents.send(IPC.overlayToast, t)
}

// ---------- Игра на переднем плане ----------

function isGame(fg: ForegroundWindow | null): boolean {
  if (!fg) return false
  const exe = fg.exe.toLowerCase()
  return (
    settings.game.processNames.some((n) => n.toLowerCase() === exe) || settings.game.classNames.includes(fg.className)
  )
}

function isOwnWindow(fg: ForegroundWindow | null): boolean {
  return !!fg && (fg.hwnd == mainWin.hwnd || fg.hwnd == overlay.hwnd)
}

let lastFullscreenCheck = 0

function pollGame(): void {
  const fg = getForeground()
  const active = isGame(fg)
  let fullscreen = game.fullscreen
  if (active && Date.now() - lastFullscreenCheck > 2000) {
    lastFullscreenCheck = Date.now()
    fullscreen = isFullscreenSafe()
  } else if (!active) {
    fullscreen = false
  }
  const exe = isOwnWindow(fg) ? game.foregroundExe : (fg?.exe ?? '')
  if (active === game.active && fullscreen === game.fullscreen && exe === game.foregroundExe) return

  const becameActive = active && !game.active
  game = { active, foregroundExe: exe, fullscreen, fullscreenSeen: game.fullscreenSeen || fullscreen }
  pushState({ game })
  updateTray()
  if (becameActive) {
    mainWin.keepOnTop()
    overlay.raise()
  }
  if (fullscreen && !fullscreenNotified) {
    fullscreenNotified = true
    // Поверх полноэкранной игры нас не видно — скажем через системное уведомление
    new Notification({
      title: 'ФСВНГ Helper: оверлей не виден',
      body: 'GTA запущена в полноэкранном режиме. Поставьте в настройках графики «Оконный без рамки».'
    }).show()
  }
}

function isFullscreenSafe(): boolean {
  try {
    return isD3DFullscreen()
  } catch {
    return false
  }
}

/** Хоткеи окна работают в игре, в нашем окне и в тестовом режиме */
function hotkeysAllowed(): boolean {
  if (settings.testMode) return true
  const fg = getForeground()
  return isGame(fg) || isOwnWindow(fg)
}

// ---------- Отыгровки ----------

async function runBind(bind: Bind, fromWindow: boolean): Promise<void> {
  if (runner.running) return

  if (fromWindow) {
    // Кнопка в окне: прячем окно и возвращаем фокус игре
    mainWin.setMode('hidden')
    await new Promise((r) => setTimeout(r, 350))
  }

  const start = getForeground()
  if (isOwnWindow(start) || (!settings.testMode && !isGame(start))) {
    toast({
      id: 'bind-blocked',
      kind: 'warn',
      title: 'Отыгровка не отправлена',
      text: `Активное окно — ${start?.exe || 'неизвестно'}, а не GTA. Без игры можно проверить в тестовом режиме (меню в трее).`,
      ttl: 5000
    })
    return
  }

  const profile = activeProfile(settings)
  const lines = bind.lines
    .filter((l) => l.text.trim())
    .map((l) => ({ text: renderLine(l.text, profile), delayMs: l.delayMs ?? settings.chat.lineDelayMs }))
  if (lines.length === 0) return

  const id = `bind-${bind.id}-${Date.now()}`
  const hint = settings.hotkeys.stop ? `стоп ${settings.hotkeys.stop}` : undefined
  toast({ id, kind: 'run', title: bind.name, text: 'Отправка в чат…', progress: 0, hint, ttl: 0 })
  pushState({ runningBind: bind.id })

  try {
    await runner.run(bind.id, lines, bind.enterAfterEach, settings.chat, {
      canContinue: () => {
        const fg = getForeground()
        return isGame(fg) || (settings.testMode && !!fg && !!start && fg.hwnd == start.hwnd)
      },
      onProgress: (done, total) =>
        toast({ id, kind: 'run', title: bind.name, text: `Строка ${done} из ${total}`, progress: done / total, hint, ttl: 0 })
    })
    toast({ id, kind: 'ok', title: bind.name, text: `Отправлено строк: ${lines.length}`, progress: 1, ttl: 1800 })
  } catch (e) {
    if (e instanceof BindCancelled) {
      const text = e.reason === 'stop' ? 'Остановлено' : 'Остановлено: окно игры потеряло фокус'
      toast({ id, kind: 'warn', title: bind.name, text, ttl: 3000 })
    } else {
      toast({ id, kind: 'error', title: bind.name, text: (e as Error).message, ttl: 6000 })
    }
  } finally {
    pushState({ runningBind: null })
  }
}

// ---------- Режимы окна ----------

function setMode(mode: WindowMode): void {
  mainWin.setMode(mode)
}

function requestTab(tab: TabId): void {
  currentTab = tab
  pushState({ tab })
}

function toggleWindow(): void {
  if (mainWin.mode === 'active' && mainWin.isFocused()) setMode('hidden')
  else if (hotkeysAllowed()) setMode('active')
}

function toggleGlass(): void {
  if (mainWin.mode === 'glass') setMode('hidden')
  else if (hotkeysAllowed()) setMode('glass')
}

function toggleMemos(): void {
  if (mainWin.mode === 'glass' && currentTab === 'memos') {
    setMode('hidden')
    return
  }
  if (!hotkeysAllowed()) return
  requestTab('memos')
  setMode('glass')
}

// ---------- Настройки ----------

/** Ошибки разбора и повторы клавиш */
function validateHotkeys(s: Settings): string[] {
  const errors: string[] = []
  const seen = new Map<string, string>()
  const check = (text: string | null, owner: string) => {
    if (!text) return
    try {
      const id = hotkeyId(parseHotkey(text))
      const other = seen.get(id)
      if (other) errors.push(`${text} занята дважды: «${other}» и «${owner}»`)
      else seen.set(id, owner)
    } catch (e) {
      errors.push(`${owner}: ${(e as Error).message}`)
    }
  }
  check(s.hotkeys.window, 'Показать окно')
  check(s.hotkeys.glass, 'Режим «стекло»')
  check(s.hotkeys.memos, 'Памятки поверх игры')
  check(s.hotkeys.stop, 'Остановить отыгровку')
  for (const b of s.binds) check(b.hotkey, b.name)
  return errors
}

function applySettings(): void {
  const bindings: Binding[] = []
  const add = (text: string | null, handler: () => void, anyModifiers = false) => {
    if (!text) return
    try {
      bindings.push({ hotkey: { ...parseHotkey(text), anyModifiers }, handler })
    } catch {
      // Ошибка уже показана в настройках
    }
  }
  add(settings.hotkeys.window, toggleWindow)
  add(settings.hotkeys.glass, toggleGlass)
  add(settings.hotkeys.memos, toggleMemos)
  add(settings.hotkeys.stop, () => runner.cancel(), true)
  for (const bind of settings.binds) {
    add(bind.hotkey, () => {
      const fg = getForeground()
      if (isOwnWindow(fg)) return
      void runBind(bind, false)
    })
  }
  hotkeys.set(bindings)

  mainWin.configure(settings.ui.alwaysOnTop, settings.ui.glassOpacity, settings.ui.scale)
  if (overlayReady) overlay.win.webContents.send(IPC.overlayAccent, settings.ui.accent)
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.ui.autostart, args: ['--hidden'] })
  updateTray()
}

function saveSettings(next: Settings): string[] {
  const normalized = normalizeSettings(next)
  const errors = validateHotkeys(normalized)
  if (errors.length) return errors
  settings = normalized
  writeSettings(settings)
  settingsErrors = []
  applySettings()
  pushState({ settings, settingsErrors })
  return []
}

// ---------- Трей ----------

function trayIcon(): Electron.NativeImage {
  return nativeImage.createFromPath(join(__dirname, '../../resources/icon.png')).resize({ width: 16, height: 16 })
}

function updateTray(): void {
  if (!tray) return
  const status = game.active ? 'GTA активна' : 'GTA не активна'
  tray.setToolTip(`ФСВНГ Helper — ${status}${game.fullscreenSeen ? ' (полноэкранный режим!)' : ''}`)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Открыть окно', click: () => setMode('active') },
      { label: 'Режим «стекло»', click: () => setMode('glass') },
      { type: 'separator' },
      {
        label: 'Тестовый режим (бинды в любом окне)',
        type: 'checkbox',
        checked: settings.testMode,
        click: (item) => saveSettings({ ...settings, testMode: item.checked })
      },
      { label: 'Обновить законы с форума', click: () => void laws.refresh() },
      { type: 'separator' },
      { label: 'Выход', click: () => app.quit() }
    ])
  )
}

// ---------- IPC ----------

const SAFE_LINKS = /^https:\/\/(forum\.rmrp\.ru|github\.com)\//

function registerIpc(): void {
  ipcMain.handle(IPC.getState, () => fullState())
  ipcMain.handle(IPC.saveSettings, (_e, next: Settings) => saveSettings(next))
  ipcMain.handle(IPC.getLaw, (_e, id: LawId) => laws.get(id))
  ipcMain.handle(IPC.refreshLaws, () => laws.refresh())
  ipcMain.on(IPC.runBind, (_e, id: string) => {
    const bind = settings.binds.find((b) => b.id === id)
    if (bind) void runBind(bind, true)
  })
  ipcMain.on(IPC.stopBind, () => runner.cancel())
  ipcMain.on(IPC.hotkeyCapture, (_e, active: boolean) => {
    hotkeys.suspended = active
  })
  ipcMain.on(IPC.windowAction, (_e, action: 'minimize' | 'hide' | 'glass' | 'active') => {
    if (action === 'minimize') mainWin.win.minimize()
    else setMode(action === 'hide' ? 'hidden' : action)
  })
  ipcMain.on(IPC.setTab, (_e, tab: TabId) => {
    currentTab = tab
  })
  ipcMain.handle(IPC.exportPack, () => exportPack(mainWin.win, settings))
  ipcMain.handle(IPC.importPack, async () => {
    const imported = await importPack(mainWin.win, settings)
    if (!imported) return null
    saveSettings(imported.settings)
    return imported.result
  })
  ipcMain.on(IPC.openExternal, (_e, url: string) => {
    if (SAFE_LINKS.test(url)) void shell.openExternal(url)
  })
  ipcMain.on(IPC.copyText, (_e, text: string) => void clipboard.writeText(text))
  ipcMain.on(IPC.checkUpdates, () => updater.check())
  ipcMain.on(IPC.installUpdate, () => {
    markQuitting()
    updater.install()
  })
  ipcMain.on(IPC.overlayReady, () => {
    overlayReady = true
    overlay.win.webContents.send(IPC.overlayAccent, settings.ui.accent)
  })
}

// ---------- Запуск ----------

// Одна папка данных и в разработке, и в установленной версии: %APPDATA%\fsvng-helper
app.setPath('userData', join(app.getPath('appData'), 'fsvng-helper'))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => setMode('active'))

  app.whenReady().then(() => {
    app.setAppUserModelId('ru.rmrp.fsvng-helper')

    const loaded = loadSettings()
    settings = loaded.settings
    if (loaded.error) settingsErrors = [loaded.error]
    const hotkeyErrors = validateHotkeys(settings)
    if (hotkeyErrors.length) settingsErrors.push(...hotkeyErrors)

    registerIpc()
    laws.loadCache()

    overlay = new OverlayWindow()
    mainWin = new MainWindow((mode) => pushState({ mode }))
    tray = new Tray(trayIcon())
    tray.on('click', () => setMode('active'))

    applySettings()
    hotkeys.start()
    setInterval(pollGame, 400)

    const startHidden = process.argv.includes('--hidden')
    mainWin.win.once('ready-to-show', () => {
      if (!startHidden) setMode('active')
    })

    if (laws.isStale()) setTimeout(() => void laws.refresh(), 1500)
    setInterval(() => {
      if (laws.isStale()) void laws.refresh()
    }, 60 * 60 * 1000)

    setTimeout(() => updater.check(), 10_000)
    setInterval(() => updater.check(), 6 * 60 * 60 * 1000)

    console.log(`[fsvng-helper] запущен ${app.getVersion()}, данные: ${app.getPath('userData')}`)
  })

  app.on('before-quit', () => markQuitting())
  app.on('window-all-closed', () => {})
  app.on('will-quit', () => hotkeys.stop())
}
