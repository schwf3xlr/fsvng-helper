import type { ReactNode } from 'react'
import { lawSource, type LawId } from '../../../shared/laws'

const PATHS = {
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <circle cx="12" cy="11" r="2.5" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  memo: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  toc: <path d="M5 6h14M5 12h14M5 18h9" />,
  warning: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </>
  ),
  upload: <path d="M12 15V4M7 9l5-5 5 5M5 20h14" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  trash: <path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  grip: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />,
  calc: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  checklist: (
    <>
      <path d="M4 6l2 2 3-3M4 13l2 2 3-3M4 20l2 2 3-3" />
      <path d="M12 7h8M12 14h8M12 21h8" />
    </>
  ),
  maximize: <rect x="5" y="5" width="14" height="14" rx="1.5" />,
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M14 4v16M16.5 8h2M16.5 11h2" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  cursor: <path d="M6 3l12 9-5 1 3 6-3 1.5-3-6-4 3.5z" />,
  admin: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  )
}

const FILLED = {
  play: <path d="M8 5l11 7-11 7z" />,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  bookmark: <path d="M6 4h12v17l-6-4-6 4z" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" />
}

export type IconName = keyof typeof PATHS | keyof typeof FILLED

export function Icon({ name, size = 18, filled }: { name: IconName; size?: number; filled?: boolean }) {
  if (name in FILLED) {
    const f = FILLED[name as keyof typeof FILLED]
    return filled === false ? (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        {f}
      </svg>
    ) : (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        {f}
      </svg>
    )
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name as keyof typeof PATHS]}
    </svg>
  )
}

/** Эмблема приложения: краповый щит с золотой звездой (как на иконке) */
export function Emblem({ size = 34 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" className="emblem">
      <defs>
        <linearGradient id="em-shield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C02A42" />
          <stop offset="1" stopColor="#6A1020" />
        </linearGradient>
        <linearGradient id="em-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4DA92" />
          <stop offset="1" stopColor="#C29236" />
        </linearGradient>
      </defs>
      <path
        d="M24 3.5l15 5.3v12c0 10-6.2 17.2-15 20.9C15.2 38 9 30.8 9 20.8v-12z"
        fill="url(#em-shield)"
        stroke="url(#em-gold)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M24 10.5l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3.1-5.4 3.1 1.2-6-4.4-4.1 6-.7z" fill="url(#em-gold)" />
      <path d="M15.5 25c1.5 5 4.5 8.4 8.5 10.4M32.5 25c-1.5 5-4.5 8.4-8.5 10.4" fill="none" stroke="url(#em-gold)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Kbd({ children, accent, className = '' }: { children: ReactNode; accent?: boolean; className?: string }) {
  return <kbd className={`kbd${accent ? ' accent' : ''} ${className}`}>{children}</kbd>
}

export function LawBadge({ law }: { law: LawId }) {
  return <span className={`law-badge ${law}`}>{lawSource(law).badge}</span>
}

export function Stars({ count }: { count?: number }) {
  if (!count) return null
  return (
    <span className="stars" title={`Уровень розыска по СПРП: ${count}`}>
      СПРП {'★'.repeat(count)}
    </span>
  )
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="alert" role="alert">
      <Icon name="warning" />
      <div className="alert-body">{children}</div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function plural(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return one
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few
  return many
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е')
}
