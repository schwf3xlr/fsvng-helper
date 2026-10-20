// Вызовы WinAPI через koffi: эмуляция клавиатуры (как Send в AHK), активное окно,
// порядок окон. В процесс игры ничего не внедряется.
import koffi from 'koffi'

const user32 = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')
const shell32 = koffi.load('shell32.dll')

const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
  wVk: 'uint16_t',
  wScan: 'uint16_t',
  dwFlags: 'uint32_t',
  time: 'uint32_t',
  dwExtraInfo: 'uintptr_t'
})

// MOUSEINPUT нужен только чтобы union был нужного размера (sizeof(INPUT) = 40 на x64)
const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
  dx: 'int32_t',
  dy: 'int32_t',
  mouseData: 'uint32_t',
  dwFlags: 'uint32_t',
  time: 'uint32_t',
  dwExtraInfo: 'uintptr_t'
})

const INPUT = koffi.struct('INPUT', {
  type: 'uint32_t',
  u: koffi.union({ mi: MOUSEINPUT, ki: KEYBDINPUT })
})

// HWND передаём как число: так его можно хранить и сравнивать
const SendInput = user32.func('SendInput', 'uint32_t', ['uint32_t', koffi.pointer(INPUT), 'int32_t'])
const MapVirtualKeyW = user32.func('MapVirtualKeyW', 'uint32_t', ['uint32_t', 'uint32_t'])
const GetAsyncKeyState = user32.func('GetAsyncKeyState', 'int16_t', ['int32_t'])
const GetForegroundWindow = user32.func('GetForegroundWindow', 'uintptr_t', [])
const SetForegroundWindow = user32.func('SetForegroundWindow', 'bool', ['uintptr_t'])
const BringWindowToTop = user32.func('BringWindowToTop', 'bool', ['uintptr_t'])
const IsWindow = user32.func('IsWindow', 'bool', ['uintptr_t'])
const GetWindowThreadProcessId = user32.func('GetWindowThreadProcessId', 'uint32_t', ['uintptr_t', 'uint32_t *'])
const AttachThreadInput = user32.func('AttachThreadInput', 'bool', ['uint32_t', 'uint32_t', 'bool'])
const GetClassNameW = user32.func('GetClassNameW', 'int32_t', ['uintptr_t', 'void *', 'int32_t'])
const SetWindowPos = user32.func('SetWindowPos', 'bool', [
  'uintptr_t',
  'intptr_t',
  'int32_t',
  'int32_t',
  'int32_t',
  'int32_t',
  'uint32_t'
])
const GetCurrentThreadId = kernel32.func('GetCurrentThreadId', 'uint32_t', [])
const OpenProcess = kernel32.func('OpenProcess', 'void *', ['uint32_t', 'bool', 'uint32_t'])
const QueryFullProcessImageNameW = kernel32.func('QueryFullProcessImageNameW', 'bool', [
  'void *',
  'uint32_t',
  'void *',
  'uint32_t *'
])
const CloseHandle = kernel32.func('CloseHandle', 'bool', ['void *'])
const SHQueryUserNotificationState = shell32.func('SHQueryUserNotificationState', 'int32_t', ['int32_t *'])
const IsUserAnAdmin = shell32.func('IsUserAnAdmin', 'bool', [])
const RECT = koffi.struct('RECT', { left: 'int32_t', top: 'int32_t', right: 'int32_t', bottom: 'int32_t' })
const GetWindowRect = user32.func('GetWindowRect', 'bool', ['uintptr_t', koffi.out(koffi.pointer(RECT))])

const INPUT_KEYBOARD = 1
const KEYEVENTF_KEYUP = 0x0002
const KEYEVENTF_UNICODE = 0x0004
const MAPVK_VK_TO_VSC = 0
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const HWND_TOPMOST = -1
const HWND_NOTOPMOST = -2
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010
const QUNS_RUNNING_D3D_FULL_SCREEN = 3
const INPUT_SIZE = koffi.sizeof(INPUT)

export type Hwnd = number | bigint

export const VK = {
  Enter: 0x0d,
  Shift: 0x10,
  Ctrl: 0x11,
  Alt: 0x12,
  Escape: 0x1b,
  LWin: 0x5b,
  RWin: 0x5c,
  V: 0x56
} as const

/** Имя клавиши из настроек ("T", "Enter", "F3", "7") → виртуальный код Windows */
export function vkFromName(name: string): number {
  const n = name.trim()
  if (/^[A-Za-z]$/.test(n)) return n.toUpperCase().charCodeAt(0)
  if (/^[0-9]$/.test(n)) return n.charCodeAt(0)
  const f = /^F([1-9]|1[0-9]|2[0-4])$/i.exec(n)
  if (f) return 0x70 + Number(f[1]) - 1
  const named: Record<string, number> = {
    enter: VK.Enter,
    escape: VK.Escape,
    esc: VK.Escape,
    space: 0x20,
    tab: 0x09,
    backquote: 0xc0,
    slash: 0xbf
  }
  const vk = named[n.toLowerCase()]
  if (vk === undefined) throw new Error(`Неизвестная клавиша «${name}»`)
  return vk
}

