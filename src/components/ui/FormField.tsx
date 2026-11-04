import type { ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Campo de formulario con el mismo patrón accesible que Contacto: label asociado, asterisco
 * decorativo, error con id para aria-describedby y aria-invalid en el control.
 */
export function Field({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}{' '}
        {optional ? (
          <span className="font-normal text-tinta-muted">(opcional)</span>
        ) : (
          <span aria-hidden="true" className="text-terracota-dark">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-2 text-xs text-tinta-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-2 flex items-center gap-1.5 text-sm text-terracota-dark">
          <Icon name="info" size={16} /> {error}
        </p>
      )}
    </div>
  )
}

/** Props de accesibilidad para el input / select / textarea de un Field */
export function fieldProps(id: string, error?: string, { optional = false, hint = false } = {}) {
  return {
    id,
    name: id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    'aria-required': optional ? undefined : true,
  }
}

/** Lleva el foco al primer campo con error (en el orden del objeto de errores) */
export function focusFirstError(form: HTMLFormElement | null, errors: Record<string, string | undefined>) {
  const first = Object.keys(errors).find((k) => errors[k])
  if (first) form?.querySelector<HTMLElement>(`#${first}`)?.focus()
  return Boolean(first)
}

/** Error general del formulario (falla del servidor, credenciales, etc.) */
export function FormAlert({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-sm bg-terracota-50 p-4 text-sm text-terracota-dark">
      <Icon name="info" size={18} className="mt-0.5 shrink-0" /> {message}
    </p>
  )
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Tiene que coincidir con Auth → Providers → Email → Minimum password length (ver README) */
export const MIN_PASSWORD = 8

export function validatePassword(password: string): string | undefined {
  if (password.length < MIN_PASSWORD) return `Usá al menos ${MIN_PASSWORD} caracteres.`
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Combiná letras y números.'
  // bcrypt (y Supabase) solo usan los primeros 72 bytes
  if (password.length > 72) return 'Usá hasta 72 caracteres.'
  return undefined
}
