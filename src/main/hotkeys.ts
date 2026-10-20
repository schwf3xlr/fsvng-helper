// Глобальные хоткеи через низкоуровневый хук клавиатуры (uiohook-napi).
// Работают, когда активна игра. Клавиши не блокируются — игра их тоже получает.
//
// Windows молча снимает такой хук, если система не успела вызвать его вовремя (загрузка
// игры, нагрузка на процессор). Поэтому хук сторожит watchdog: если ввод в системе есть,
// а до хука ничего не доходит — хук ставится заново.
import { uIOhook, UiohookKey, type UiohookKeyboardEvent } from 'uiohook-napi'
import { msSinceLastInput } from './win32'

export interface Hotkey {
  key: number
  alt: boolean
  ctrl: boolean
  shift: boolean
  /** Срабатывать при любых зажатых модификаторах (для «стоп») */
  anyModifiers?: boolean
}

type KeyName = keyof typeof UiohookKey

const MODIFIERS: Record<string, 'alt' | 'ctrl' | 'shift'> = {
  alt: 'alt',
  ctrl: 'ctrl',
  control: 'ctrl',
  shift: 'shift'
}

const KEY_ALIASES: Record<string, KeyName> = {
  esc: 'Escape',
  return: 'Enter',
  del: 'Delete',
  ins: 'Insert',
  pgup: 'PageUp',
  pgdn: 'PageDown'
}

const KEY_NAMES = Object.keys(UiohookKey) as KeyName[]

/** "Alt+1", "Ctrl+Shift+K", "F3", "End" → Hotkey */
export function parseHotkey(text: string): Hotkey {
  const parts = text
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  const keyName = parts.pop()
  if (!keyName) throw new Error(`пустой хоткей «${text}»`)

  const hk: Hotkey = { key: 0, alt: false, ctrl: false, shift: false }
  for (const mod of parts) {
    const flag = MODIFIERS[mod.toLowerCase()]
    if (!flag) throw new Error(`неизвестный модификатор «${mod}» в «${text}»`)
    hk[flag] = true
  }

  const lower = keyName.toLowerCase()
  const name = KEY_ALIASES[lower] ?? KEY_NAMES.find((k) => String(k).toLowerCase() === lower)
  if (name === undefined) throw new Error(`неизвестная клавиша «${keyName}» в «${text}»`)
  hk.key = UiohookKey[name]
  return hk
}

/** Ключ для поиска конфликтов: одинаковые сочетания дают одинаковую строку */
export function hotkeyId(hk: Hotkey): string {
  return `${hk.ctrl ? 'C' : ''}${hk.alt ? 'A' : ''}${hk.shift ? 'S' : ''}${hk.key}`
}

function matches(hk: Hotkey, e: UiohookKeyboardEvent): boolean {
  if (e.keycode !== hk.key) return false
  if (hk.anyModifiers) return true
  return e.altKey === hk.alt && e.ctrlKey === hk.ctrl && e.shiftKey === hk.shift && !e.metaKey
}

export interface Binding {
  hotkey: Hotkey
  handler: () => void
}

/** Первый автоповтор приходит через 250–1000 мс, дальше — каждые ~30 мс */
const REPEAT_WINDOW_MS = 1100
/** Ввод был, а хук молчит дольше этого — хук снят */
const HOOK_SILENCE_MS = 2500
const WATCHDOG_MS = 2000
/** Не перезапускать хук чаще */
const RESTART_COOLDOWN_MS = 10_000

export class HotkeyManager {
  private bindings: Binding[] = []
  /** Зажатые клавиши: код → время последнего keydown */
  private held = new Map<number, number>()
  private started = false
  private lastHookEvent = Date.now()
  private lastRestart = 0
  private watchdog: NodeJS.Timeout | undefined
  /** Окно записывает новый хоткей — ничего не запускаем */
  suspended = false

  constructor(private readonly log: (message: string) => void = () => {}) {}

  set(bindings: Binding[]): void {
    this.bindings = bindings
  }

  start(): void {
    if (this.started) return
    // Любое событие хука (и движение мыши) — знак, что хук жив
    uIOhook.on('input', () => {
      this.lastHookEvent = Date.now()
    })
    uIOhook.on('keydown', (e) => {
      // Автоповтор при удержании не должен запускать действие повторно. Отпускание могло
      // потеряться (хук сняли, окно с правами) — поэтому старая запись не держит клавишу вечно
      const now = Date.now()
      const prev = this.held.get(e.keycode)
      this.held.set(e.keycode, now)
      if (prev !== undefined && now - prev < REPEAT_WINDOW_MS) return
      if (this.suspended) return
      for (const b of this.bindings) {
        if (matches(b.hotkey, e)) b.handler()
      }
    })
    uIOhook.on('keyup', (e) => {
      this.held.delete(e.keycode)
    })
    uIOhook.start()
    this.started = true
    this.lastHookEvent = Date.now()
    this.watchdog = setInterval(() => this.check(), WATCHDOG_MS)
  }

  /** Хук жив? Сравниваем последний ввод в системе с последним событием хука */
  private check(): void {
    const lastInputAt = Date.now() - msSinceLastInput()
    if (lastInputAt - this.lastHookEvent < HOOK_SILENCE_MS) return
    if (Date.now() - this.lastRestart < RESTART_COOLDOWN_MS) return
    this.restart('хук клавиатуры не получал ввод — Windows его сняла')
  }

  /** Поставить хук заново: после снятия Windows он сам не вернётся */
  restart(reason: string): void {
    if (!this.started) return
    this.lastRestart = Date.now()
    this.log(`перезапуск хука: ${reason}`)
    try {
      uIOhook.stop()
    } catch {
      // Уже остановлен
    }
    this.held.clear()
    uIOhook.start()
    this.lastHookEvent = Date.now()
  }

  /** Забыть зажатые клавиши — например, при смене активного окна */
  releaseAll(): void {
    this.held.clear()
  }

  stop(): void {
    if (!this.started) return
    clearInterval(this.watchdog)
    uIOhook.stop()
    this.started = false
  }
}
