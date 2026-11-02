import { cn, formatPrice, installment, INSTALLMENTS } from '../../lib/format'

interface PriceProps {
  price: number
  compareAtPrice?: number
  size?: 'sm' | 'lg'
  showInstallments?: boolean
}

export function Price({ price, compareAtPrice, size = 'sm', showInstallments = false }: PriceProps) {
  const off = compareAtPrice ? Math.round((1 - price / compareAtPrice) * 100) : 0
  return (
    <div>
      <p className={cn('flex flex-wrap items-baseline gap-x-2', size === 'lg' ? 'text-2xl' : 'text-sm')}>
        <span className="font-medium text-tinta">{formatPrice(price)}</span>
        {compareAtPrice && (
          <>
            <span className="sr-only">, antes </span>
            <s className={cn('text-tinta-muted', size === 'lg' ? 'text-base' : 'text-xs')}>{formatPrice(compareAtPrice)}</s>
            <span className={cn('font-medium text-terracota', size === 'lg' ? 'text-sm' : 'text-xs')}>{off}% OFF</span>
          </>
        )}
      </p>
      {showInstallments && (
        <p className={cn('text-tinta-muted', size === 'lg' ? 'mt-1 text-sm' : 'text-xs')}>
          {INSTALLMENTS} cuotas sin interés de {installment(price)}
        </p>
      )}
    </div>
  )
}
