import { Link } from 'react-router-dom'
import type { CartLine } from '../../hooks/useCartLines'
import { MAX_PER_ITEM, useCart } from '../../store/cart'
import { toast } from '../../store/toast'
import { formatPrice } from '../../lib/format'
import { ProductImage } from '../product/ProductImage'
import { QuantityInput } from '../product/QuantityInput'

interface Props {
  line: CartLine
  onNavigate?: () => void
}

export function CartLineItem({ line, onNavigate }: Props) {
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)
  const add = useCart((s) => s.add)
  const { product, variant, color, quantity } = line
  const max = Math.min(variant.stock, MAX_PER_ITEM)
  const image = product.images[0]

  return (
    <li className="flex gap-4 py-5">
      <Link
        to={`/producto/${product.slug}`}
        onClick={onNavigate}
        className="block aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-sm bg-crema-200 sm:w-24"
        tabIndex={-1}
        aria-hidden="true"
      >
        {image && <ProductImage image={image} silhouette={product.silhouette} colorHex={color.hex} />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">
              <Link to={`/producto/${product.slug}`} onClick={onNavigate} className="hover:underline hover:underline-offset-4">
                {product.name}
              </Link>
            </h3>
            <p className="mt-0.5 text-xs text-tinta-muted">
              {color.name} · Talle {variant.size}
            </p>
          </div>
          <p className="shrink-0 text-sm tabular-nums">{formatPrice(line.lineTotal)}</p>
        </div>
        {quantity > 1 && <p className="text-xs text-tinta-muted">{formatPrice(line.unitPrice)} c/u</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <QuantityInput
            size="sm"
            value={quantity}
            max={max}
            onChange={(q) => setQuantity(variant.id, q)}
            label={`Cantidad de ${product.name}`}
          />
          <button
            type="button"
            className="min-h-11 px-2 text-xs text-tinta-muted underline underline-offset-4 hover:text-tinta"
            onClick={() => {
              remove(variant.id)
              toast(`Quitaste ${product.name} del carrito`, {
                tone: 'info',
                action: { label: 'Deshacer', onClick: () => add(variant.id, quantity, variant.stock) },
              })
            }}
          >
            Quitar<span className="sr-only"> {product.name}</span>
          </button>
        </div>
        {quantity >= max && <p className="mt-1 text-xs text-terracota-dark">Máximo disponible: {max}</p>}
      </div>
    </li>
  )
}
