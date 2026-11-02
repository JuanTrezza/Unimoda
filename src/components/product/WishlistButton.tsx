import { useWishlist } from '../../store/wishlist'
import { toast } from '../../store/toast'
import { cn } from '../../lib/format'
import { Icon } from '../ui/Icon'
import type { Product } from '../../types'

interface Props {
  product: Product
  className?: string
  variant?: 'overlay' | 'outline'
}

export function WishlistButton({ product, className, variant = 'overlay' }: Props) {
  const active = useWishlist((s) => s.productIds.includes(product.id))
  const toggle = useWishlist((s) => s.toggle)

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}
      onClick={() => {
        const added = toggle(product.id)
        toast(added ? `${product.name} se guardó en favoritos` : `${product.name} se quitó de favoritos`, {
          tone: 'info',
        })
      }}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
        variant === 'overlay'
          ? 'bg-crema-50/90 text-tinta backdrop-blur hover:bg-crema-50'
          : 'border border-tinta/20 hover:border-tinta',
        active && 'text-terracota',
        className,
      )}
    >
      <Icon name="heart" filled={active} />
    </button>
  )
}
