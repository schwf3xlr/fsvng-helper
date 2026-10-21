// Оверлей поверх игры: уведомления отыгровок, панель и режим расстановки, где их
// перетаскивают мышью по экрану
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type { Toast } from '../../../shared/api'
import { defaultSettings, toastAnchor } from '../../../shared/settings'
import { api, isDemo, useSettings, useStore } from '../common/store'
import { Icon, Kbd } from '../common/ui'
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

  if (!app) return null
  const layout = app.panel === 'layout'
  return (
    <>
      {layout && <LayoutBackdrop />}
      {layout ? <SampleToasts /> : <Toasts />}
      {app.panel !== 'hidden' && <Panel />}
    </>
  )
}

/** Стопка уведомлений прижата к точке привязки и растёт от края экрана */
function stackStyle(x: number, y: number): CSSProperties {
  const { ax, ay } = toastAnchor(x, y)
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-${ax}%, -${ay}%)`,
    alignItems: ax === 0 ? 'flex-start' : ax === 100 ? 'flex-end' : 'center',
    '--enter-x': ax === 0 ? '-16px' : ax === 100 ? '16px' : '0px',
    '--enter-y': ax === 50 ? (ay === 0 ? '-12px' : '12px') : '0px'
  } as CSSProperties
}

function ToastCard({ t }: { t: Toast & { leaving?: boolean } }) {
  return (
    <div className={`toast${t.leaving ? ' leaving' : ''}`} data-kind={t.kind}>
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
  )
}

function Toasts() {
  const o = useSettings().overlay
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
    <div className="stack" style={stackStyle(o.toastX, o.toastY)}>
      {items.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </div>
  )
}

// ---------- Расстановка ----------

const SAMPLES: Toast[] = [
  { id: 's1', kind: 'run', title: 'Показать жетон', text: 'Строка 1 из 1', progress: 0.6, hint: 'стоп End', ttl: 0 },
  { id: 's2', kind: 'ok', title: 'Права задержанного', text: 'Отправлено строк: 1', progress: 1, ttl: 0 }
]

/** Пример уведомлений, который перетаскивают мышью */
function SampleToasts() {
  const o = useSettings().overlay
  const patchSettings = useStore((s) => s.patchSettings)
  const box = useRef<HTMLDivElement>(null)
  const grab = useRef<{ dx: number; dy: number } | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  /** Прямоугольник стопки → точка привязки в процентах (та же логика, что у toastAnchor) */
  const anchorOf = (left: number, top: number) => {
    const el = box.current!
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const l = Math.min(Math.max(0, left), vw - w)
    const t = Math.min(Math.max(0, top), vh - h)
    const cx = l + w / 2
    const cy = t + h / 2
    const x = cx < vw / 3 ? l : cx > (vw * 2) / 3 ? l + w : cx
    const y = cy < vh / 2 ? t : t + h
    return { x: Math.round((x / vw) * 1000) / 10, y: Math.round((y / vh) * 1000) / 10 }
  }

  const down = (e: ReactPointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: ReactPointerEvent) => {
    if (!grab.current) return
    setPos(anchorOf(e.clientX - grab.current.dx, e.clientY - grab.current.dy))
  }
  const up = () => {
    if (grab.current && pos) patchSettings((s) => ({ ...s, overlay: { ...s.overlay, toastX: pos.x, toastY: pos.y } }))
    grab.current = null
    setPos(null)
  }

  const x = pos?.x ?? o.toastX
  const y = pos?.y ?? o.toastY
  return (
    <div
      ref={box}
      className={`stack sample${pos ? ' dragging' : ''}`}
      style={stackStyle(x, y)}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
    >
      <span className="sample-label">
        <Icon name="grip" size={14} />
        Уведомления — тащите мышью
      </span>
      {SAMPLES.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </div>
  )
}

/** Затемнение, сетка и подсказка сверху; Esc или «Готово» — выйти */
function LayoutBackdrop() {
  const patchSettings = useStore((s) => s.patchSettings)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') api.panelAction('hidden')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const reset = () => {
    const def = defaultSettings().overlay
    patchSettings((s) => ({ ...s, overlay: { ...s.overlay, x: def.x, y: def.y, toastX: def.toastX, toastY: def.toastY } }))
  }

  return (
    <>
      <div className="layout-backdrop" aria-hidden="true" />
      <div className="layout-bar" role="toolbar" aria-label="Расстановка интерфейса">
        <span className="layout-title">Расстановка интерфейса</span>
        <span className="hint">Перетащите уведомления и панель куда удобно</span>
        <button type="button" className="btn small ghost" onClick={reset}>
          Вернуть как было
        </button>
        <button type="button" className="btn small primary" onClick={() => api.panelAction('hidden')}>
          <Icon name="check" size={15} />
          Готово
          <Kbd>Esc</Kbd>
        </button>
      </div>
    </>
  )
}
