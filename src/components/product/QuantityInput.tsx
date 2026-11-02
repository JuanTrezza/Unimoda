import { Icon } from '../ui/Icon'

interface Props {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  size?: 'sm' | 'md'
}

export function QuantityInput({ value, min = 1, max, onChange, label, size = 'md' }: Props) {
  const h = size === 'sm' ? 'h-11' : 'h-12'
  return (
    <div className={`inline-flex items-center rounded-full border border-tinta/20 ${h}`} role="group" aria-label={label}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Restar uno"
      >
        <Icon name="minus" size={16} />
      </button>
      <span className="w-8 text-center text-sm tabular-nums" aria-live="polite" aria-atomic="true">
        <span className="sr-only">Cantidad: </span>
        {value}
      </span>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Sumar uno"
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}
