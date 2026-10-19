// Окна приложения:
//  - большое окно «ФСВНГ Helper» — настройка, памятки, законы;
//  - оверлей на весь экран игры: уведомления отыгровок и компактная панель.
//    Панель бывает видимой (клики идут в игру) и активной (мышь и клавиатура).
// Игра должна быть в режиме «Оконный без рамки»: поверх полноэкранного режима окна не видны.
import { app, BrowserWindow, screen, type Rectangle } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PanelMode, WindowMode } from '../shared/api'
import { forceForeground, forceTopmost, foregroundHwnd, hwndFromHandle, type Hwnd } from './win32'

const preload = () => join(__dirname, '../preload/index.js')
const icon = () => join(__dirname, '../../resources/icon.png')

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

interface SavedBounds extends Partial<Rectangle> {
  maximized?: boolean
}

function savedBounds(): SavedBounds {
  try {
    if (existsSync(boundsFile())) return JSON.parse(readFileSync(boundsFile(), 'utf8')) as SavedBounds
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
    return b.x! < a.x + a.width - 80 && b.x! + (b.width ?? 600) > a.x + 80 && b.y! >= a.y - 10 && b.y! < a.y + a.height - 80
  })
}

// ---------- Большое окно ----------

export class MainWindow {
  readonly win: BrowserWindow
  readonly hwnd: Hwnd
  mode: WindowMode = 'hidden'
  /** Окно игры, которому вернуть фокус, когда наше окно скрывается */
  private returnFocusTo: Hwnd | null = null
  private alwaysOnTop = false

  constructor(private readonly onModeChange: (mode: WindowMode) => void) {
    const b = savedBounds()
    const onScreen = visibleOnScreen(b)
    const area = screen.getPrimaryDisplay().workAreaSize
    this.win = new BrowserWindow({
      width: b.width ?? Math.min(1240, area.width - 80),
      height: b.height ?? Math.min(800, area.height - 60),
      x: onScreen ? b.x : undefined,
      y: onScreen ? b.y : undefined,
      minWidth: 920,
      minHeight: 600,
      frame: false,
      show: false,
      backgroundColor: '#131113',
      title: 'ФСВНГ Helper',
      icon: icon(),
      webPreferences: { preload: preload(), contextIsolation: true, nodeIntegration: false, sandbox: false }
    })
    if (b.maximized) this.win.maximize()
    this.hwnd = hwndFromHandle(this.win.getNativeWindowHandle())
    forwardConsole(this.win, 'окно')

    let saveTimer: NodeJS.Timeout | undefined
    const saveBounds = () => {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        if (this.win.isDestroyed()) return
        const data: SavedBounds = { ...this.win.getNormalBounds(), maximized: this.win.isMaximized() }
        writeFileSync(boundsFile(), JSON.stringify(data))
      }, 500)
    }
    this.win.on('moved', saveBounds)
    this.win.on('resized', saveBounds)
    this.win.on('maximize', saveBounds)
    this.win.on('unmaximize', saveBounds)
    // Крестик прячет окно в трей, выход — через меню трея
    this.win.on('close', (e) => {
      if (!quitting) {
        e.preventDefault()
        this.setMode('hidden')
      }
    })
    loadPage(this.win, 'index')
  }

  configure(alwaysOnTop: boolean, scalePercent: number): void {
    this.alwaysOnTop = alwaysOnTop
    this.win.setAlwaysOnTop(alwaysOnTop, 'screen-saver')
    this.win.webContents.setZoomFactor(scalePercent / 100)
  }

  isFocused(): boolean {
    return this.win.isFocused()
  }

  toggleMaximize(): void {
    if (this.win.isMaximized()) this.win.unmaximize()
    else this.win.maximize()
  }

  setMode(mode: WindowMode): void {
    const win = this.win
    const wasFocused = win.isFocused()

    if (mode === 'active') {
      const fg = foregroundHwnd()
      if (fg && fg != this.hwnd) this.returnFocusTo = fg
      if (win.isMinimized()) win.restore()
      win.setAlwaysOnTop(this.alwaysOnTop, 'screen-saver')
      win.show()
      // Поверх игры поднимаем всегда, даже если «всегда поверх» выключено
      forceTopmost(this.hwnd)
      if (!this.alwaysOnTop) win.setAlwaysOnTop(false)
      forceForeground(this.hwnd)
      win.focus()
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

  keepOnTop(): void {
    if (this.mode === 'active' && this.alwaysOnTop) forceTopmost(this.hwnd)
  }
}

// ---------- Оверлей: уведомления и панель ----------

export class OverlayWindow {
  readonly win: BrowserWindow
  readonly hwnd: Hwnd
  panel: PanelMode = 'hidden'
  private returnFocusTo: Hwnd | null = null
  private display = screen.getPrimaryDisplay()

  constructor(private readonly onPanelChange: (mode: PanelMode) => void) {
    this.win = new BrowserWindow({
      ...this.display.bounds,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      enableLargerThanScreen: true,
      skipTaskbar: true,
      focusable: false,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      title: 'ФСВНГ Helper — оверлей',
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
    this.win.once('ready-to-show', () => {
      this.win.showInactive()
      this.fitDisplay()
    })
    screen.on('display-metrics-changed', () => this.fitDisplay())
    // Активная панель потеряла фокус (клик в игру, Alt+Tab) — снова пропускаем клики
    this.win.on('blur', () => {
      if (this.panel === 'interactive') this.setPanel('passive', false)
    })
    forwardConsole(this.win, 'оверлей')
    loadPage(this.win, 'overlay')
  }

  /** Весь экран, включая панель задач: Windows иначе урезает окно до рабочей области */
  private fitDisplay(): void {
    if (this.win.isDestroyed()) return
    this.win.setBounds(this.display.bounds)
  }

  /** Перейти на монитор, где запущена игра (прямоугольник окна — в физических пикселях) */
  followGame(rect: Rectangle): void {
    const dip = screen.screenToDipRect(null, rect)
    const display = screen.getDisplayMatching(dip)
    if (display.id !== this.display.id) {
      this.display = display
      this.fitDisplay()
    }
  }

  /** Перед уведомлением и при возврате в игру поднимаемся над окном игры */
  raise(): void {
    if (this.win.isDestroyed()) return
    if (!this.win.isVisible()) this.win.showInactive()
    forceTopmost(this.hwnd)
  }

  setPanel(mode: PanelMode, returnFocus = true): void {
    const win = this.win
    // Сразу, до смены фокуса: обработчик blur не должен увидеть старый режим
    this.panel = mode
    if (mode === 'interactive') {
      const fg = foregroundHwnd()
      if (fg && fg != this.hwnd) this.returnFocusTo = fg
      win.setFocusable(true)
      // Клики проходят насквозь, пока курсор не над панелью (см. setMouseOverPanel)
      win.setIgnoreMouseEvents(true, { forward: true })
      this.raise()
      forceForeground(this.hwnd)
      win.focus()
      win.webContents.focus()
    } else {
      const wasFocused = win.isFocused()
      win.setIgnoreMouseEvents(true)
      win.setFocusable(false)
      if (wasFocused && returnFocus && this.returnFocusTo) forceForeground(this.returnFocusTo)
      if (mode === 'passive') this.raise()
    }
    this.onPanelChange(mode)
  }

  setMouseOverPanel(over: boolean): void {
    if (this.panel !== 'interactive') return
    if (over) this.win.setIgnoreMouseEvents(false)
    else this.win.setIgnoreMouseEvents(true, { forward: true })
  }
}

let quitting = false
export function markQuitting(): void {
  quitting = true
}
