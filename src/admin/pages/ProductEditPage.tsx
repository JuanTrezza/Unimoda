import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState } from '../../components/ui/ErrorState'
import { Field, FormAlert, fieldProps, focusFirstError } from '../../components/ui/FormField'
import { Icon } from '../../components/ui/Icon'
import { useAsync } from '../../hooks/useAsync'
import { cn } from '../../lib/format'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { toast } from '../../store/toast'
import type { ImageView, Size } from '../../types'
import { ConfirmDialog, Panel } from '../components'
import {
  addColor,
  deleteColor,
  deleteImage,
  deleteProduct,
  getAdminCategories,
  getAdminProduct,
  saveProduct,
  saveStock,
  SIZES,
  slugify,
  swapImages,
  updateColor,
  updateImage,
  uploadImage,
  type AdminCategory,
  type AdminColor,
  type AdminImage,
  type AdminProduct,
  type ProductInput,
} from '../services'

export function ProductEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const categories = useAsync('admin:categories', getAdminCategories)
  const product = useAsync(`admin:product:${id ?? 'nuevo'}`, () => (id ? getAdminProduct(id) : Promise.resolve(undefined)))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (categories.error || product.error) {
    return (
      <ErrorState
        what="el producto"
        onRetry={() => {
          categories.retry()
          product.retry()
        }}
      />
    )
  }
  if (!categories.data || (id && product.loading)) return <div className="h-80 animate-pulse rounded-sm bg-crema-200" aria-busy="true" />
  if (id && !product.data) return <NotFoundPage />
  const p = product.data

  const onDelete = async () => {
    if (!p) return
    setDeleting(true)
    try {
      await deleteProduct(p)
      toast(`Borramos ${p.name}.`)
      navigate('/admin/productos', { replace: true })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No pudimos borrar el producto.', { tone: 'error' })
      setDeleting(false)
    }
  }

  return (
    <>
      <Link to="/admin/productos" className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4">
        <Icon name="chevronLeft" size={16} /> Productos
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl md:text-5xl">{p ? p.name : 'Nuevo producto'}</h1>
        {p && (
          <div className="flex flex-wrap gap-3">
            {p.isActive && (
              <Link to={`/producto/${p.slug}`} className="btn-ghost">
                Ver en la tienda
              </Link>
            )}
            <button type="button" className="btn-outline" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={18} /> Borrar
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-8">
        <ProductForm
          key={p?.id ?? 'nuevo'}
          product={p}
          categories={categories.data}
          onSaved={(savedId) => {
            if (!p) navigate(`/admin/productos/${savedId}`, { replace: true })
            else product.retry()
          }}
        />
        {p ? (
          <>
            <ColorsEditor product={p} onChange={product.retry} />
            <StockGrid key={p.variants.map((v) => `${v.id}:${v.stock}`).join()} product={p} onChange={product.retry} />
            <PhotosEditor product={p} onChange={product.retry} />
          </>
        ) : (
          <p className="text-sm text-tinta-muted">Guardá el producto para cargar colores, stock y fotos.</p>
        )}
      </div>

      {p && (
        <ConfirmDialog
          open={confirmDelete}
          title={`¿Borrar ${p.name}?`}
          confirmLabel="Sí, borrar producto"
          busy={deleting}
          onConfirm={onDelete}
          onClose={() => setConfirmDelete(false)}
        >
          Se borran sus colores, variantes y fotos (también los archivos subidos). Los pedidos ya hechos conservan nombre y
          precio. Si solo querés ocultarlo, desactivalo.
        </ConfirmDialog>
      )}
    </>
  )
}

// --- Datos del producto ------------------------------------------------------------

interface FormValues {
  nombre: string
  slug: string
  categoria: string
  descripcion: string
  detalles: string
  cuidados: string
  material: string
  precio: string
  anterior: string
  nuevo: boolean
  activo: boolean
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {}
  if (!v.nombre.trim()) e.nombre = 'Ingresá el nombre.'
  else if (v.nombre.trim().length > 120) e.nombre = 'Hasta 120 caracteres.'
  if (!SLUG_RE.test(v.slug) || v.slug.length > 120) e.slug = 'Solo minúsculas, números y guiones (ej. vestido-de-lino).'
  if (!v.categoria) e.categoria = 'Elegí una categoría.'
  if (v.descripcion.trim().length > 2000) e.descripcion = 'Hasta 2000 caracteres.'
  if (lines(v.detalles).length > 20) e.detalles = 'Hasta 20 líneas.'
  if (lines(v.cuidados).length > 10) e.cuidados = 'Hasta 10 líneas.'
  if (v.material.trim().length > 200) e.material = 'Hasta 200 caracteres.'
  const price = Number(v.precio)
  if (!v.precio || !Number.isFinite(price) || price <= 0) e.precio = 'Ingresá un precio mayor a 0.'
  else if (price > 20_000_000) e.precio = 'El precio es demasiado alto.'
  if (v.anterior) {
    const before = Number(v.anterior)
    if (!Number.isFinite(before) || before <= price) e.anterior = 'Tiene que ser mayor que el precio actual.'
  }
  return e
}

function ProductForm({
  product,
  categories,
  onSaved,
}: {
  product?: AdminProduct
  categories: AdminCategory[]
  onSaved: (id: string) => void
}) {
  const [values, setValues] = useState<FormValues>(() => ({
    nombre: product?.name ?? '',
    slug: product?.slug ?? '',
    categoria: product ? String(product.categoryId) : '',
    descripcion: product?.description ?? '',
    detalles: product?.details.join('\n') ?? '',
    cuidados: product?.care.join('\n') ?? '',
    material: product?.material ?? '',
    precio: product ? String(product.price) : '',
    anterior: product?.compareAtPrice ? String(product.compareAtPrice) : '',
    nuevo: product?.isNew ?? true,
    activo: product?.isActive ?? true,
  }))
  // En un producto existente el slug no se regenera solo: cambiarlo rompe los links compartidos
  const [slugEdited, setSlugEdited] = useState(Boolean(product))
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const set = (key: keyof FormValues) => (e: { target: { value: string } }) => {
    const value = e.target.value
    setValues((v) => ({ ...v, [key]: value, ...(key === 'nombre' && !slugEdited && { slug: slugify(value) }) }))
    setErrors((x) => ({ ...x, [key]: undefined, ...(key === 'nombre' && { slug: undefined }) }))
  }
  const a11y = (key: keyof FormValues, optional = false) => fieldProps(key, errors[key], { optional })

  const save = async () => {
    setConfirmDeactivate(false)
    setSaving(true)
    setFormError('')
    const input: ProductInput = {
      name: values.nombre,
      slug: values.slug,
      categoryId: Number(values.categoria),
      description: values.descripcion,
      details: lines(values.detalles),
      care: lines(values.cuidados),
      material: values.material,
      price: Number(values.precio),
      compareAtPrice: values.anterior ? Number(values.anterior) : null,
      isNew: values.nuevo,
      isActive: values.activo,
    }
    try {
      const id = await saveProduct(input, product?.id)
      toast(product ? 'Guardamos los cambios.' : 'Creamos el producto. Ahora sumá colores, stock y fotos.')
      onSaved(id)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No pudimos guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (focusFirstError(formRef.current, found)) return
    // Desactivar lo saca de la tienda: se confirma antes
    if (product?.isActive && !values.activo) return setConfirmDeactivate(true)
    void save()
  }

  return (
    <Panel title="Datos del producto">
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="nombre" label="Nombre" error={errors.nombre}>
            <input {...a11y('nombre')} value={values.nombre} onChange={set('nombre')} className="input" />
          </Field>
          <Field id="slug" label="Slug (URL)" error={errors.slug} hint={`/producto/${values.slug || '…'}`}>
            <input
              {...fieldProps('slug', errors.slug, { hint: true })}
              value={values.slug}
              onChange={(e) => {
                setSlugEdited(true)
                set('slug')({ target: { value: e.target.value.toLowerCase() } })
              }}
              className="input"
              spellCheck={false}
            />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="categoria" label="Categoría" error={errors.categoria}>
            <select {...a11y('categoria')} value={values.categoria} onChange={set('categoria')} className="input">
              <option value="">Elegí una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="material" label="Material" error={errors.material} optional>
            <input {...a11y('material', true)} value={values.material} onChange={set('material')} className="input" />
          </Field>
        </div>
        <Field id="descripcion" label="Descripción" error={errors.descripcion} optional>
          <textarea {...a11y('descripcion', true)} rows={4} value={values.descripcion} onChange={set('descripcion')} className="input py-3" />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="detalles" label="Detalles (uno por línea)" error={errors.detalles} optional>
            <textarea {...a11y('detalles', true)} rows={4} value={values.detalles} onChange={set('detalles')} className="input py-3" />
          </Field>
          <Field id="cuidados" label="Cuidados (uno por línea)" error={errors.cuidados} optional>
            <textarea {...a11y('cuidados', true)} rows={4} value={values.cuidados} onChange={set('cuidados')} className="input py-3" />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="precio" label="Precio en pesos" error={errors.precio}>
            <input {...a11y('precio')} type="number" inputMode="numeric" min={1} step={1} value={values.precio} onChange={set('precio')} className="input" />
          </Field>
          <Field id="anterior" label="Precio anterior en pesos" error={errors.anterior} optional>
            <input
              {...a11y('anterior', true)}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={values.anterior}
              onChange={set('anterior')}
              className="input"
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          {(['nuevo', 'activo'] as const).map((key) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.checked }))}
                className="h-5 w-5 accent-tinta"
              />
              {key === 'nuevo' ? 'Marcar como nuevo' : 'Activo (visible en la tienda)'}
            </label>
          ))}
        </div>
        <FormAlert message={formError} />
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </form>

      <ConfirmDialog
        open={confirmDeactivate}
        title="¿Desactivar el producto?"
        confirmLabel="Sí, desactivar"
        busy={saving}
        onConfirm={() => void save()}
        onClose={() => setConfirmDeactivate(false)}
      >
        Deja de verse en la tienda, la búsqueda y los favoritos, y los carritos que lo tengan lo pierden. Podés volver a
        activarlo cuando quieras.
      </ConfirmDialog>
    </Panel>
  )
}

