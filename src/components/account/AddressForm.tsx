import { useId, useRef, useState, type FormEvent } from 'react'
import { Field, FormAlert, fieldProps, focusFirstError } from '../ui/FormField'
import { Icon } from '../ui/Icon'
import { PROVINCES } from '../../data/provinces'
import type { Address, AddressInput } from '../../types'

interface Values {
  calle: string
  numero: string
  depto: string
  ciudad: string
  provincia: string
  cp: string
  predeterminada: boolean
}

type Errors = Partial<Record<Exclude<keyof Values, 'predeterminada'>, string>>

// Mismas reglas que los CHECK de public.addresses (0004)
const POSTAL_RE = /^([0-9]{4}|[A-Z][0-9]{4}[A-Z]{3})$/
const NUMBER_RE = /^[0-9A-Za-z/ -]{1,10}$/

function validate(v: Values): Errors {
  const e: Errors = {}
  const len = (s: string) => s.trim().length
  if (len(v.calle) < 2) e.calle = 'Ingresá la calle.'
  else if (len(v.calle) > 100) e.calle = 'La calle puede tener hasta 100 caracteres.'
  if (!v.numero.trim()) e.numero = 'Ingresá la altura (o S/N).'
  else if (!NUMBER_RE.test(v.numero.trim())) e.numero = 'Usá hasta 10 caracteres: números, letras o "/".'
  if (len(v.depto) > 20) e.depto = 'Hasta 20 caracteres.'
  if (len(v.ciudad) < 2) e.ciudad = 'Ingresá la localidad.'
  else if (len(v.ciudad) > 80) e.ciudad = 'La localidad puede tener hasta 80 caracteres.'
  if (!v.provincia) e.provincia = 'Elegí la provincia.'
  const cp = v.cp.replace(/\s+/g, '').toUpperCase()
  if (!cp) e.cp = 'Ingresá el código postal.'
  else if (!POSTAL_RE.test(cp)) e.cp = 'Usá 4 números (1425) o el CPA completo (C1425ABC).'
  return e
}

const fromAddress = (a?: Address): Values => ({
  calle: a?.street ?? '',
  numero: a?.number ?? '',
  depto: a?.apartment ?? '',
  ciudad: a?.city ?? '',
  provincia: a?.province ?? '',
  cp: a?.postalCode ?? '',
  predeterminada: a?.isDefault ?? false,
})

interface Props {
  initial?: Address
  /** La primera dirección se guarda como predeterminada sin preguntar */
  forceDefault?: boolean
  submitLabel: string
  onSubmit: (input: AddressInput) => Promise<void>
  onCancel?: () => void
}

export function AddressForm({ initial, forceDefault, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<Values>(() => fromAddress(initial))
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  // Prefijo para que los ids no choquen si hay más de un formulario en la página
  // (sin caracteres raros: se usa en querySelector para enfocar el primer error)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const id = (key: keyof Errors) => `${key}-${uid}`

  const set = (key: keyof Values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    setFormError('')
    const first = (Object.keys(found) as (keyof Errors)[]).find((k) => found[k])
    if (first) return focusFirstError(formRef.current, { [id(first)]: found[first] })

    setSaving(true)
    try {
      await onSubmit({
        street: values.calle,
        number: values.numero,
        apartment: values.depto.trim() || null,
        city: values.ciudad,
        province: values.provincia,
        postalCode: values.cp,
        isDefault: forceDefault || values.predeterminada,
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No pudimos guardar la dirección.')
      setSaving(false)
    }
  }

  const a11y = (key: keyof Errors, optional = false) => fieldProps(id(key), errors[key], { optional })

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-5" aria-label={submitLabel}>
      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <Field id={id('calle')} label="Calle" error={errors.calle}>
          <input {...a11y('calle')} autoComplete="address-line1" value={values.calle} onChange={set('calle')} className="input" />
        </Field>
        <Field id={id('numero')} label="Altura" error={errors.numero}>
          <input {...a11y('numero')} inputMode="numeric" value={values.numero} onChange={set('numero')} className="input" />
        </Field>
      </div>
      <Field id={id('depto')} label="Piso / depto" error={errors.depto} optional>
        <input {...a11y('depto', true)} autoComplete="address-line2" value={values.depto} onChange={set('depto')} className="input" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={id('ciudad')} label="Localidad" error={errors.ciudad}>
          <input {...a11y('ciudad')} autoComplete="address-level2" value={values.ciudad} onChange={set('ciudad')} className="input" />
        </Field>
        <Field id={id('cp')} label="Código postal" error={errors.cp}>
          <input {...a11y('cp')} autoComplete="postal-code" value={values.cp} onChange={set('cp')} className="input uppercase" />
        </Field>
      </div>
      <Field id={id('provincia')} label="Provincia" error={errors.provincia}>
        <div className="relative">
          <select
            {...a11y('provincia')}
            autoComplete="address-level1"
            value={values.provincia}
            onChange={set('provincia')}
            className="input appearance-none pr-10"
          >
            <option value="">Elegí una provincia</option>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <Icon name="chevronDown" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
        </div>
      </Field>
      {!forceDefault && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={values.predeterminada}
            onChange={(e) => setValues((v) => ({ ...v, predeterminada: e.target.checked }))}
            className="h-5 w-5 accent-tinta"
          />
          Usar como dirección predeterminada
        </label>
      )}
      <FormAlert message={formError} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

/** Dirección en una línea para listas y resúmenes */
export function formatAddress(a: Pick<Address, 'street' | 'number' | 'apartment' | 'city' | 'province' | 'postalCode'>) {
  return `${a.street} ${a.number}${a.apartment ? `, ${a.apartment}` : ''} · ${a.city}, ${a.province} (${a.postalCode})`
}
