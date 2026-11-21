// Выполнение отыгровок: открыть чат, напечатать строки, закрыть чат — как в AHK,
// только текст берётся из шаблона и профиля игрока.
import { clipboard } from 'electron'
import type { Settings } from '../shared/settings'
import { VK, isKeyDown, paste, releaseKey, tapKey, typeText, vkFromName } from './win32'

export class BindCancelled extends Error {
  constructor(readonly reason: 'stop' | 'focus') {
    super(reason === 'stop' ? 'Остановлено' : 'Окно игры потеряло фокус')
  }
}

export interface RunLine {
  text: string
  delayMs: number
}

export interface RunHooks {
  /** Можно ли продолжать печатать (игра всё ещё активна) */
  canContinue: () => boolean
  onProgress: (done: number, total: number) => void
}

const MODIFIER_VKS = [VK.Alt, VK.Ctrl, VK.Shift, VK.LWin, VK.RWin]

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
- Ждём, пока игрок отпустит Alt/Ctrl/Shift от хоткея: иначе игра получит
- Alt+T вместо T. Если держит слишком долго — отпускаем модификаторы сами.
 */
async function waitModifiersReleased(timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!MODIFIER_VKS.some(isKeyDown)) return
    await sleep(15)
  }
  for (const vk of MODIFIER_VKS) if (isKeyDown(vk)) releaseKey(vk)
  await sleep(30)
}

export class BindRunner {
  private cancelRequested = false
  running: string | null = null

  cancel(): void {
    if (this.running) this.cancelRequested = true
  }

  async run(bindId: string, lines: RunLine[], enterAfterEach: boolean, chat: Settings['chat'], hooks: RunHooks): Promise<void> {
    if (this.running) return
    this.running = bindId
    this.cancelRequested = false
    const savedClipboard = chat.method === 'paste' ? await clipboard.readText() : null

    const checkpoint = () => {
      if (this.cancelRequested) throw new BindCancelled('stop')
      if (!hooks.canContinue()) throw new BindCancelled('focus')
    }

    try {
      await waitModifiersReleased()
      checkpoint()

      await tapKey(vkFromName(chat.openKey))
      await sleep(Math.max(chat.openDelayMs, 120))

      for (let i = 0; i < lines.length; i++) {
        checkpoint()
        if (chat.method === 'paste') {
          await clipboard.writeText(lines[i].text)
          await paste()
          // Игра читает буфер по Ctrl+V — даём ей время до Enter
          await sleep(100)
        } else {
          typeText(lines[i].text)
        }
        if (enterAfterEach) await tapKey(VK.Enter)
        hooks.onProgress(i + 1, lines.length)
        await sleep(lines[i].delayMs)
      }

      if (enterAfterEach && chat.closeWithEnter) {
        checkpoint()
        await tapKey(VK.Enter)
      }
    } finally {
      if (savedClipboard !== null) {
        // Вставка в игре могла ещё не прочитать буфер — возвращаем его чуть позже
        setTimeout(() => void clipboard.writeText(savedClipboard), 500)
      }
      this.running = null
    }
  }
}