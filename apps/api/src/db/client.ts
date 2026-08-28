import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { sql } from 'drizzle-orm'
import ws from 'ws'
import * as globalSchema from './schema/global'
import * as tenantSchema from './schema/tenant'

// Required for WebSocket connections in Node.js (non-edge) environments
neonConfig.webSocketConstructor = ws

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/** Global DB — queries against the public schema (tenants, webhook_events, etc.) */
export const db = drizzle(pool, { schema: globalSchema })

/**
 * Execute queries scoped to a specific tenant schema.
 *
 * Uses SET LOCAL search_path inside a transaction so the path is automatically
 * reset when the transaction completes — safe with connection pooling.
 *
 * @example
 * const rows = await withTenant('crossfit-lagos', (tx) =>
 *   tx.select().from(schema.members).where(eq(schema.members.status, 'active'))
 * )
 */
export async function withTenant<T>(
  tenantSlug: string,
  fn: (tx: ReturnType<typeof drizzle<typeof tenantSchema>>) => Promise<T>,
): Promise<T> {
  const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`

  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL search_path TO "${schemaName}", public`))
    return fn(tx as unknown as ReturnType<typeof drizzle<typeof tenantSchema>>)
  })
}

// ─── Raw query helpers ────────────────────────────────────────────────────────
// Used by background workers that need raw pg results

/** Run a parameterised query against the global (public) schema */
export async function globalQuery<T extends object>(
  query: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> {
  const result = await pool.query<T>(query, params)
  return { rows: result.rows }
}

/** Run a parameterised query scoped to a specific tenant schema */
export async function tenantQuery<T extends object>(
  tenantSlug: string,
  query: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> {
  const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`
  const client = await pool.connect()
  try {
    await client.query(`SET search_path TO "${schemaName}", public`)
    const result = await client.query<T>(query, params)
    return { rows: result.rows }
  } finally {
    client.release()
  }
}

/** Convenience re-export so routes only import from this file */
export { globalSchema, tenantSchema, sql }
export { eq, and, or, desc, asc, count, sum, gte, lte, isNull, isNotNull, inArray } from 'drizzle-orm'
