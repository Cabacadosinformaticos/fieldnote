import { useRef } from 'react'
import { CheckIcon } from '../icons'
import { ChevronDownIcon } from './EntryIcons'

export type FilterOption = {
  value: string
  label: string
}

type FilterMenuProps = {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

export default function FilterMenu({ label, value, options, onChange }: FilterMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const selected = options.find((option) => option.value === value)

  function pick(next: string) {
    onChange(next)
    detailsRef.current?.removeAttribute('open')
  }

  return (
    <details className="en-filter" ref={detailsRef}>
      <summary className="en-filter-button">
        <span className="en-filter-label">{label}</span>
        <span className="en-filter-value">{selected?.label ?? value}</span>
        <ChevronDownIcon width={16} height={16} className="en-filter-chevron" />
      </summary>
      <div className="en-filter-menu" role="listbox" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            className={option.value === value ? 'is-selected' : undefined}
            onClick={() => pick(option.value)}
          >
            <span>{option.label}</span>
            {option.value === value ? <CheckIcon width={16} height={16} /> : null}
          </button>
        ))}
      </div>
    </details>
  )
}
