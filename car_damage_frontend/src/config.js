const sanitizeBaseUrl = (value) => value.replace(/\/+$/, '')

const configuredBaseUrl = sanitizeBaseUrl(import.meta.env.VITE_API_BASE_URL?.trim() || '')

export const API_BASE_URL = configuredBaseUrl || (import.meta.env.DEV ? 'http://localhost:8000' : '')

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}