// --- Colores --------------------------------------------------------------------------

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

function ColorsEditor({ product, onChange }: { product: AdminProduct; onChange: () => void }) {
  const [name, setName] = useState('')
  const [hex, setHex] = useState('#A4502F')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toDelete, setToDelete] = useState<AdminColor | null>(null)
  const nameId = useId()
  const pickerId = useId()

  const onAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim().length > 60) return setError('Ingresá un nombre de hasta 60 caracteres.')
    if (!HEX_RE.test(hex)) return setError('El color tiene que tener el formato #RRGGBB.')
    setBusy(true)
    try {
      await addColor(product, { name, hex })
      setName('')
      setError('')
      toast(`Agregamos el color ${name.trim()}.`)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos agregar el color.')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!toDelete) return
    setBusy(true)
    try {
      await deleteColor(product, toDelete.id)
      toast(`Borramos el color ${toDelete.name}.`)
      setToDelete(null)
      onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No pudimos borrar el color.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Colores">
      {product.colors.length === 0 && <p className="mb-4 text-sm text-tinta-soft">Todavía no tiene colores.</p>}
      <ul className="space-y-3">
        {product.colors.map((c) => (
          <ColorRow key={`${c.id}-${c.name}-${c.hex}`} color={c} onChange={onChange} onDelete={() => setToDelete(c)} />
        ))}
      </ul>

      <form onSubmit={onAdd} noValidate className="mt-6 flex flex-wrap items-end gap-3 border-t border-tinta/10 pt-6">
        <div className="min-w-48 flex-1">
          <label htmlFor={nameId} className="mb-2 block text-sm font-medium">
            Nuevo color
          </label>
          <input id={nameId} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Verde oliva" className="input" />
        </div>
        <div>
          <label htmlFor={pickerId} className="mb-2 block text-sm font-medium">
            Tono
          </label>
          <input
            id={pickerId}
            type="color"
            value={hex.toLowerCase()}
            onChange={(e) => setHex(e.target.value.toUpperCase())}
            className="h-12 w-16 cursor-pointer rounded-lg border border-tinta/25 bg-crema-50 p-1"
          />
        </div>
        <button type="submit" className="btn-outline" disabled={busy}>
          Agregar color
        </button>
        {error && (
          <p role="alert" className="basis-full text-sm text-terracota-dark">
            {error}
          </p>
        )}
      </form>

      <ConfirmDialog
        open={toDelete !== null}
        title={`¿Borrar el color ${toDelete?.name ?? ''}?`}
        confirmLabel="Sí, borrar color"
        busy={busy}
        onConfirm={onDelete}
        onClose={() => setToDelete(null)}
      >
        También se borran su stock y sus fotos.
      </ConfirmDialog>
    </Panel>
  )
}

