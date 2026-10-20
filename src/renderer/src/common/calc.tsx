// Общие кусочки калькулятора для окна и панели в игре
import { useState } from 'react'
import { MEASURE_LABEL, partLabel, type CalcPick } from './memos'
import { api, useStore } from './store'
import { Icon } from './ui'

/** Переключатель меры по статье: «срок / штраф», «штраф / арест» */
export function MeasureSwitch({ pick }: { pick: CalcPick }) {
  const toggleCalcAlt = useStore((s) => s.toggleCalcAlt)
  if (!pick.alternative) return <span className="measure-fixed">{MEASURE_LABEL[pick.measure]}</span>
  const order = ['prison', 'fine', 'arrest'] as const
  const options = order.filter((m) => m === pick.measure || m === pick.alternative)
  return (
    <span className="measure" role="group" aria-label={`Мера: ${partLabel(pick.item, pick.part)}`}>
      {options.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={pick.measure === m}
          onClick={(e) => {
            e.stopPropagation()
            if (pick.measure !== m) toggleCalcAlt(pick.part.key)
          }}
        >
          {MEASURE_LABEL[m]}
        </button>
      ))}
    </span>
  )
}

/** Кнопка «скопировать» с отметкой «скопировано» */
export function CopyButton({ text, label, className = 'btn small' }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        api.copyText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      {copied ? 'Скопировано' : label}
    </button>
  )
}
