import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getList, send } from './api'
import { useDebounced } from '../components/ui'
import { useToast } from '../components/Toasts'

/**
 * Listado paginado en el servidor con búsqueda (espera de 300 ms) y filtros.
 * La página vuelve a 1 cuando cambia la búsqueda o un filtro.
 */
export function useServerList<T>(resource: string, filters: Record<string, unknown> = {}, perPage = 15) {
  const [page, setPage] = useState(1)
  const [search, setSearchRaw] = useState('')
  const debounced = useDebounced(search)
  const params = { page, per_page: perPage, search: debounced, ...filters }

  const query = useQuery({
    queryKey: [resource, params],
    queryFn: () => getList<T>(`/${resource}`, params),
    placeholderData: keepPreviousData,
  })

  return {
    ...query,
    rows: query.data?.data,
    meta: query.data?.meta,
    page,
    setPage,
    search,
    setSearch: (value: string) => {
      setSearchRaw(value)
      setPage(1)
    },
  }
}

/** Mutación que, al terminar bien, avisa y refresca las listas indicadas. */
export function useAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  { invalidate, success }: { invalidate: string[]; success?: string },
) {
  const client = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      invalidate.forEach((key) => client.invalidateQueries({ queryKey: [key] }))
      client.invalidateQueries({ queryKey: ['dashboard'] })
      if (success) toast(success)
    },
  })
}

export const remove = (resource: string) => (id: number) => send('delete', `/${resource}/${id}`)
