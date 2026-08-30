import type { Response } from 'express'

// ─── SSE client registry ──────────────────────────────────────────────────────
// Keyed by tenant slug — each value is a Set of active SSE Response objects.

const clients = new Map<string, Set<Response>>()

export function addKioskClient(tenantSlug: string, res: Response): () => void {
  if (!clients.has(tenantSlug)) clients.set(tenantSlug, new Set())
  clients.get(tenantSlug)!.add(res)
  return () => clients.get(tenantSlug)?.delete(res)
}

export function broadcastCheckin(tenantSlug: string, data: object) {
  const conns = clients.get(tenantSlug)
  if (!conns?.size) return
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const res of conns) {
    try { res.write(payload) }
    catch { conns.delete(res) }
  }
}
