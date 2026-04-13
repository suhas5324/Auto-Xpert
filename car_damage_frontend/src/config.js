const sanitizeBaseUrl = (value) => value.replace(/\/+$/, '')

const configuredBaseUrl = sanitizeBaseUrl(import.meta.env.VITE_API_BASE_URL?.trim() || '')

export const API_BASE_URL = configuredBaseUrl || (import.meta.env.DEV ? 'http://localhost:8000' : '')
export const API_CONFIGURATION_ERROR =
  'VITE_API_BASE_URL is not configured for this deployment. Set it in Vercel and redeploy.'

export function buildApiUrl(path) {
  if (!API_BASE_URL) {
    throw new Error(API_CONFIGURATION_ERROR)
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}
