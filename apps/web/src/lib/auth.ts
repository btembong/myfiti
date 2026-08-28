const TOKEN_KEY = 'myfiti_token'
const TENANT_KEY = 'myfiti_tenant'
const SUPER_TOKEN_KEY = 'myfiti_super_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TENANT_KEY)
}

export function setTenantSlug(slug: string): void {
  localStorage.setItem(TENANT_KEY, slug)
}

export function getTenantSlug(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TENANT_KEY)
}

export function getSuperToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SUPER_TOKEN_KEY)
}

export function setSuperToken(token: string): void {
  localStorage.setItem(SUPER_TOKEN_KEY, token)
}

export function clearSuperToken(): void {
  localStorage.removeItem(SUPER_TOKEN_KEY)
}

/** Decode JWT payload without verification (client-side only). */
export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token)
  if (!payload || typeof payload.exp !== 'number') return true
  return Date.now() / 1000 > payload.exp
}
