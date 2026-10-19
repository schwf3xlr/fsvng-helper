// Оверлей поверх игры: карточки отыгровок и предупреждения (слева, под чатом)
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Toast } from '../../../shared/api'

interface Item extends Toast {
  leaving: boolean
}

const DEFAULT_TTL = 3000
const LEAVE_MS = 240
const MAX = 3

const DEMO: Toast[] = [
  { id: 'd1', kind: 'run', title: 'Показать жетон', text: 'Строка 1 из 1', progress: 1, hint: 'стоп End', ttl: 0 },
  { id: 'd2', kind: 'warn', title: 'Отыгровка не отправлена', text: 'Активное окно — Discord.exe, а не GTA.', ttl: 0 }
]

export function Overlay() {
  const [items, setItems] = useState<Item[]>([])
  const timers = useRef(new Map<string, number>())

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    window.setTimeout(() => setItems((list) => list.filter((t) => !(t.id === id && t.leaving))), LEAVE_MS)
  }, [])

  const upsert = useCallback(
    (toast: Toast) => {
      setItems((list) => {
        const item = { ...toast, leaving: false }
        const i = list.findIndex((t) => t.id === toast.id)
        if (i === -1) return [...list, item].slice(-MAX)
        const next = list.slice()
        next[i] = item
        return next
      })
      window.clearTimeout(timers.current.get(toast.id))
      const ttl = toast.ttl ?? DEFAULT_TTL
      if (ttl > 0) timers.current.set(toast.id, window.setTimeout(() => dismiss(toast.id), ttl))
    },
    [dismiss]
  )

  useEffect(() => {
    const api = window.overlay
    if (!api) {
      document.body.classList.add('demo')
      DEMO.forEach(upsert)
      return
    }
    const offToast = api.onToast(upsert)
    const offAccent = api.onAccent((accent) => {
      document.documentElement.style.setProperty('--accent', accent)
      document.documentElement.style.setProperty('--accent-soft', `${accent}2e`)
    })
    api.ready()
    return () => {
      offToast()
      offAccent()
    }
  }, [upsert])

  return (
    <div className="stack">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.leaving ? ' leaving' : ''}`} data-kind={t.kind}>
          <div className="toast-row">
            <span className="toast-icon" aria-hidden="true">
              {t.kind === 'run' || t.kind === 'ok' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  {t.kind === 'ok' ? <path d="M5 12l5 5 9-10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M8 5l11 7-11 7z" />}
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 7v6M12 17v.5" />
                </svg>
              )}
            </span>
            <div className="toast-body">
              <span className="toast-title">{t.title}</span>
              {t.text && <span className="toast-text">{t.text}</span>}
            </div>
            {t.hint && t.kind === 'run' && (
              <span className="toast-hint">
                {t.hint.split(' ')[0]} <kbd>{t.hint.split(' ').slice(1).join(' ')}</kbd>
              </span>
            )}
          </div>
          {(t.kind === 'run' || t.kind === 'ok') && (
            <div className="toast-bar" aria-hidden="true">
              <div style={{ width: `${Math.round((t.progress ?? 0) * 100)}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
