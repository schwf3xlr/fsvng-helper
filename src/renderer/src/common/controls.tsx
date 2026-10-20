// Свои выпадающие списки и ползунки вместо системных: системные выглядят чужеродно
// на тёмной теме и не красятся в цвет приложения.
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './ui'

export interface Option<T extends string> {
  value: T
  label: string
  hint?: string
}

/** Закрыть всплывающий список по клику мимо поля и самого списка */
function useOutside(refs: React.RefObject<HTMLElement | null>[], open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!refs.some((r) => r.current?.contains(e.target as Node))) onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [refs, open, onClose])
}

/**
 * Список рисуется в корне страницы поверх всего — его не перекрывают соседние карточки
 * и не обрезает прокрутка панели. Встаёт под полем или над ним, если внизу тесно.
 */
function OptionList<T extends string>({
  id,
  anchor,
  listRef,
  options,
  value,
  active,
  onPick,
  onHover
}: {
  id: string
  anchor: React.RefObject<HTMLElement | null>
  listRef: React.RefObject<HTMLUListElement | null>
  options: Option<T>[]
  value: string
  active: number
  onPick: (v: T) => void
  onHover: (i: number) => void
}) {
  const [pos, setPos] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const el = anchor.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Панель в игре увеличена через CSS zoom — список увеличиваем так же
      const z = el.offsetWidth ? r.width / el.offsetWidth : 1
      const below = window.innerHeight - r.bottom
      const up = below < 220 && r.top > below
      setPos({
        zoom: z,
        left: r.left / z,
        width: r.width / z,
        maxHeight: Math.min(280, (up ? r.top : below) - 14) / z,
        ...(up ? { bottom: (window.innerHeight - r.top + 6) / z } : { top: (r.bottom + 6) / z })
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listRef, pos])

  return createPortal(
    <ul ref={listRef} id={id} role="listbox" className="dropdown" style={pos ?? { visibility: 'hidden' }}>
      {options.map((o, i) => (
        <li
          key={o.value}
          data-i={i}
          role="option"
          aria-selected={o.value === value}
          className={i === active ? 'active' : undefined}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onPick(o.value)}
          onMouseMove={() => onHover(i)}
        >
          <span className="grow">
            {o.label}
            {o.hint && <small>{o.hint}</small>}
          </span>
          {o.value === value && <Icon name="check" size={15} />}
        </li>
      ))}
    </ul>,
    document.body
  )
}

/** Выпадающий список с фиксированными вариантами */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
  style
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  label: string
  className?: string
  style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value)
  useOutside(useMemo(() => [box, list], []), open, useCallback(() => setOpen(false), []))

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const pick = (v: T) => {
    onChange(v)
    setOpen(false)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return show()
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open) pick(options[active].value)
      else show()
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={box} className={`select ${className}`} style={style}>
      <button
        type="button"
        className={`select-button${open ? ' open' : ''}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        <span className="grow">{current?.label ?? '—'}</span>
        <Icon name="down" size={16} />
      </button>
      {open && <OptionList id={listId} anchor={box} listRef={list} options={options} value={value} active={active} onPick={pick} onHover={setActive} />}
    </div>
  )
}

/** Поле ввода с подсказками: можно выбрать из списка или вписать своё */
export function Combo({
  value,
  options,
  onChange,
  label,
  placeholder
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  label: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [typed, setTyped] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  useOutside(useMemo(() => [box, list], []), open, useCallback(() => setOpen(false), []))

  // Пока пользователь не начал печатать — показываем весь список
  const q = value.trim().toLowerCase()
  const shown = (typed && q ? options.filter((o) => o.toLowerCase().includes(q)) : options).map((o) => ({ value: o, label: o }))

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setTyped(false)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (shown.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length)
    } else if (e.key === 'Enter' && open && active >= 0 && shown[active]) {
      e.preventDefault()
      pick(shown[active].value)
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div ref={box} className="select combo">
      <input
        ref={input}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        onFocus={() => {
          setTyped(false)
          setActive(options.indexOf(value))
          setOpen(true)
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value)
          setTyped(true)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={onKey}
      />
      <button
        type="button"
        className="combo-toggle"
        tabIndex={-1}
        aria-label={`Список: ${label}`}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open) return setOpen(false)
          // Фокус в поле: список откроется на текущем значении
          if (document.activeElement === input.current) setOpen(true)
          else input.current?.focus()
        }}
      >
        <Icon name="down" size={16} />
      </button>
      {open && shown.length > 0 && (
        <OptionList id={listId} anchor={box} listRef={list} options={shown} value={value} active={active} onPick={pick} onHover={setActive} />
      )}
    </div>
  )
}

/** Ползунок с заливкой, значением и метками */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  marks,
  resetTo,
  hint
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  /** Подписи под шкалой; клик — выбрать значение */
  marks?: number[]
  /** Значение по умолчанию — появляется кнопка «сбросить» */
  resetTo?: number
  hint?: ReactNode
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  return (
    <div className="slider">
      <div className="slider-head">
        <span className="grow">{label}</span>
        {resetTo !== undefined && value !== resetTo && (
          <button type="button" className="link-btn" onClick={() => onChange(resetTo)}>
            сбросить
          </button>
        )}
        <span className="slider-value">{format(value)}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${pct(value)}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {marks && (
        <div className="slider-marks" aria-hidden="true">
          {marks.map((m) => (
            <button key={m} type="button" tabIndex={-1} style={{ left: `${pct(m)}%` }} className={m === value ? 'on' : undefined} onClick={() => onChange(m)}>
              {format(m)}
            </button>
          ))}
        </div>
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}
