import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { AuthCard, AuthNoticeBanner } from '../../components/auth/AuthCard'
import { safeReturnPath } from '../../components/auth/RequireAuth'
import { EMAIL_RE, Field, FormAlert, fieldProps, focusFirstError } from '../../components/ui/FormField'
import { AccountError, signIn } from '../../services/account'
import { useSession } from '../../store/session'

interface Errors {
  email?: string
  password?: string
}

export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const status = useSession((s) => s.status)
  const back = safeReturnPath(params.get('volver'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  const [sending, setSending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Con sesión (recién ingresada o ya logueada) se vuelve a donde estaba
  useEffect(() => {
    if (status === 'authenticated') navigate(back, { replace: true })
  }, [status, back, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found: Errors = {}
    if (!email.trim()) found.email = 'Ingresá tu email.'
    else if (!EMAIL_RE.test(email.trim())) found.email = 'Revisá el formato del email (por ejemplo, nombre@mail.com).'
    if (!password) found.password = 'Ingresá tu contraseña.'
    setErrors(found)
    setFormError('')
    if (focusFirstError(formRef.current, { ...found })) return

    setSending(true)
    try {
      await signIn(email, password)
      // La redirección la hace el efecto cuando llega SIGNED_IN
    } catch (err) {
      setFormError(err instanceof AccountError ? err.message : 'No pudimos ingresar. Probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const registerLink = `/crear-cuenta${params.get('volver') ? `?volver=${encodeURIComponent(back)}` : ''}`

  return (
    <AuthCard
      eyebrow="Tu cuenta"
      title="Ingresar"
      footer={
        <>
          ¿No tenés cuenta?{' '}
          <Link to={registerLink} className="underline underline-offset-4">
            Creá una
          </Link>
        </>
      }
    >
      <Seo title="Ingresar" description="Ingresá a tu cuenta de Unimoda para comprar y ver tus pedidos." />
      <AuthNoticeBanner notice={params.get('aviso')} />
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
        <Field id="email" label="Email" error={errors.email}>
          <input
            {...fieldProps('email', errors.email)}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setErrors((x) => ({ ...x, email: undefined }))
            }}
            className="input"
          />
        </Field>
        <Field id="password" label="Contraseña" error={errors.password}>
          <input
            {...fieldProps('password', errors.password)}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setErrors((x) => ({ ...x, password: undefined }))
            }}
            className="input"
          />
        </Field>
        <div className="-mt-2 text-right">
          <Link to="/olvide-contrasena" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">
            Olvidé mi contraseña
          </Link>
        </div>
        <FormAlert message={formError} />
        <button type="submit" className="btn-primary w-full" disabled={sending}>
          {sending ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </AuthCard>
  )
}
