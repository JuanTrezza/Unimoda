import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Seo } from '../../components/Seo'
import { AccountNav } from '../../components/account/AccountNav'
import { AddressForm, formatAddress } from '../../components/account/AddressForm'
import { AuthNoticeBanner } from '../../components/auth/AuthCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { Field, FormAlert, fieldProps, focusFirstError } from '../../components/ui/FormField'
import { useAsync } from '../../hooks/useAsync'
import {
  createAddress,
  deleteAddress,
  getAddresses,
  getProfile,
  setDefaultAddress,
  updateAddress,
  updateProfile,
} from '../../services/account'
import { useSession } from '../../store/session'
import { toast } from '../../store/toast'
import type { Address, Profile } from '../../types'

const PHONE_RE = /^\+?[0-9][0-9 ()-]{5,19}$/

export function AccountPage() {
  const userId = useSession((s) => s.user?.id ?? '')
  const [params] = useSearchParams()
  const profile = useAsync(`profile:${userId}`, getProfile)
  const addresses = useAsync(`addresses:${userId}`, getAddresses, { keepPrevious: true })

  return (
    <div className="container-site pb-20 pt-8 md:pt-12">
      <Seo title="Mi cuenta" />
      <p className="eyebrow">Tu cuenta</p>
      <h1 className="mt-2 font-serif text-4xl md:text-5xl">Mi cuenta</h1>
      <div className="mt-6">
        <AuthNoticeBanner notice={params.get('aviso')} />
      </div>
      <AccountNav />

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <section aria-labelledby="datos-title">
          <h2 id="datos-title" className="font-serif text-2xl">
            Mis datos
          </h2>
          <div className="mt-6">
            {profile.error ? (
              <ErrorState what="tus datos" onRetry={profile.retry} />
            ) : profile.data ? (
              <ProfileForm profile={profile.data} onSaved={profile.retry} />
            ) : (
              <div className="h-60 animate-pulse rounded-sm bg-crema-200" aria-busy="true" />
            )}
          </div>
        </section>

        <section aria-labelledby="direcciones-title">
          <h2 id="direcciones-title" className="font-serif text-2xl">
            Mis direcciones
          </h2>
          <div className="mt-6">
            {addresses.error ? (
              <ErrorState what="tus direcciones" onRetry={addresses.retry} />
            ) : addresses.data ? (
              <AddressBook addresses={addresses.data} onChange={addresses.retry} />
            ) : (
              <div className="h-40 animate-pulse rounded-sm bg-crema-200" aria-busy="true" />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [nombre, setNombre] = useState(profile.fullName)
  const [telefono, setTelefono] = useState(profile.phone ?? '')
  const [errors, setErrors] = useState<{ nombre?: string; telefono?: string }>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    setNombre(profile.fullName)
    setTelefono(profile.phone ?? '')
  }, [profile])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    if (nombre.trim().length < 2) found.nombre = 'Ingresá tu nombre.'
    else if (nombre.trim().length > 100) found.nombre = 'Hasta 100 caracteres.'
    if (telefono.trim() && !PHONE_RE.test(telefono.trim())) found.telefono = 'Usá solo números, espacios, guiones o +.'
    setErrors(found)
    setFormError('')
    if (focusFirstError(formRef.current, found)) return

    setSaving(true)
    try {
      await updateProfile({ fullName: nombre, phone: telefono })
      toast('Guardamos tus datos.')
      onSaved()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No pudimos guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5 rounded-sm bg-crema-50 p-6">
      <div>
        <p className="mb-2 text-sm font-medium">Email</p>
        <p className="text-tinta-soft">{profile.email}</p>
      </div>
      <Field id="nombre" label="Nombre y apellido" error={errors.nombre}>
        <input
          {...fieldProps('nombre', errors.nombre)}
          autoComplete="name"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setErrors((x) => ({ ...x, nombre: undefined }))
          }}
          className="input"
        />
      </Field>
      <Field id="telefono" label="Teléfono" error={errors.telefono} optional>
        <input
          {...fieldProps('telefono', errors.telefono, { optional: true })}
          type="tel"
          autoComplete="tel"
          value={telefono}
          onChange={(e) => {
            setTelefono(e.target.value)
            setErrors((x) => ({ ...x, telefono: undefined }))
          }}
          className="input"
        />
      </Field>
      <FormAlert message={formError} />
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar datos'}
      </button>
    </form>
  )
}

function AddressBook({ addresses, onChange }: { addresses: Address[]; onChange: () => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(addresses.length === 0 ? 'new' : null)

  const run = async (action: () => Promise<void>, message: string) => {
    try {
      await action()
      toast(message)
      onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No pudimos guardar los cambios.', { tone: 'error' })
    }
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 && editing !== 'new' && <p className="text-tinta-soft">Todavía no guardaste direcciones.</p>}
      <ul className="space-y-4">
        {addresses.map((a) => (
          <li key={a.id} className="rounded-sm bg-crema-50 p-5">
            {editing === a.id ? (
              <AddressForm
                initial={a}
                submitLabel="Guardar dirección"
                onCancel={() => setEditing(null)}
                onSubmit={async (input) => {
                  await updateAddress(a.id, input)
                  setEditing(null)
                  toast('Actualizamos la dirección.')
                  onChange()
                }}
              />
            ) : (
              <>
                <p className="text-sm">{formatAddress(a)}</p>
                {a.isDefault && <span className="badge mt-2 bg-crema-200">Predeterminada</span>}
                <div className="mt-3 flex flex-wrap gap-x-4">
                  <button type="button" className="min-h-11 text-sm underline underline-offset-4" onClick={() => setEditing(a.id)}>
                    Editar<span className="sr-only"> {formatAddress(a)}</span>
                  </button>
                  {!a.isDefault && (
                    <button
                      type="button"
                      className="min-h-11 text-sm underline underline-offset-4"
                      onClick={() => run(() => setDefaultAddress(a.id), 'Cambiamos tu dirección predeterminada.')}
                    >
                      Usar como predeterminada
                    </button>
                  )}
                  <button
                    type="button"
                    className="min-h-11 text-sm text-terracota-dark underline underline-offset-4"
                    onClick={() => {
                      if (window.confirm('¿Borrar esta dirección?')) run(() => deleteAddress(a.id), 'Borramos la dirección.')
                    }}
                  >
                    Borrar<span className="sr-only"> {formatAddress(a)}</span>
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {editing === 'new' ? (
        <div className="rounded-sm bg-crema-50 p-5">
          <h3 className="mb-4 font-medium">Nueva dirección</h3>
          <AddressForm
            forceDefault={addresses.length === 0}
            submitLabel="Guardar dirección"
            onCancel={addresses.length ? () => setEditing(null) : undefined}
            onSubmit={async (input) => {
              await createAddress(input)
              setEditing(null)
              toast('Guardamos la dirección.')
              onChange()
            }}
          />
        </div>
      ) : (
        <button type="button" className="btn-outline" onClick={() => setEditing('new')}>
          Agregar dirección
        </button>
      )}
    </div>
  )
}
