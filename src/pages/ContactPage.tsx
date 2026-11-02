import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Seo } from '../components/Seo'
import { Icon } from '../components/ui/Icon'

interface FormValues {
  nombre: string
  email: string
  motivo: string
  mensaje: string
}

type Errors = Partial<Record<keyof FormValues, string>>

const EMPTY: FormValues = { nombre: '', email: '', motivo: '', mensaje: '' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const MOTIVOS = ['Consulta sobre un producto', 'Estado de mi pedido', 'Cambios y devoluciones', 'Ventas mayoristas', 'Otro']

function validate(v: FormValues): Errors {
  const e: Errors = {}
  if (v.nombre.trim().length < 2) e.nombre = 'Ingresá tu nombre.'
  if (!v.email.trim()) e.email = 'Ingresá tu email.'
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Revisá el formato del email (por ejemplo, nombre@mail.com).'
  if (!v.motivo) e.motivo = 'Elegí un motivo.'
  if (v.mensaje.trim().length < 10) e.mensaje = 'Contanos un poco más (mínimo 10 caracteres).'
  return e
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: keyof FormValues
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label} <span aria-hidden="true" className="text-terracota-dark">*</span>
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-2 flex items-center gap-1.5 text-sm text-terracota-dark">
          <Icon name="info" size={16} /> {error}
        </p>
      )}
    </div>
  )
}

export function ContactPage() {
  const [values, setValues] = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)

  const set = (key: keyof FormValues) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    if (errors[key]) setErrors((err) => ({ ...err, [key]: undefined }))
  }

  const a11y = (key: keyof FormValues) => ({
    id: key,
    name: key,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
    'aria-required': true,
  })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    const firstInvalid = (Object.keys(found) as (keyof FormValues)[])[0]
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`#${firstInvalid}`)?.focus()
      return
    }
    setSending(true)
    // Etapa 2: enviar a Supabase / servicio de email
    await new Promise((r) => setTimeout(r, 600))
    setSending(false)
    setSent(true)
    requestAnimationFrame(() => confirmRef.current?.focus())
  }

  return (
    <div className="container-site pb-20 pt-8 md:pt-12">
      <Seo
        title="Contacto"
        description="Contactá a Unimoda. Te ayudamos con productos, envíos y cambios. Atención de lunes a viernes de 9 a 18 h."
      />
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="eyebrow">Contacto</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">Estamos para ayudarte</h1>
          <p className="mt-5 text-tinta-soft">
            Escribinos por consultas de talles, envíos o cambios. Respondemos en menos de 24 horas hábiles.
          </p>
          <ul className="mt-10 space-y-6">
            <li className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracota-50 text-terracota-dark">
                <Icon name="whatsapp" />
              </span>
              <div>
                <p className="font-medium">WhatsApp</p>
                <a href="https://wa.me/5491112345678" target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
                  +54 9 11 1234-5678
                </a>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracota-50 text-terracota-dark">
                <Icon name="mail" />
              </span>
              <div>
                <p className="font-medium">Email</p>
                <a href="mailto:hola@unimoda.com.ar" className="text-sm underline underline-offset-4">
                  hola@unimoda.com.ar
                </a>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracota-50 text-terracota-dark">
                <Icon name="clock" />
              </span>
              <div>
                <p className="font-medium">Horario</p>
                <p className="text-sm text-tinta-soft">Lunes a viernes de 9 a 18 h</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          {sent ? (
            <div
              ref={confirmRef}
              tabIndex={-1}
              role="status"
              className="flex flex-col items-start rounded-sm bg-crema-200/70 p-8 outline-none md:p-12"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-terracota text-white">
                <Icon name="check" />
              </span>
              <h2 className="mt-6 font-serif text-3xl">¡Gracias, {values.nombre.trim().split(' ')[0]}!</h2>
              <p className="mt-3 text-tinta-soft">
                Recibimos tu mensaje y te vamos a responder a <strong className="text-tinta">{values.email}</strong> dentro de
                las próximas 24 horas hábiles.
              </p>
              <button
                type="button"
                className="btn-outline mt-8"
                onClick={() => {
                  setValues(EMPTY)
                  setSent(false)
                }}
              >
                Enviar otro mensaje
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6 rounded-sm bg-crema-50 p-6 md:p-10">
              <p className="text-sm text-tinta-muted">
                Los campos con <span className="text-terracota-dark">*</span> son obligatorios.
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field id="nombre" label="Nombre" error={errors.nombre}>
                  <input {...a11y('nombre')} type="text" autoComplete="name" value={values.nombre} onChange={set('nombre')} className="input" />
                </Field>
                <Field id="email" label="Email" error={errors.email}>
                  <input
                    {...a11y('email')}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={values.email}
                    onChange={set('email')}
                    className="input"
                  />
                </Field>
              </div>
              <Field id="motivo" label="Motivo" error={errors.motivo}>
                <div className="relative">
                  <select {...a11y('motivo')} value={values.motivo} onChange={set('motivo')} className="input appearance-none pr-10">
                    <option value="">Elegí una opción</option>
                    {MOTIVOS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <Icon name="chevronDown" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </Field>
              <Field id="mensaje" label="Mensaje" error={errors.mensaje}>
                <textarea {...a11y('mensaje')} rows={6} value={values.mensaje} onChange={set('mensaje')} className="input py-3" />
              </Field>
              <button type="submit" className="btn-primary w-full sm:w-auto" disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
