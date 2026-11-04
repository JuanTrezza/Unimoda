import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { AuthCard } from '../../components/auth/AuthCard'
import { Field, FormAlert, MIN_PASSWORD, fieldProps, focusFirstError, validatePassword } from '../../components/ui/FormField'
import { AccountError, updatePassword } from '../../services/account'
import { useSession } from '../../store/session'
import { toast } from '../../store/toast'

/** Se llega desde el link del email (lib/authRedirect.ts), que deja una sesión de recuperación. */
export function ResetPasswordPage() {
  const status = useSession((s) => s.status)
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirmar?: string }>({})
  const [formError, setFormError] = useState('')
  const [sending, setSending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  if (status === 'loading') return <div className="container-site py-16" aria-busy="true" />

  if (status === 'anonymous') {
    return (
      <AuthCard eyebrow="Tu cuenta" title="Nueva contraseña">
        <Seo title="Nueva contraseña" />
        <p>El enlace venció o no es válido. Pedí uno nuevo y abrilo desde este navegador.</p>
        <Link to="/olvide-contrasena" className="btn-primary mt-6">
          Pedir un enlace nuevo
        </Link>
      </AuthCard>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found = { password: validatePassword(password), confirmar: undefined as string | undefined }
    if (!found.password && confirm !== password) found.confirmar = 'Las contraseñas no coinciden.'
    setErrors(found)
    setFormError('')
    if (focusFirstError(formRef.current, found)) return

    setSending(true)
    try {
      await updatePassword(password)
      toast('Listo, cambiaste tu contraseña.')
      navigate('/cuenta', { replace: true })
    } catch (err) {
      setFormError(err instanceof AccountError ? err.message : 'No pudimos cambiar la contraseña. Probá de nuevo.')
      setSending(false)
    }
  }

  return (
    <AuthCard eyebrow="Tu cuenta" title="Nueva contraseña" intro="Elegí una contraseña nueva para tu cuenta.">
      <Seo title="Nueva contraseña" />
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
        <Field
          id="password"
          label="Contraseña nueva"
          error={errors.password}
          hint={`Al menos ${MIN_PASSWORD} caracteres, con letras y números.`}
        >
          <input
            {...fieldProps('password', errors.password, { hint: true })}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setErrors((x) => ({ ...x, password: undefined }))
            }}
            className="input"
          />
        </Field>
        <Field id="confirmar" label="Repetí la contraseña" error={errors.confirmar}>
          <input
            {...fieldProps('confirmar', errors.confirmar)}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              setErrors((x) => ({ ...x, confirmar: undefined }))
            }}
            className="input"
          />
        </Field>
        <FormAlert message={formError} />
        <button type="submit" className="btn-primary w-full" disabled={sending}>
          {sending ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthCard>
  )
}
