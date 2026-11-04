import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import type { AuthNotice } from '../../lib/authRedirect'

/** Marco común de Ingresar, Crear cuenta y recuperación de contraseña */
export function AuthCard({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  intro?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="container-site flex justify-center pb-20 pt-8 md:pt-14">
      <div className="w-full max-w-md">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">{title}</h1>
        {intro && <div className="mt-4 text-tinta-soft">{intro}</div>}
        <div className="mt-8 rounded-sm bg-crema-50 p-6 md:p-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </div>
  )
}

const NOTICES: Record<AuthNotice, string> = {
  'email-confirmado': '¡Listo! Tu email quedó confirmado. Ingresá con tu contraseña.',
  'enlace-vencido': 'El enlace venció o ya se usó. Pedí uno nuevo.',
  'otro-navegador':
    'Abrí el enlace en el mismo navegador donde lo pediste. Si no podés, pedí uno nuevo desde acá.',
  bienvenida: '¡Bienvenida a Unimoda! Tu cuenta ya está activa.',
}

/** Aviso que deja el callback de los emails en ?aviso= (ver lib/authRedirect.ts) */
export function AuthNoticeBanner({ notice }: { notice: string | null }) {
  const text = notice && NOTICES[notice as AuthNotice]
  if (!text) return null
  return (
    <p role="status" className="mb-6 flex items-start gap-2 rounded-sm bg-crema-200 p-4 text-sm">
      <Icon name="info" size={18} className="mt-0.5 shrink-0" /> {text}
    </p>
  )
}
