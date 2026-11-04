/**
 * Levanta el mock de Supabase de los tests (tests/supabase-mock.ts) como servidor HTTP, para
 * medir o ver la app sin tocar la base real:
 *
 *   npx tsx scripts/mock-api.ts [puerto]
 *
 * Reusa el mismo handler de page.route adaptando el pedido HTTP a la interfaz de Route/Request.
 * Los datos viven en memoria y se pierden al cortarlo.
 */
import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
import type { Page, Route } from '@playwright/test'
import { mockSupabase } from '../tests/supabase-mock'

const port = Number(process.argv[2] ?? 54399)

type Matcher = (url: URL) => boolean
type Handler = (route: Route) => Promise<void>

let matcher: Matcher | undefined
let handler: Handler | undefined

const fakePage = {
  route: async (m: Matcher, h: Handler) => {
    matcher = m
    handler = h
  },
} as unknown as Page

await mockSupabase(fakePage)

createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (c: Buffer) => chunks.push(c))
  req.on('end', () => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    const body = Buffer.concat(chunks)
    if (!matcher?.(url) || !handler) {
      res.writeHead(404).end()
      return
    }
    const request = {
      method: () => req.method,
      url: () => url.href,
      headers: () => req.headers,
      postData: () => (body.length ? body.toString() : null),
      postDataJSON: () => (body.length ? JSON.parse(body.toString()) : null),
      postDataBuffer: () => body,
    }
    const route = {
      request: () => request,
      fulfill: async ({ status = 200, headers = {}, body: out }: { status?: number; headers?: Record<string, string>; body?: string | Buffer }) => {
        // Supabase comprime las respuestas de la API
        if (out && String(req.headers['accept-encoding']).includes('gzip')) {
          res.writeHead(status, { ...headers, 'content-encoding': 'gzip' }).end(gzipSync(out))
        } else {
          res.writeHead(status, headers).end(out)
        }
      },
      abort: async () => void req.destroy(),
    } as unknown as Route
    handler(route).catch((err: unknown) => {
      console.error(err)
      res.writeHead(500).end()
    })
  })
}).listen(port, () => console.log(`Mock de Supabase en http://localhost:${port}`))
