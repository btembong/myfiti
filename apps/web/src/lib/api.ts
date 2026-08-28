import { getToken, getTenantSlug, getSuperToken, decodeToken, clearToken } from './auth'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message)
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { tenant?: string } = {},
): Promise<T> {
  const token = getToken()
  const tenantSlug =
    (options as { tenant?: string }).tenant ??
    getTenantSlug() ??
    (token ? (decodeToken(token)?.tenant_slug as string | null) : null)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug

  const res = await fetch(path, { ...options, headers })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      clearToken()
      window.location.href = '/login'
    }
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data)
  }

  return data as T
}

async function superRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSuperToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data)
  return data as T
}

export const superApi = {
  get: <T>(path: string, opts?: RequestInit) =>
    superRequest<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    superRequest<T>(path, { ...opts, method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    superRequest<T>(path, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, opts?: RequestInit) =>
    superRequest<T>(path, { ...opts, method: 'DELETE' }),
}

export async function downloadCsv(path: string, filename: string) {
  const token = getToken()
  const tenantSlug = getTenantSlug()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug

  const res = await fetch(path, { headers })
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const api = {
  get: <T>(path: string, opts?: RequestInit) =>
    request<T>(path, { ...opts, method: 'GET' }),

  post: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    request<T>(path, { ...opts, method: 'POST', body: JSON.stringify(body) }),

  patch: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    request<T>(path, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),

  put: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    request<T>(path, { ...opts, method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(path: string, opts?: RequestInit) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
}
