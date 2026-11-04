import { useState } from 'react'
import { ErrorState } from '../../components/ui/ErrorState'
import { useAsync } from '../../hooks/useAsync'
import { formatDate } from '../../lib/format'
import { Pagination } from '../components'
import { listMessages, PAGE_SIZE } from '../services'

export function MessagesPage() {
  const [page, setPage] = useState(0)
  const messages = useAsync(`admin:messages:${page}`, () => listMessages(page), { keepPrevious: true })

  return (
    <>
      <h1 className="font-serif text-4xl md:text-5xl">Mensajes de contacto</h1>
      <div className="mt-8" aria-busy={messages.loading}>
        {messages.error ? (
          <ErrorState what="los mensajes" onRetry={messages.retry} />
        ) : !messages.data ? (
          <div className="h-60 animate-pulse rounded-sm bg-crema-200" />
        ) : messages.data.rows.length === 0 ? (
          <p className="rounded-sm bg-crema-200/60 px-6 py-12 text-center text-tinta-soft">Todavía no hay mensajes.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-tinta-muted">{messages.data.total} mensajes</p>
            <ul className="space-y-4">
              {messages.data.rows.map((m) => (
                <li key={m.id}>
                  <article className="rounded-sm bg-crema-50 p-5" aria-labelledby={`msg-${m.id}`}>
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 id={`msg-${m.id}`} className="font-medium">
                        {m.name}{' '}
                        <a href={`mailto:${m.email}`} className="text-sm font-normal text-tinta-soft underline underline-offset-4">
                          {m.email}
                        </a>
                      </h2>
                      <time dateTime={m.createdAt} className="text-sm text-tinta-muted">
                        {formatDate(m.createdAt)}
                      </time>
                    </header>
                    <p className="mt-3 whitespace-pre-line break-words text-sm text-tinta-soft">{m.message}</p>
                  </article>
                </li>
              ))}
            </ul>
            <Pagination page={page} total={messages.data.total} pageSize={PAGE_SIZE} label="mensajes" onChange={setPage} />
          </>
        )}
      </div>
    </>
  )
}
