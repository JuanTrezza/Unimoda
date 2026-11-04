import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { AuthCard } from '../../components/auth/AuthCard'
import { safeReturnPath } from '../../components/auth/RequireAuth'
import { Icon } from '../../components/ui/Icon'
import {
  EMAIL_RE,
  Field,
  FormAlert,
  MIN_PASSWORD,
  fieldProps,
  focusFirstError,
  validatePassword,
} from '../../components/ui/FormField'
import { AccountError, signUp } from '../../services/account'
import { useSession } from '../../store/session'

interface Values {
  nombre: string
  email: string
  password: string
  confirmar: string
}

type Errors = Partial<Record<keyof Values, string>>

const EMPTY: Values = { nombre: '', email: '', password: '', confirmar: '' }

function validate(v: Values): Errors {
  const e: Errors = {}
  if (v.nombre.trim().length < 2) e.nombre = 'Ingresá tu nombre.'
  else if (v.nombre.trim().length > 100) e.nombre = 'El nombre puede tener hasta 100 caracteres.'
  if (!v.email.trim()) e.email = 'Ingresá tu email.'
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Revisá el formato del email (por ejemplo, nombre@mail.com).'
  e.password = validatePassword(v.password)
  if (!e.password && v.confirmar !== v.password) e.confirmar = 'Las contraseñas no coinciden.'
  return e
}

export function SignUpPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const status = useSession((s) => s.status)
  const back = safeReturnPath(params.get('volver'))
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const confirmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'authenticated') navigate(back, { replace: true })
  }, [status, back, navigate])

  const set = (key: keyof Values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    setFormError('')
    if (focusFirstError(formRef.current, found)) return

    setSending(true)
    try {
      const result = await signUp({ fullName: values.nombre, email: values.email, password: values.password })
      if (result === 'confirmar-email') {
        setSentTo(values.email.trim().toLowerCase())
        requestAnimationFrame(() => confirmRef.current?.focus())
      }
      // Si el proyecto no pide confirmación ya hay sesión: el efecto redirige
    } catch (err) {
      setFormError(err instanceof AccountError ? err.message : 'No pudimos crear la cuenta. Probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  if (sentTo) {
    return (
      <AuthCard eyebrow="Tu cuenta" title="Revisá tu email">
        <Seo title="Revisá tu email" />
        <div ref={confirmRef} tabIndex={-1} role="status" className="outline-none">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-terracota text-white">
            <Icon name="mail" />
          </span>
          <p className="mt-5">
            Te mandamos un enlace a <strong>{sentTo}</strong> para confirmar tu cuenta. Abrilo desde este mismo
            navegador.
          </p>
          <p className="mt-3 text-sm text-tinta-muted">Si no lo ves en unos minutos, revisá la carpeta de spam.</p>
          <Link to="/ingresar" className="btn-outline mt-6">
            Ir a Ingresar
          </Link>
        </div>
      </AuthCard>
    )
  }

  const a11y = (key: keyof Values, opts?: { hint?: boolean }) => fieldProps(key, errors[key], opts)

  return (
    <AuthCard
      eyebrow="Tu cuenta"
      title="Crear cuenta"
      intro="Guardá tus direcciones y seguí tus pedidos."
      footer={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to={`/ingresar${params.get('volver') ? `?volver=${encodeURIComponent(back)}` : ''}`} className="underline underline-offset-4">
            Ingresá
          </Link>
        </>
      }
    >
      <Seo title="Crear cuenta" description="Creá tu cuenta en Unimoda." />
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
        <Field id="nombre" label="Nombre y apellido" error={errors.nombre}>
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
        <Field
          id="password"
          label="Contraseña"
          error={errors.password}
          hint={`Al menos ${MIN_PASSWORD} caracteres, con letras y números.`}
        >
          <input
            {...a11y('password', { hint: true })}
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={set('password')}
            className="input"
          />
        </Field>
        <Field id="confirmar" label="Repetí la contraseña" error={errors.confirmar}>
          <input
            {...a11y('confirmar')}
            type="password"
            autoComplete="new-password"
            value={values.confirmar}
            onChange={set('confirmar')}
            className="input"
          />
        </Field>
        <FormAlert message={formError} />
        <button type="submit" className="btn-primary w-full" disabled={sending}>
          {sending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthCard>
  )
}
