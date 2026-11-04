import { useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { AuthCard, AuthNoticeBanner } from '../../components/auth/AuthCard'
import { EMAIL_RE, Field, FormAlert, fieldProps, focusFirstError } from '../../components/ui/FormField'
import { AccountError, requestPasswordReset } from '../../services/account'

export function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const confirmRef = useRef<HTMLParagraphElement>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    const found = !value
      ? 'Ingresá tu email.'
      : !EMAIL_RE.test(value)
        ? 'Revisá el formato del email (por ejemplo, nombre@mail.com).'
        : undefined
    setError(found)
    setFormError('')
    if (focusFirstError(formRef.current, { email: found })) return

    setSending(true)
    try {
      await requestPasswordReset(value)
      setSent(true)
      requestAnimationFrame(() => confirmRef.current?.focus())
    } catch (err) {
      setFormError(err instanceof AccountError ? err.message : 'No pudimos mandar el email. Probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthCard
      eyebrow="Tu cuenta"
      title="Olvidé mi contraseña"
      intro="Te mandamos un enlace para elegir una nueva."
      footer={
        <Link to="/ingresar" className="underline underline-offset-4">
          Volver a Ingresar
        </Link>
      }
    >
      <Seo title="Olvidé mi contraseña" description="Recuperá el acceso a tu cuenta de Unimoda." noindex />
      <AuthNoticeBanner notice={params.get('aviso')} />
      {sent ? (
        // Mismo mensaje exista o no la cuenta: no revelamos qué emails están registrados
        <p ref={confirmRef} tabIndex={-1} role="status" className="outline-none">
          Si hay una cuenta con <strong>{email.trim()}</strong>, te llega un email con el enlace. Abrilo desde este mismo
          navegador.
        </p>
      ) : (
        <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
          <Field id="email" label="Email" error={error}>
            <input
              {...fieldProps('email', error)}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(undefined)
              }}
              className="input"
            />
          </Field>
          <FormAlert message={formError} />
          <button type="submit" className="btn-primary w-full" disabled={sending}>
            {sending ? 'Enviando…' : 'Mandarme el enlace'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}
