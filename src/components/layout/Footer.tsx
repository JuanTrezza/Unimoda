import { Link } from 'react-router-dom'
import { CATEGORIES } from '../../data/categories'
import { Icon } from '../ui/Icon'

export function Footer() {
  return (
    <footer className="bg-tinta text-crema-100">
      <div className="mx-auto grid max-w-site gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
        <div>
          <p className="font-serif text-3xl">Unimoda</p>
          <p className="mt-3 max-w-xs text-sm text-crema-300">
            Moda femenina diseñada en Argentina. Prendas nobles, pensadas para durar.
          </p>
          <div className="mt-5 flex gap-1">
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
              className="btn-icon -ml-2 text-crema-100 hover:text-arena"
              aria-label="Instagram de Unimoda (abre en otra pestaña)"
            >
              <Icon name="instagram" />
            </a>
            <a
              href="https://wa.me/5491112345678"
              target="_blank"
              rel="noreferrer"
              className="btn-icon text-crema-100 hover:text-arena"
              aria-label="WhatsApp de Unimoda (abre en otra pestaña)"
            >
              <Icon name="whatsapp" />
            </a>
          </div>
        </div>
        <nav aria-label="Categorías">
          <p className="eyebrow text-arena">Tienda</p>
          <ul className="mt-3 text-sm">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <Link to={`/tienda?categoria=${c.id}`} className="inline-flex min-h-11 items-center hover:text-arena">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Ayuda">
          <p className="eyebrow text-arena">Ayuda</p>
          <ul className="mt-3 text-sm">
            <li>
              <Link to="/contacto" className="inline-flex min-h-11 items-center hover:text-arena">
                Contacto
              </Link>
            </li>
            <li>
              <Link to="/nosotros" className="inline-flex min-h-11 items-center hover:text-arena">
                Nosotros
              </Link>
            </li>
            <li>
              <Link to="/favoritos" className="inline-flex min-h-11 items-center hover:text-arena">
                Favoritos
              </Link>
            </li>
            <li>
              <Link to="/carrito" className="inline-flex min-h-11 items-center hover:text-arena">
                Carrito
              </Link>
            </li>
          </ul>
        </nav>
        <div className="text-sm">
          <p className="eyebrow text-arena">Atención</p>
          <ul className="mt-4 space-y-3 text-crema-300">
            <li className="flex gap-2">
              <Icon name="clock" size={18} className="mt-0.5 shrink-0" /> Lunes a viernes de 9 a 18 h
            </li>
            <li className="flex gap-2">
              <Icon name="mail" size={18} className="mt-0.5 shrink-0" /> hola@unimoda.com.ar
            </li>
            <li className="flex gap-2">
              <Icon name="pin" size={18} className="mt-0.5 shrink-0" /> Buenos Aires, Argentina
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-crema-50/10">
        <p className="mx-auto max-w-site px-4 py-6 text-xs text-crema-300 sm:px-6 lg:px-10">
          © {new Date().getFullYear()} Unimoda. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}
