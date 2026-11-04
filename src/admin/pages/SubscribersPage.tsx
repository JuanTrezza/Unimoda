import { useState } from 'react'
import { ErrorState } from '../../components/ui/ErrorState'
import { useAsync } from '../../hooks/useAsync'
import { formatDate } from '../../lib/format'
import { toast } from '../../store/toast'
import { DataTable, Pagination } from '../components'
import { listSubscribers, PAGE_SIZE, subscribersCsv } from '../services'

export function SubscribersPage() {
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const subscribers = useAsync(`admin:subscribers:${page}`, () => listSubscribers(page), { keepPrevious: true })

  const onExport = async () => {
    setExporting(true)
    try {
      const csv = await subscribersCsv()
      // BOM para que Excel lea bien los acentos
      const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `suscriptores-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No pudimos exportar.', { tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl md:text-5xl">Suscriptores</h1>
        <button type="button" className="btn-outline" onClick={onExport} disabled={exporting || !subscribers.data?.total}>
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>
      <div className="mt-8" aria-busy={subscribers.loading}>
        {subscribers.error ? (
          <ErrorState what="los suscriptores" onRetry={subscribers.retry} />
        ) : !subscribers.data ? (
          <div className="h-60 animate-pulse rounded-sm bg-crema-200" />
        ) : (
          <>
            <p className="mb-3 text-sm text-tinta-muted">{subscribers.data.total} suscriptores</p>
            <DataTable
              caption="Suscriptores de la newsletter"
              rows={subscribers.data.rows}
              rowKey={(s) => s.id}
              empty="Todavía no hay suscriptores."
              columns={[
                { key: 'email', label: 'Email', render: (s) => <span className="break-all">{s.email}</span> },
                { key: 'fecha', label: 'Alta', render: (s) => formatDate(s.createdAt) },
              ]}
            />
            <Pagination page={page} total={subscribers.data.total} pageSize={PAGE_SIZE} label="suscriptores" onChange={setPage} />
          </>
        )}
      </div>
    </>
  )
}
