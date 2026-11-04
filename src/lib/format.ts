const currency = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatPrice(value: number): string {
  return currency.format(value)
}

export function installment(price: number, count = INSTALLMENTS): string {
  return formatPrice(Math.ceil(price / count))
}

const dateFormat = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

export const INSTALLMENTS = 6
// Mismos valores (en centavos) que private.checkout_rules() en supabase/migrations/0004:
// el front los usa para mostrar; el total real lo calcula create_order en la base.
export const FREE_SHIPPING_FROM = 150000
export const SHIPPING_COST = 8500

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
