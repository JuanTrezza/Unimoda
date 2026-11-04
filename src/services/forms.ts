/** Formularios públicos: newsletter y contacto. Solo INSERT (RLS no deja leer estas tablas). */
import { getSupabase } from '../lib/getSupabase'

/** Código de Postgres para unique_violation */
const DUPLICATE = '23505'

/** Devuelve 'already' si el email ya estaba suscripto (no es un error para la usuaria). */
export async function subscribeToNewsletter(email: string): Promise<'subscribed' | 'already'> {
  const db = await getSupabase()
  // Sin .select(): la tabla no tiene permiso de lectura, así que el insert va sin returning
  const { error } = await db.from('newsletter_subscribers').insert({ email: email.trim().toLowerCase() })
  if (!error) return 'subscribed'
  if (error.code === DUPLICATE) return 'already'
  throw new Error(error.message)
}

export async function sendContactMessage(message: { name: string; email: string; message: string }): Promise<void> {
  const db = await getSupabase()
  const { error } = await db.from('contact_messages').insert({
    name: message.name.trim(),
    email: message.email.trim().toLowerCase(),
    message: message.message.trim(),
  })
  if (error) throw new Error(error.message)
}
