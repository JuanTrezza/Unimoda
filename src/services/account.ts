/**
 * Cuenta: autenticación, perfil y direcciones. RLS limita todo al usuario de la sesión,
 * así que las consultas no filtran por user_id (y no podrían ver otra cosa aunque lo intentaran).
 */
import { isAuthError } from '@supabase/supabase-js'
import { authRedirectUrl } from '../lib/authRedirect'
import { supabase } from '../lib/supabase'
import type { Address, AddressInput, Profile } from '../types'

/** Error con mensaje listo para mostrar */
export class AccountError extends Error {}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'El email o la contraseña no coinciden.',
  email_not_confirmed: 'Todavía no confirmaste tu email. Revisá tu casilla (y el spam).',
  user_already_exists: 'Ya hay una cuenta con ese email. Probá ingresar.',
  email_exists: 'Ya hay una cuenta con ese email. Probá ingresar.',
  weak_password: 'La contraseña es muy débil. Usá al menos 8 caracteres, con letras y números.',
  same_password: 'La nueva contraseña tiene que ser distinta de la anterior.',
  over_email_send_rate_limit: 'Mandamos demasiados emails. Esperá unos minutos y probá de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
  signup_disabled: 'Por ahora no se pueden crear cuentas nuevas.',
  session_not_found: 'Tu sesión venció. Volvé a ingresar.',
}

function fail(error: unknown): never {
  if (isAuthError(error)) {
    if (error.code && AUTH_MESSAGES[error.code]) throw new AccountError(AUTH_MESSAGES[error.code])
    if (error.status === 0 || error.name === 'AuthRetryableFetchError') {
      throw new AccountError('No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
    }
  }
  throw new AccountError('Algo salió mal. Probá de nuevo en unos minutos.')
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) fail(error)
}

/** Devuelve 'confirmar-email' si el proyecto pide confirmación (no hay sesión todavía). */
export async function signUp(input: { fullName: string; email: string; password: string }) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: { full_name: input.fullName.trim() },
      emailRedirectTo: authRedirectUrl('signup'),
    },
  })
  if (error) fail(error)
  // Con confirmación activada, un email ya registrado también vuelve sin sesión (Supabase no
  // revela si existe): el mensaje es el mismo en los dos casos.
  return data.session ? ('ingresada' as const) : ('confirmar-email' as const)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: authRedirectUrl('recovery'),
  })
  if (error) fail(error)
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) fail(error)
}

export async function signOut(): Promise<void> {
  // local: cierra la sesión en este navegador. El carrito (localStorage) no se toca.
  await supabase.auth.signOut({ scope: 'local' })
}

// --- Perfil ------------------------------------------------------------------

function check<T>({ data, error }: { data: unknown; error: { message: string; code?: string } | null }): T {
  if (error) {
    if (error.code === 'UM010') throw new AccountError(error.message)
    if (error.code === '23514') throw new AccountError('Revisá los datos: alguno no tiene el formato esperado.')
    throw new AccountError(
      error.message.includes('fetch') ? 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.' : 'No pudimos guardar los cambios.',
    )
  }
  return data as T
}

export async function getProfile(): Promise<Profile> {
  const { data: auth } = await supabase.auth.getSession()
  const rows = check<{ full_name: string; phone: string | null }[]>(
    await supabase.from('profiles').select('full_name, phone').limit(1),
  )
  return { fullName: rows[0]?.full_name ?? '', phone: rows[0]?.phone ?? null, email: auth.session?.user.email ?? '' }
}

export async function updateProfile(input: { fullName: string; phone: string | null }): Promise<void> {
  const { data: auth } = await supabase.auth.getSession()
  const id = auth.session?.user.id
  if (!id) throw new AccountError('Tu sesión venció. Volvé a ingresar.')
  check(
    await supabase
      .from('profiles')
      .update({ full_name: input.fullName.trim(), phone: input.phone?.trim() || null })
      .eq('id', id),
  )
}

// --- Direcciones -------------------------------------------------------------

const ADDRESS_SELECT = 'id, street, number, apartment, city, province, postal_code, is_default'

interface AddressRow {
  id: string
  street: string
  number: string
  apartment: string | null
  city: string
  province: string
  postal_code: string
  is_default: boolean
}

const toAddress = (r: AddressRow): Address => ({
  id: r.id,
  street: r.street,
  number: r.number,
  apartment: r.apartment,
  city: r.city,
  province: r.province,
  postalCode: r.postal_code,
  isDefault: r.is_default,
})

/** Normaliza como lo exigen los CHECK de la tabla (CP en mayúsculas y sin espacios, etc.) */
const toRow = (a: AddressInput) => ({
  street: a.street.trim(),
  number: a.number.trim(),
  apartment: a.apartment?.trim() || null,
  city: a.city.trim(),
  province: a.province,
  postal_code: a.postalCode.replace(/\s+/g, '').toUpperCase(),
  is_default: a.isDefault,
})

export async function getAddresses(): Promise<Address[]> {
  const rows = check<AddressRow[]>(
    await supabase
      .from('addresses')
      .select(ADDRESS_SELECT)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
  )
  return rows.map(toAddress)
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const rows = check<AddressRow[]>(await supabase.from('addresses').insert(toRow(input)).select(ADDRESS_SELECT))
  return toAddress(rows[0]!)
}

export async function updateAddress(id: string, input: AddressInput): Promise<void> {
  check(await supabase.from('addresses').update(toRow(input)).eq('id', id))
}

export async function setDefaultAddress(id: string): Promise<void> {
  check(await supabase.from('addresses').update({ is_default: true }).eq('id', id))
}

export async function deleteAddress(id: string): Promise<void> {
  check(await supabase.from('addresses').delete().eq('id', id))
}
