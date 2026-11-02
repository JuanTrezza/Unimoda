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

export const INSTALLMENTS = 6
export const FREE_SHIPPING_FROM = 150000
export const SHIPPING_COST = 8500

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
