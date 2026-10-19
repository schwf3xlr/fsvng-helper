// Оверлей поверх игры: уведомления отыгровок (слева) и панель (справа или где её поставили)
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Toast } from '../../../shared/api'
import { api, isDemo, useStore } from '../common/store'
import { Panel } from './Panel'

interface Item extends Toast {
  leaving: boolean
}

const DEFAULT_TTL = 3000
const LEAVE_MS = 240
const MAX = 3

export function Overlay() {
  const app = useStore((s) => s.app)

  useEffect(() => {
    if (isDemo) document.body.classList.add('demo')
    void useStore.getState().init()
  }, [])

  return (
    <>
      <Toasts />
      {app && app.panel !== 'hidden' && <Panel />}
    </>
  )
}

function Toasts() {
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

  useEffect(() => api.onToast(upsert), [upsert])

  return (
    <div className="stack">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.leaving ? ' leaving' : ''}`} data-kind={t.kind}>
          <div className="toast-row">
            <span className="toast-icon" aria-hidden="true">
              {t.kind === 'run' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5l11 7-11 7z" />
                </svg>
              ) : t.kind === 'ok' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
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
                {t.hint.split(' ')[0]} <kbd className="kbd">{t.hint.split(' ').slice(1).join(' ')}</kbd>
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
