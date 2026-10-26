import axios, { AxiosError } from 'axios'
import type { ApiErrorBody, PageMeta } from '../types'
import { appEvents } from './events'
import { sessionStore } from './session'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = sessionStore.read()?.token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Error de la API con el formato único { success: false, error: { code, message, details } }. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorBody['error']['details']

  constructor(status: number, code: string, message: string, details?: ApiErrorBody['error']['details']) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }

  /** Primer mensaje de validación de un campo (422). */
  field(name: string): string | undefined {
    const value = this.details?.[name]
    return Array.isArray(value) ? value[0] : undefined
  }
}

const AUTH_PUBLIC = ['/auth/login', '/auth/register']

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const method = (error.config?.method ?? 'get').toLowerCase()
    const isRead = method === 'get'
    const url = error.config?.url ?? ''

    if (!error.response) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      if (offline) appEvents.emit({ type: 'offline' })
      else appEvents.emit({ type: 'service-unavailable', reason: 'No se pudo contactar con el servidor.', retryAfter: 30 })
      return Promise.reject(new ApiError(0, offline ? 'OFFLINE' : 'NETWORK_ERROR', 'Sin conexión con el servidor.'))
    }

    const { status, data, headers } = error.response
    const body = data?.error
    const apiError = new ApiError(status, body?.code ?? `HTTP_${status}`, body?.message ?? 'Error inesperado.', body?.details)
    const retryAfter = Number(headers['retry-after'] ?? body?.details?.retry_after ?? 30)

    if (status === 401 && !AUTH_PUBLIC.some((path) => url.endsWith(path))) {
      sessionStore.clear()
      appEvents.emit({ type: 'session-expired' })
    } else if (status === 429) {
      appEvents.emit({ type: 'rate-limited', retryAfter })
    } else if (status === 503) {
      appEvents.emit({ type: 'service-unavailable', reason: apiError.message, retryAfter })
    } else if (isRead && status === 403) {
      // Las lecturas sin permiso llevan a la pantalla 403; los formularios muestran el error en su sitio.
      appEvents.emit({ type: 'forbidden' })
    } else if (isRead && status >= 500) {
      appEvents.emit({ type: 'server-error', incidentId: body?.details?.incident_id })
    }

    return Promise.reject(apiError)
  },
)

export interface ListResult<T> {
  data: T[]
  meta: PageMeta
}

export async function getList<T>(path: string, params: Record<string, unknown> = {}): Promise<ListResult<T>> {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
  const { data } = await api.get(path, { params: clean })
  return { data: data.data as T[], meta: data.meta as PageMeta }
}

export async function getOne<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data } = await api.get(path, { params })
  return data.data as T
}

export async function send<T>(method: 'post' | 'put' | 'patch' | 'delete', path: string, body?: unknown): Promise<T> {
  const { data } = await api.request({ method, url: path, data: body })
  return (data?.data ?? null) as T
}