function keyInput(vk: number, up: boolean) {
  return {
    type: INPUT_KEYBOARD,
    u: {
      ki: {
        wVk: vk,
        // Игры часто смотрят на скан-код, поэтому отправляем и его — как AHK
        wScan: MapVirtualKeyW(vk, MAPVK_VK_TO_VSC),
        dwFlags: up ? KEYEVENTF_KEYUP : 0,
        time: 0,
        dwExtraInfo: 0
      }
    }
  }
}

function unicodeInput(codeUnit: number, up: boolean) {
  return {
    type: INPUT_KEYBOARD,
    u: {
      ki: {
        wVk: 0,
        wScan: codeUnit,
        dwFlags: KEYEVENTF_UNICODE | (up ? KEYEVENTF_KEYUP : 0),
        time: 0,
        dwExtraInfo: 0
      }
    }
  }
}

function send(inputs: object[]): void {
  if (inputs.length === 0) return
  const sent = SendInput(inputs.length, inputs, INPUT_SIZE)
  if (sent !== inputs.length) {
    throw new Error(`SendInput отправил ${sent} из ${inputs.length} событий`)
  }
}

export function tapKey(vk: number): void {
  send([keyInput(vk, false), keyInput(vk, true)])
}

export function releaseKey(vk: number): void {
  send([keyInput(vk, true)])
}

/** Ctrl+V */
export function paste(): void {
  send([keyInput(VK.Ctrl, false), keyInput(VK.V, false), keyInput(VK.V, true), keyInput(VK.Ctrl, true)])
}

/** Печатает текст юникод-символами — раскладка клавиатуры не важна */
export function typeText(text: string): void {
  const inputs: object[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    inputs.push(unicodeInput(code, false), unicodeInput(code, true))
  }
  send(inputs)
}

export function isKeyDown(vk: number): boolean {
  return (GetAsyncKeyState(vk) & 0x8000) !== 0
}

function readWide(buf: Buffer, chars: number): string {
  return buf.toString('utf16le', 0, Math.max(0, chars) * 2)
}

function processExe(pid: number): string {
  const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
  if (!handle) return ''
  try {
    const buf = Buffer.alloc(1024)
    const size = new Uint32Array([512])
    if (!QueryFullProcessImageNameW(handle, 0, buf, size)) return ''
    const full = readWide(buf, size[0])
    return full.slice(full.lastIndexOf('\\') + 1)
  } finally {
    CloseHandle(handle)
  }
}

export interface ForegroundWindow {
  hwnd: Hwnd
  exe: string
  className: string
}

export function getForeground(): ForegroundWindow | null {
  const hwnd = GetForegroundWindow()
  if (!hwnd) return null
  const buf = Buffer.alloc(512)
  const className = readWide(buf, GetClassNameW(hwnd, buf, 256))
  const pid = new Uint32Array(1)
  GetWindowThreadProcessId(hwnd, pid)
  return { hwnd, exe: pid[0] ? processExe(pid[0]) : '', className }
}

export function foregroundHwnd(): Hwnd {
  return GetForegroundWindow()
}

/** HWND окна Electron из getNativeWindowHandle() */
export function hwndFromHandle(handle: Buffer): Hwnd {
  return handle.length >= 8 ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0)
}

/** Поднять окно поверх всех, включая окно игры, не забирая фокус */
export function forceTopmost(hwnd: Hwnd): void {
  SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
}

/** Снять «поверх всех», оставив окно наверху среди обычных */
export function clearTopmost(hwnd: Hwnd): void {
  SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
}

/**
 * Сделать окно активным. Windows не даёт фоновому процессу забрать фокус,
 * поэтому на время подключаемся к вводу текущего активного окна.
 */
export function forceForeground(hwnd: Hwnd): boolean {
  if (!hwnd || !IsWindow(hwnd)) return false
  const current = GetForegroundWindow()
  if (current && current == hwnd) return true
  const currentThread = current ? GetWindowThreadProcessId(current, null) : 0
  const ownThread = GetCurrentThreadId()
  const attach = currentThread !== 0 && currentThread !== ownThread
  if (attach) AttachThreadInput(ownThread, currentThread, true)
  try {
    BringWindowToTop(hwnd)
    return SetForegroundWindow(hwnd)
  } finally {
    if (attach) AttachThreadInput(ownThread, currentThread, false)
  }
}

/** Процесс запущен с правами администратора */
export function isElevated(): boolean {
  try {
    return IsUserAnAdmin()
  } catch {
    return false
  }
}

/** Прямоугольник окна в физических пикселях экрана */
export function windowRect(hwnd: Hwnd): { x: number; y: number; width: number; height: number } | null {
  const r: { left?: number; top?: number; right?: number; bottom?: number } = {}
  if (!GetWindowRect(hwnd, r) || r.left === undefined) return null
  return { x: r.left, y: r.top!, width: r.right! - r.left, height: r.bottom! - r.top! }
}

/** Запущено полноэкранное Direct3D-приложение — поверх него окна не видны */
export function isD3DFullscreen(): boolean {
  const state = new Int32Array(1)
  if (SHQueryUserNotificationState(state) !== 0) return false
  return state[0] === QUNS_RUNNING_D3D_FULL_SCREEN
}
