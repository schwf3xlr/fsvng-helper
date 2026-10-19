// Глобальные хоткеи через низкоуровневый хук клавиатуры (uiohook-napi).
// Работают, когда активна игра. Клавиши не блокируются — игра их тоже получает.
import { uIOhook, UiohookKey, type UiohookKeyboardEvent } from 'uiohook-napi'

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

export class HotkeyManager {
  private bindings: Binding[] = []
  private held = new Set<number>()
  private started = false
  /** Окно записывает новый хоткей — ничего не запускаем */
  suspended = false

  set(bindings: Binding[]): void {
    this.bindings = bindings
  }

  start(): void {
    if (this.started) return
    uIOhook.on('keydown', (e) => {
      // Автоповтор при удержании клавиши не должен запускать действие повторно
      if (this.held.has(e.keycode)) return
      this.held.add(e.keycode)
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
  }

  stop(): void {
    if (!this.started) return
    uIOhook.stop()
    this.started = false
  }
}
