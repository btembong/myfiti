/**
 * GymFlow migration runner.
 *
 * Usage:
 *   pnpm migrate                     — run global + all tenant migrations
 *   pnpm migrate --tenant crossfit-lagos  — run tenant migrations for one gym
 *   pnpm migrate --global            — run global migrations only
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Pool, type PoolClient } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const GLOBAL_MIGRATIONS_DIR = path.resolve('migrations/global')
const TENANT_MIGRATIONS_DIR = path.resolve('migrations/tenant')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMigrationFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()  // lexicographic order — filenames must start with 3-digit number
}

async function ensureMigrationHistory(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id         SERIAL PRIMARY KEY,
      filename   TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `)
}

async function runMigrations(client: PoolClient, dir: string, label: string) {
  await ensureMigrationHistory(client)

  const files = getMigrationFiles(dir)
  let applied = 0

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM migration_history WHERE filename = $1',
      [file]
    )
    if (rows.length > 0) continue  // already applied

    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    console.log(`  [${label}] applying ${file}`)
    await client.query(sql)
    await client.query(
      'INSERT INTO migration_history (filename) VALUES ($1)',
      [file]
    )
    applied++
  }

  if (applied === 0) {
    console.log(`  [${label}] up to date`)
  } else {
    console.log(`  [${label}] ${applied} migration(s) applied`)
  }
}

// ─── Global migrations ───────────────────────────────────────────────────────

async function migrateGlobal() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET search_path TO public')
    await runMigrations(client, GLOBAL_MIGRATIONS_DIR, 'global')
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Tenant migrations ───────────────────────────────────────────────────────

async function migrateTenant(slug: string) {
  const schema = `tenant_${slug.replace(/-/g, '_')}`
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
    await client.query(`SET search_path TO "${schema}"`)
    await runMigrations(client, TENANT_MIGRATIONS_DIR, slug)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

async function migrateAllTenants() {
  const { rows } = await pool.query<{ slug: string }>(
    `SELECT slug FROM public.tenants WHERE status NOT IN ('cancelled')`
  )
  console.log(`Found ${rows.length} active tenant(s)`)
  for (const { slug } of rows) {
    await migrateTenant(slug)
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const tenantFlag = args.find(a => a.startsWith('--tenant='))?.split('=')[1]
  const globalOnly = args.includes('--global')

  console.log('GymFlow migration runner\n')

  if (globalOnly) {
    console.log('Running global migrations...')
    await migrateGlobal()
  } else if (tenantFlag) {
    console.log(`Running global + tenant migrations for: ${tenantFlag}`)
    await migrateGlobal()
    await migrateTenant(tenantFlag)
  } else {
    console.log('Running global + all tenant migrations...')
    await migrateGlobal()
    await migrateAllTenants()
  }

  console.log('\nDone.')
  await pool.end()
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
