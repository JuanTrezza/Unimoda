import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { selectCartCount, useCart } from '../../store/cart'
import { useWishlist } from '../../store/wishlist'
import { CATEGORIES } from '../../data/products'
import { cn, formatPrice, FREE_SHIPPING_FROM } from '../../lib/format'
import { Icon } from '../ui/Icon'
import { Drawer } from '../ui/Drawer'
import { Modal } from '../ui/Modal'

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/tienda', label: 'Tienda', end: false },
  { to: '/nosotros', label: 'Nosotros', end: false },
  { to: '/contacto', label: 'Contacto', end: false },
]

function Badge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span
      className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-terracota px-1 text-[10px] font-semibold text-white"
      aria-hidden="true"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function Header() {
  const cartCount = useCart(selectCartCount)
  const openCart = useCart((s) => s.open)
  const wishCount = useWishlist((s) => s.productIds.length)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')?.toString().trim() ?? ''
    setSearchOpen(false)
    navigate(q ? `/tienda?q=${encodeURIComponent(q)}` : '/tienda')
  }

  return (
    <>
      <div className="bg-tinta px-4 py-2 text-center text-xs tracking-wide text-crema-50">
        Envío gratis desde {formatPrice(FREE_SHIPPING_FROM)} · 6 cuotas sin interés
      </div>
      <header className="sticky top-0 z-40 border-b border-tinta/10 bg-crema/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-site items-center justify-between gap-2 px-4 sm:px-6 lg:h-20 lg:px-10">
          <div className="flex flex-1 items-center gap-1 lg:hidden">
            <button type="button" className="btn-icon -ml-2" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>
              <Icon name="menu" />
            </button>
          </div>

          <nav aria-label="Principal" className="hidden flex-1 lg:block">
            <ul className="flex gap-8">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex min-h-11 items-center text-sm tracking-wide underline-offset-8 hover:underline',
                        isActive && 'underline decoration-terracota decoration-2',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <Link to="/" className="font-serif text-2xl tracking-tight lg:text-3xl" aria-label="Unimoda, ir al inicio">
            Unimoda
          </Link>

          <div className="flex flex-1 items-center justify-end">
            <button type="button" className="btn-icon" aria-label="Buscar" onClick={() => setSearchOpen(true)}>
              <Icon name="search" />
            </button>
            <Link
              to="/favoritos"
              className="btn-icon relative"
              aria-label={`Favoritos${wishCount ? `, ${wishCount} ${wishCount === 1 ? 'producto' : 'productos'}` : ''}`}
            >
              <Icon name="heart" />
              <Badge count={wishCount} />
            </Link>
            <button
              type="button"
              className="btn-icon relative -mr-2"
              onClick={openCart}
              aria-label={`Abrir carrito${cartCount ? `, ${cartCount} ${cartCount === 1 ? 'producto' : 'productos'}` : ''}`}
              data-testid="cart-button"
            >
              <Icon name="bag" />
              <Badge count={cartCount} />
            </button>
          </div>
        </div>
      </header>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menú" side="left" widthClass="max-w-xs">
        <nav aria-label="Menú mobile" className="px-5 py-4">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn('flex min-h-12 items-center font-serif text-2xl', isActive && 'text-terracota')
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <p className="eyebrow mt-8">Categorías</p>
          <ul className="mt-2">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/tienda?categoria=${c.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center text-sm"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Drawer>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Buscar">
        <form role="search" onSubmit={onSearch} className="flex gap-2">
          <label htmlFor="header-search" className="sr-only">
            Buscar productos
          </label>
          <input
            id="header-search"
            name="q"
            type="search"
            data-autofocus
            placeholder="Vestido, lino, tejido…"
            className="input flex-1"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary">
            Buscar
          </button>
        </form>
      </Modal>
    </>
  )
}
