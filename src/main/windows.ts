// Окна приложения:
//  - основное окно «ФСВНГ Helper» — активное (мышь и клавиатура) или «стекло»
//    (полупрозрачное, клики проходят в игру, фокус остаётся в GTA);
//  - оверлей на весь экран — только уведомления отыгровок.
// Игра должна быть в режиме «Оконный без рамки»: поверх полноэкранного режима окна не видны.
import { app, BrowserWindow, screen, type Rectangle } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WindowMode } from '../shared/api'
import { forceForeground, forceTopmost, foregroundHwnd, hwndFromHandle, type Hwnd } from './win32'

const preload = () => join(__dirname, '../preload/index.js')

function loadPage(win: BrowserWindow, page: 'index' | 'overlay'): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) win.loadURL(`${devUrl}/${page}.html`)
  else win.loadFile(join(__dirname, `../renderer/${page}.html`))
}

/** Ошибки страниц — в консоль запуска, иначе их не увидеть */
function forwardConsole(win: BrowserWindow, tag: string): void {
  win.webContents.on('console-message', (e) => {
    if (e.level === 'warning' || e.level === 'error') console.log(`[${tag}] ${e.message}`)
  })
  win.webContents.on('did-fail-load', (_e, code, description, url) => {
    console.log(`[${tag}] не загрузилась ${url}: ${description} (${code})`)
  })
}

// ---------- Положение окна ----------

const boundsFile = () => join(app.getPath('userData'), 'window.json')

function savedBounds(): Partial<Rectangle> {
  try {
    if (existsSync(boundsFile())) return JSON.parse(readFileSync(boundsFile(), 'utf8')) as Rectangle
  } catch {
    // Позиция по умолчанию
  }
  return {}
}

/** Окно должно хотя бы частично попадать на какой-нибудь монитор */
function visibleOnScreen(b: Partial<Rectangle>): boolean {
  if (b.x === undefined || b.y === undefined) return false
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return b.x! < a.x + a.width - 60 && b.x! + (b.width ?? 400) > a.x + 60 && b.y! >= a.y - 10 && b.y! < a.y + a.height - 60
  })
}

// ---------- Основное окно ----------

export class MainWindow {
  readonly win: BrowserWindow
  readonly hwnd: Hwnd
  mode: WindowMode = 'hidden'
  /** Окно игры, которому вернуть фокус, когда наше окно скрывается */
  private returnFocusTo: Hwnd | null = null
  private alwaysOnTop = true
  private glassOpacity = 0.85

  constructor(private readonly onModeChange: (mode: WindowMode) => void) {
    const b = savedBounds()
    const onScreen = visibleOnScreen(b)
    this.win = new BrowserWindow({
      width: b.width ?? 440,
      height: b.height ?? 820,
      x: onScreen ? b.x : undefined,
      y: onScreen ? b.y : undefined,
      minWidth: 380,
      minHeight: 520,
      frame: false,
      show: false,
      backgroundColor: '#16181C',
      title: 'ФСВНГ Helper',
      icon: join(__dirname, '../../resources/icon.png'),
      webPreferences: { preload: preload(), contextIsolation: true, nodeIntegration: false, sandbox: false }
    })
    this.hwnd = hwndFromHandle(this.win.getNativeWindowHandle())
    forwardConsole(this.win, 'окно')

    let saveTimer: NodeJS.Timeout | undefined
    const saveBounds = () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        if (!this.win.isDestroyed()) writeFileSync(boundsFile(), JSON.stringify(this.win.getNormalBounds()))
      }, 500)
    }
    this.win.on('moved', saveBounds)
    this.win.on('resized', saveBounds)
    // Крестик прячет окно в трей, выход — через меню трея
    this.win.on('close', (e) => {
      if (!quitting) {
        e.preventDefault()
        this.setMode('hidden')
      }
    })
    loadPage(this.win, 'index')
  }

  configure(alwaysOnTop: boolean, glassOpacityPercent: number, scalePercent: number): void {
    this.alwaysOnTop = alwaysOnTop
    this.glassOpacity = Math.min(1, Math.max(0.2, glassOpacityPercent / 100))
    this.win.setAlwaysOnTop(alwaysOnTop || this.mode === 'glass', 'screen-saver')
    if (this.mode === 'glass') this.win.setOpacity(this.glassOpacity)
    this.win.webContents.setZoomFactor(scalePercent / 100)
  }

  isFocused(): boolean {
    return this.win.isFocused()
  }

  setMode(mode: WindowMode): void {
    const win = this.win
    const wasFocused = win.isFocused()

    if (mode === 'active') {
      const fg = foregroundHwnd()
      if (fg && fg != this.hwnd) this.returnFocusTo = fg
      win.setIgnoreMouseEvents(false)
      win.setFocusable(true)
      win.setOpacity(1)
      win.setSkipTaskbar(false)
      win.setAlwaysOnTop(this.alwaysOnTop, 'screen-saver')
      win.show()
      if (this.alwaysOnTop) forceTopmost(this.hwnd)
      forceForeground(this.hwnd)
      win.focus()
    } else if (mode === 'glass') {
      win.setIgnoreMouseEvents(true)
      win.setFocusable(false)
      win.setOpacity(this.glassOpacity)
      win.setSkipTaskbar(true)
      win.setAlwaysOnTop(true, 'screen-saver')
      win.showInactive()
      forceTopmost(this.hwnd)
      if (wasFocused) this.restoreFocus()
    } else {
      win.hide()
      if (wasFocused) this.restoreFocus()
    }

    this.mode = mode
    this.onModeChange(mode)
  }

  /** Вернуть фокус игре (или окну, которое было активно до нас) */
  restoreFocus(): void {
    if (this.returnFocusTo) forceForeground(this.returnFocusTo)
  }

  /** Держим «стекло» над игрой, если игра снова вышла наверх */
  keepOnTop(): void {
    if (this.mode === 'glass' || (this.mode === 'active' && this.alwaysOnTop)) forceTopmost(this.hwnd)
  }
}

// ---------- Оверлей с уведомлениями ----------

export class OverlayWindow {
  readonly win: BrowserWindow
  readonly hwnd: Hwnd

  constructor() {
    const { bounds } = screen.getPrimaryDisplay()
    this.win = new BrowserWindow({
      ...bounds,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: preload(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false
      }
    })
    this.hwnd = hwndFromHandle(this.win.getNativeWindowHandle())
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setIgnoreMouseEvents(true)
    this.win.once('ready-to-show', () => this.win.showInactive())
    screen.on('display-metrics-changed', () => {
      if (!this.win.isDestroyed()) this.win.setBounds(screen.getPrimaryDisplay().bounds)
    })
    forwardConsole(this.win, 'оверлей')
    loadPage(this.win, 'overlay')
  }

  /** Перед каждым уведомлением поднимаемся над окном игры */
  raise(): void {
    if (this.win.isDestroyed()) return
    if (!this.win.isVisible()) this.win.showInactive()
    forceTopmost(this.hwnd)
  }
}

let quitting = false
export function markQuitting(): void {
  quitting = true
}
