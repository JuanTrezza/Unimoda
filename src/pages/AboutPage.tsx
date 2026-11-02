import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { EditorialPicture } from '../components/ui/EditorialPicture'
import { EDITORIAL } from '../data/editorial'

const VALUES = [
  { title: 'Hecho en Argentina', text: 'Diseñamos y producimos en talleres de Buenos Aires con los que trabajamos desde el primer día.' },
  { title: 'Telas nobles', text: 'Elegimos lino, algodón y fibras naturales que respiran, se sienten bien y envejecen lindo.' },
  { title: 'Menos, pero mejor', text: 'Colecciones cortas y prendas pensadas para combinarse entre sí, temporada tras temporada.' },
]

export function AboutPage() {
  return (
    <div className="pb-20">
      <Seo
        title="Nosotros"
        description="Unimoda es una marca de moda femenina argentina. Diseñamos prendas nobles, en talleres locales, pensadas para durar."
      />
      <section className="container-site grid gap-10 pt-8 md:grid-cols-2 md:items-center md:pt-16">
        <div>
          <p className="eyebrow">Nosotros</p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] md:text-6xl">
            Ropa para vivirla, <em className="font-light italic text-terracota">no para guardarla</em>.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-tinta-soft">
            Unimoda nació en 2019 de una idea simple: hacer prendas lindas, cómodas y bien terminadas, a un precio justo.
            Hoy vestimos a mujeres de todo el país sin perder la escala de taller.
          </p>
        </div>
        <div className="aspect-[4/5] overflow-hidden rounded-sm">
          <EditorialPicture image={EDITORIAL.nosotros} priority />
        </div>
      </section>

      <section aria-labelledby="values-title" className="container-site mt-24">
        <h2 id="values-title" className="sr-only">
          Lo que nos importa
        </h2>
        <ol className="grid gap-10 border-t border-tinta/15 pt-10 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <li key={v.title}>
              <span className="font-serif text-5xl text-terracota" aria-hidden="true">
                0{i + 1}
              </span>
              <h3 className="mt-4 font-serif text-2xl">{v.title}</h3>
              <p className="mt-2 leading-relaxed text-tinta-soft">{v.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-site mt-24 text-center">
        <p className="mx-auto max-w-3xl font-serif text-3xl leading-snug md:text-4xl">
          “Queremos que cada prenda te acompañe muchos años y se vuelva tu favorita.”
        </p>
        <Link to="/tienda" className="btn-primary mt-10">
          Conocé la colección
        </Link>
      </section>
    </div>
  )
}
