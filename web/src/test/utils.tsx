import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../auth/AuthContext'
import { ToastProvider } from '../components/Toasts'
import { sessionStore } from '../lib/session'
import type { RoleName } from '../types'

export function loginAs(roles: RoleName[] | null, verified = true) {
  if (!roles) return
  sessionStore.write({
    token: 'test-token',
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: 1, name: 'Ana Prueba', email: 'ana@test.pe', email_verified: verified, roles },
  })
}

export function renderApp(ui: ReactElement, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ToastProvider>{ui}</ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
