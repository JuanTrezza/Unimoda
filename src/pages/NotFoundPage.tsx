import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'

export function NotFoundPage() {
  return (
    <div className="container-site flex flex-col items-center py-24 text-center md:py-32">
      <Seo title="Página no encontrada" description="La página que buscás no existe o se movió." />
      <p className="font-serif text-[7rem] leading-none text-terracota md:text-[10rem]" aria-hidden="true">
        404
      </p>
      <h1 className="mt-4 font-serif text-3xl md:text-4xl">Esta página se fue de temporada</h1>
      <p className="mt-4 max-w-md text-tinta-soft">
        No encontramos lo que buscabas. Puede que el link esté mal escrito o que la prenda ya no esté disponible.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary">
          Volver al inicio
        </Link>
        <Link to="/tienda" className="btn-outline">
          Ir a la tienda
        </Link>
      </div>
    </div>
  )
}