function ColorRow({ color, onChange, onDelete }: { color: AdminColor; onChange: () => void; onDelete: () => void }) {
  const [name, setName] = useState(color.name)
  const [hex, setHex] = useState(color.hex)
  const [saving, setSaving] = useState(false)
  const dirty = name.trim() !== color.name || hex.toUpperCase() !== color.hex.toUpperCase()

  const save = async () => {
    if (!name.trim() || !HEX_RE.test(hex)) return toast('Revisá el nombre y el color.', { tone: 'error' })
    setSaving(true)
    try {
      await updateColor(color.id, { name, hex })
      toast('Guardamos el color.')
      onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No pudimos guardar el color.', { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3">
      <input
        type="color"
        value={hex.toLowerCase()}
        onChange={(e) => setHex(e.target.value.toUpperCase())}
        aria-label={`Tono de ${color.name}`}
        className="h-11 w-14 cursor-pointer rounded-lg border border-tinta/25 bg-crema-50 p-1"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={`Nombre del color ${color.name}`}
        className="input min-w-40 flex-1"
      />
      <code className="w-20 text-xs text-tinta-muted">{hex.toUpperCase()}</code>
      <button type="button" className="btn-outline min-h-11 px-4" onClick={save} disabled={!dirty || saving}>
        Guardar<span className="sr-only"> {color.name}</span>
      </button>
      <button type="button" className="btn-icon text-terracota-dark" onClick={onDelete} aria-label={`Borrar el color ${color.name}`}>
        <Icon name="trash" size={18} />
      </button>
    </li>
  )
}

// --- Stock ------------------------------------------------------------------------------

function StockGrid({ product, onChange }: { product: AdminProduct; onChange: () => void }) {
  const initial = () => {
    const map: Record<string, string> = {}
    for (const v of product.variants) map[`${v.colorId}:${v.size}`] = String(v.stock)
    return map
  }
  const [cells, setCells] = useState<Record<string, string>>(initial)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!product.colors.length) {
    return (
      <Panel title="Stock">
        <p className="text-sm text-tinta-soft">Agregá al menos un color para cargar stock.</p>
      </Panel>
    )
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    const changed: { colorId: number; size: Size; stock: number }[] = []
    for (const color of product.colors) {
      for (const size of SIZES) {
        const raw = cells[`${color.id}:${size}`] ?? ''
        const existing = product.variants.find((v) => v.colorId === color.id && v.size === size)
        if (raw === '') {
          if (existing) return setError(`El stock de ${color.name} talle ${size} no puede quedar vacío (poné 0).`)
          continue
        }
        const stock = Number(raw)
        if (!Number.isInteger(stock) || stock < 0 || stock > 99999) {
          return setError(`Revisá el stock de ${color.name} talle ${size}: tiene que ser un número entero desde 0.`)
        }
        if (!existing || existing.stock !== stock) changed.push({ colorId: color.id, size, stock })
      }
    }
    setError('')
    if (!changed.length) return toast('No hay cambios de stock.', { tone: 'info' })
    setSaving(true)
    try {
      await saveStock(product, changed)
      toast('Guardamos el stock.')
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos guardar el stock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Stock">
      <form onSubmit={onSave} noValidate>
        <p className="mb-4 text-sm text-tinta-muted">Vacío = ese talle no se ofrece en ese color. 0 = agotado.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <caption className="sr-only">Stock por color y talle</caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-3 text-left font-medium text-tinta-muted">
                  Color
                </th>
                {SIZES.map((s) => (
                  <th key={s} scope="col" className="px-1 py-2 text-center font-medium text-tinta-muted">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {product.colors.map((c) => (
                <tr key={c.id} className="border-t border-tinta/10">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 shrink-0 rounded-full ring-1 ring-tinta/20" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                      {c.name}
                    </span>
                  </th>
                  {SIZES.map((s) => {
                    const key = `${c.id}:${s}`
                    return (
                      <td key={s} className="px-1 py-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={cells[key] ?? ''}
                          placeholder="—"
                          onChange={(e) => setCells((x) => ({ ...x, [key]: e.target.value }))}
                          aria-label={`Stock ${c.name} talle ${s}`}
                          className="input min-h-11 w-full min-w-12 px-2 text-center tabular-nums"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-terracota-dark">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary mt-5" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar stock'}
        </button>
      </form>
    </Panel>
  )
}

// --- Fotos ------------------------------------------------------------------------------

const VIEWS: { value: ImageView; label: string }[] = [
  { value: 'frente', label: 'Frente' },
  { value: 'espalda', label: 'Espalda' },
  { value: 'detalle', label: 'Detalle' },
]

function PhotosEditor({ product, onChange }: { product: AdminProduct; onChange: () => void }) {
  // null = fotos que sirven para todos los colores
  const [group, setGroup] = useState<number | null>(null)
  const [uploading, setUploading] = useState('')
  const [toDelete, setToDelete] = useState<AdminImage | null>(null)
  const [busy, setBusy] = useState(false)
  const inputId = useId()

  // Si se borra el color seleccionado, volver a "Todos"
  useEffect(() => {
    if (group !== null && !product.colors.some((c) => c.id === group)) setGroup(null)
  }, [product.colors, group])

  const images = product.images.filter((i) => i.colorId === group)
  const groupName = group === null ? 'todos los colores' : product.colors.find((c) => c.id === group)?.name ?? ''

  const run = async (action: () => Promise<void>, ok?: string) => {
    setBusy(true)
    try {
      await action()
      if (ok) toast(ok)
      onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No pudimos guardar el cambio.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const list = [...files]
    let done = 0
    try {
      for (const file of list) {
        setUploading(`Subiendo ${done + 1} de ${list.length}…`)
        // Secuencial; `done` corre el orden y la vista de cada foto nueva
        await uploadImage(product, group, file, done)
        done++
      }
      toast(done === 1 ? 'Subimos la foto.' : `Subimos ${done} fotos.`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No pudimos subir la foto.', { tone: 'error' })
    } finally {
      setUploading('')
      onChange()
    }
  }

  return (
    <Panel title="Fotos">
      <div role="group" aria-label="Fotos de" className="flex flex-wrap gap-2">
        {[{ id: null as number | null, name: 'Todos los colores' }, ...product.colors].map((c) => (
          <button
            key={c.id ?? 'todos'}
            type="button"
            aria-pressed={group === c.id}
            onClick={() => setGroup(c.id)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border px-4 text-sm',
              group === c.id ? 'border-tinta bg-tinta text-crema-50' : 'border-tinta/25 hover:border-tinta',
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-tinta-muted">
        La tienda muestra las fotos del color elegido; si un color no tiene, usa las de “Todos los colores”.
      </p>

      {images.length === 0 ? (
        <p className="mt-6 rounded-sm bg-crema-200/60 px-6 py-10 text-center text-sm text-tinta-soft">
          No hay fotos para {groupName}.
        </p>
      ) : (
        <ol className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label={`Fotos de ${groupName}`}>
          {images.map((img, i) => (
            <li key={img.id} className="rounded-sm border border-tinta/10 p-2">
              <img
                src={img.url}
                alt={img.alt}
                width={img.width}
                height={img.height}
                loading="lazy"
                className="aspect-[4/5] w-full rounded-sm bg-crema-200 object-cover"
              />
              <p className="mt-2 text-xs text-tinta-muted">
                {img.width}×{img.height} · {img.source === 'storage' ? 'Storage' : 'Estática'}
              </p>
              <label className="mt-2 block text-xs font-medium" htmlFor={`view-${img.id}`}>
                Vista
              </label>
              <select
                id={`view-${img.id}`}
                value={img.view}
                disabled={busy}
                onChange={(e) => run(() => updateImage(img.id, { view: e.target.value as ImageView }), 'Cambiamos la vista.')}
                className="input min-h-11 text-sm"
              >
                {VIEWS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex justify-between">
                <span className="flex">
                  <button
                    type="button"
                    className="btn-icon"
                    disabled={i === 0 || busy}
                    onClick={() => run(() => swapImages(img, images[i - 1]!))}
                    aria-label={`Mover antes la foto ${i + 1}`}
                  >
                    <Icon name="chevronLeft" size={18} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    disabled={i === images.length - 1 || busy}
                    onClick={() => run(() => swapImages(img, images[i + 1]!))}
                    aria-label={`Mover después la foto ${i + 1}`}
                  >
                    <Icon name="chevronRight" size={18} />
                  </button>
                </span>
                <button
                  type="button"
                  className="btn-icon text-terracota-dark"
                  onClick={() => setToDelete(img)}
                  aria-label={`Borrar la foto ${i + 1}`}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6">
        <label htmlFor={inputId} className={cn('btn-outline cursor-pointer', uploading && 'pointer-events-none opacity-40')}>
          <Icon name="plus" size={18} /> Subir fotos para {groupName}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          disabled={Boolean(uploading)}
          onChange={(e) => {
            void onFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <p className="mt-2 min-h-5 text-sm text-tinta-muted" aria-live="polite">
          {uploading || 'JPG, PNG o WebP. Se achican a 1600 px de alto y se guardan en WebP.'}
        </p>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="¿Borrar la foto?"
        confirmLabel="Sí, borrar foto"
        busy={busy}
        onConfirm={() =>
          toDelete &&
          run(async () => {
            await deleteImage(toDelete)
            setToDelete(null)
          }, 'Borramos la foto.')
        }
        onClose={() => setToDelete(null)}
      >
        {toDelete?.source === 'storage'
          ? 'También se borra el archivo de Storage.'
          : 'Es una foto estática del sitio: se quita del producto, el archivo queda en el repositorio.'}
      </ConfirmDialog>
    </Panel>
  )
}
