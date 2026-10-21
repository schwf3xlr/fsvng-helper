// Окна приложения:
//  - большое окно «ФСВНГ Helper» — обычное окно: настройка, памятки, законы. Поверх
//    других не висит — уходит назад, когда переключаешься в игру или другую программу;
//  - оверлей на весь экран игры: уведомления отыгровок и компактная панель. Только он
//    всегда поверх. Панель бывает видимой (фокус и мышь у игры) и активной (мышь у панели).
// Игра должна быть в режиме «Оконный без рамки»: поверх полноэкранного режима окна не видны.
import { app, BrowserWindow, screen, type Rectangle } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PanelMode, WindowMode } from '../shared/api'
import { clearTopmost, forceForeground, forceTopmost, foregroundHwnd, hwndFromHandle, setNoActivate, type Hwnd } from './win32'

const preload = () => join(__dirname, '../preload/index.js')
/**
 * .ico с размерами 16–256: Windows сама берёт нужный для панели задач и трея.
 * Читает его системный LoadImage, который не видит файлы внутри app.asar, —
 * поэтому иконка лежит распакованной рядом (asarUnpack в package.json).
 */
export const appIcon = () => join(__dirname, '../../resources/icon.ico').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')

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
      icon: appIcon(),
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

  configure(scalePercent: number): void {
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
      win.show()
      // Поднимаем над игрой и сразу снимаем «поверх»: дальше окно ведёт себя как обычное
      forceTopmost(this.hwnd)
      forceForeground(this.hwnd)
      win.focus()
      clearTopmost(this.hwnd)
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

}

// ---------- Оверлей: уведомления и панель ----------

export class OverlayWindow {
  readonly win: BrowserWindow
  readonly hwnd: Hwnd
  panel: PanelMode = 'hidden'
  private returnFocusTo: Hwnd | null = null
  private display = screen.getPrimaryDisplay()
  /** Chromium уже разрешено активировать окно (нужно для ввода в панели) */
  private canActivate = false

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

  /**
   * Видимая и скрытая панель не трогают фокус: игра остаётся активной, курсор не
   * появляется. Фокус панель берёт только в режиме «управлять» и отдаёт его обратно.
   *
   * BrowserWindow.setFocusable(false) здесь нельзя: Electron внутри делает активным
   * следующее окно под оверлеем (панель задач) — игра теряет фокус и показывает
   * курсор, а хоткеи перестают срабатывать, пока не щёлкнешь в игру.
   */
  setPanel(mode: PanelMode, returnFocus = true): void {
    const win = this.win
    // Сразу, до смены фокуса: обработчик blur не должен увидеть старый режим
    this.panel = mode
    if (mode === 'interactive' || mode === 'layout') {
      const fg = foregroundHwnd()
      if (fg && fg != this.hwnd) this.returnFocusTo = fg
      if (!this.canActivate) {
        // Один раз: разрешить Chromium активацию и ввод. Окно в панели задач не нужно
        this.canActivate = true
        win.setFocusable(true)
        win.setSkipTaskbar(true)
      }
      setNoActivate(this.hwnd, false)
      // Клики проходят насквозь, пока курсор не над панелью (см. setMouseOverPanel).
      // В расстановке мышь у оверлея по всему экрану
      if (mode === 'layout') win.setIgnoreMouseEvents(false)
      else win.setIgnoreMouseEvents(true, { forward: true })
      this.raise()
      forceForeground(this.hwnd)
      win.focus()
      win.webContents.focus()
    } else {
      const wasFocused = win.isFocused()
      win.setIgnoreMouseEvents(true)
      setNoActivate(this.hwnd, true)
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
