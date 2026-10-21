// Карточки разной высоты без дыр: раскладываем по колонкам, каждую — в самую короткую.
// Порядок при этом остаётся построчным: 1, 2, 3 — в первом ряду, дальше куда влезает.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export function Masonry<T>({
  items,
  keyOf,
  render,
  minColumn = 330,
  gap = 12,
  layoutKey = ''
}: {
  items: T[]
  keyOf: (item: T) => string
  render: (item: T) => ReactNode
  /** Наименьшая ширина колонки, px */
  minColumn?: number
  gap?: number
  /** Поменялось содержимое карточек (не список) — разложить заново */
  layoutKey?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(1)
  const [layout, setLayout] = useState<{ sig: string; columns: number[] } | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setCols(Math.max(1, Math.floor((el.clientWidth + gap) / (minColumn + gap))))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [minColumn, gap])

  const keys = items.map(keyOf)
  const sig = `${cols}|${layoutKey}|${keys.join(',')}`
  // Пока не измерили — по кругу; ширина колонок та же, поэтому высоты верные
  const columns = layout?.sig === sig ? layout.columns : keys.map((_, i) => i % cols)

  useLayoutEffect(() => {
    if (layout?.sig === sig || !box.current) return
    const heights = new Map<string, number>()
    box.current.querySelectorAll<HTMLElement>('[data-mkey]').forEach((n) => heights.set(n.dataset.mkey!, n.offsetHeight))
    const sums = new Array<number>(cols).fill(0)
    const next = keys.map((k) => {
      const c = sums.indexOf(Math.min(...sums))
      sums[c] += (heights.get(k) ?? 0) + gap
      return c
    })
    setLayout({ sig, columns: next })
  })

  return (
    <div ref={box} className="masonry" style={{ gap }}>
      {Array.from({ length: cols }, (_, c) => (
        <div key={c} className="masonry-col" style={{ gap }}>
          {items.map((item, i) =>
            columns[i] === c ? (
              <div key={keys[i]} data-mkey={keys[i]} className="masonry-item" style={{ '--i': i } as CSSProperties}>
                {render(item)}
              </div>
            ) : null
          )}
        </div>
      ))}
    </div>
  )
}
