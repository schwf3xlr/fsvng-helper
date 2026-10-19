// Запись хоткея в окне. Имена клавиш совпадают с uiohook в main-процессе.
import { useEffect, useState } from 'react'
import { HOTKEY_ACTIONS, type Settings } from '../../../shared/settings'
import { api } from './store'

const NAMED_CODES = new Set([
  'Escape',
  'Tab',
  'Space',
  'Enter',
  'Backspace',
  'Insert',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Backquote',
  'Minus',
  'Equal',
  'BracketLeft',
  'BracketRight',
  'Backslash',
  'Semicolon',
  'Quote',
  'Comma',
  'Period',
  'Slash',
  'CapsLock',
  'ScrollLock',
  'PrintScreen'
])

function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code
  if (/^Numpad/.test(code)) return code
  if (NAMED_CODES.has(code)) return code
  return null
}

const MODIFIER_CODES = /^(Control|Alt|Shift|Meta)(Left|Right)$/

export function hotkeyFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.test(e.code)) return null
  const key = keyName(e.code)
  if (!key) return null
  return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', key].filter(Boolean).join('+')
}

/** Сравнение без учёта регистра и порядка модификаторов */
export function sameHotkey(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const norm = (s: string) => {
    const parts = s.toLowerCase().split('+').map((p) => p.trim())
    const key = parts.pop()
    return [...parts.sort(), key].join('+')
  }
  return norm(a) === norm(b)
}

export interface HotkeyOwner {
  kind: 'action' | 'bind'
  id: string
  label: string
}

/** Кто уже занял это сочетание */
export function findOwner(settings: Settings, hotkey: string | null, except?: { kind: string; id: string }): HotkeyOwner | null {
  if (!hotkey) return null
  for (const a of HOTKEY_ACTIONS) {
    if (except?.kind === 'action' && except.id === a.id) continue
    if (sameHotkey(settings.hotkeys[a.id], hotkey)) return { kind: 'action', id: a.id, label: a.label }
  }
  for (const b of settings.binds) {
    if (except?.kind === 'bind' && except.id === b.id) continue
    if (sameHotkey(b.hotkey, hotkey)) return { kind: 'bind', id: b.id, label: `отыгровкой «${b.name}»` }
  }
  return null
}

/**
 * Кнопка-клавиша: по клику ждёт нажатия. Esc — отмена, Backspace — убрать клавишу.
 * Пока ждёт, глобальные хоткеи приложения выключены.
 */
export function HotkeyButton({
  value,
  onChange,
  conflict,
  allowModifiers = true,
  label
}: {
  value: string | null
  onChange: (v: string | null) => void
  conflict?: boolean
  allowModifiers?: boolean
  label: string
}) {
  const [listening, setListening] = useState(false)

  useEffect(() => {
    if (!listening) return
    api.setHotkeyCapture(true)
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        setListening(false)
        return
      }
      if (e.code === 'Backspace' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        onChange(null)
        setListening(false)
        return
      }
      const hk = allowModifiers ? hotkeyFromEvent(e) : keyName(e.code)
      if (!hk) return
      onChange(hk)
      setListening(false)
    }
    const cancel = () => setListening(false)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', cancel)
      api.setHotkeyCapture(false)
    }
  }, [listening, allowModifiers, onChange])

  const cls = ['key-btn', listening && 'listening', !listening && conflict && 'conflict', !value && !listening && 'none']
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type="button"
      className={cls}
      aria-label={`${label}: ${listening ? 'нажмите клавишу' : value ?? 'не назначена'}`}
      title={listening ? 'Esc — отмена, Backspace — убрать' : 'Нажмите, чтобы назначить'}
      onClick={() => setListening((v) => !v)}
    >
      {listening ? 'Нажмите…' : (value?.replace(/\+/g, ' + ') ?? 'нет')}
    </button>
  )
}
