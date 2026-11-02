import { useId, useState, type FormEvent } from 'react'
import { toast } from '../store/toast'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function Newsletter() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputId = useId()
  const errorId = useId()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!value) return setError('Ingresá tu email.')
    if (!EMAIL_RE.test(value)) return setError('Revisá el formato del email (por ejemplo, nombre@mail.com).')
    setError('')
    setSubmitting(true)
    // Etapa 2: guardar la suscripción en Supabase
    await new Promise((r) => setTimeout(r, 500))
    setSubmitting(false)
    setEmail('')
    toast('¡Listo! Te vas a enterar primero de las novedades.')
  }

  return (
    <section aria-labelledby="newsletter-title" className="bg-crema-200">
      <div className="container-site grid gap-8 py-16 md:grid-cols-2 md:items-center md:py-20">
        <div>
          <p className="eyebrow">Newsletter</p>
          <h2 id="newsletter-title" className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
            Novedades, preventas y un 10% en tu primera compra
          </h2>
        </div>
        <form onSubmit={onSubmit} noValidate className="w-full">
          <label htmlFor={inputId} className="mb-2 block text-sm font-medium">
            Email
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id={inputId}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nombre@mail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError('')
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="input flex-1"
            />
            <button type="submit" className="btn-primary shrink-0" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Suscribirme'}
            </button>
          </div>
          <p id={errorId} className="mt-2 min-h-5 text-sm text-terracota-dark" aria-live="polite">
            {error}
          </p>
          <p className="text-xs text-tinta-muted">Podés darte de baja cuando quieras.</p>
        </form>
      </div>
    </section>
  )
}
