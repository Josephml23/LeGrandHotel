import { Navigate, Route, Routes } from 'react-router-dom'
import { homeFor, useAuth } from './auth/AuthContext'
import { GuestRoute, ProtectedRoute } from './auth/ProtectedRoute'
import { AppEvents } from './components/AppEvents'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage'
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage'
import { DashboardPage } from './pages/DashboardPage'
import { RoomsPage } from './pages/RoomsPage'
import { RoomTypesPage } from './pages/RoomTypesPage'
import { ReservationsPage } from './pages/ReservationsPage'
import { StaysPage } from './pages/StaysPage'
import { ClientsPage } from './pages/ClientsPage'
import { ParkingPage } from './pages/ParkingPage'
import { InventoryPage } from './pages/InventoryPage'
import { StaffPage } from './pages/StaffPage'
import { UsersPage } from './pages/UsersPage'
import { ReportsPage } from './pages/ReportsPage'
import { AuditPage } from './pages/AuditPage'
import { MyReservationsPage } from './pages/client/MyReservationsPage'
import { ProfilePage } from './pages/client/ProfilePage'
import {
  ForbiddenPage,
  NotFoundPage,
  ServerErrorPage,
  ServiceUnavailablePage,
  SessionExpiredPage,
  TooManyRequestsPage,
  UnderConstructionPage,
} from './pages/errors/ErrorPages'

function Home() {
  const { user } = useAuth()
  return <Navigate to={homeFor(user)} replace />
}

export function App() {
  return (
    <AppEvents>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
        </Route>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/verificar-correo" element={<VerifyEmailPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route element={<ProtectedRoute roles={['admin', 'receptionist', 'storekeeper']} />}>
              <Route path="/panel" element={<DashboardPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['admin', 'receptionist']} />}>
              <Route path="/reservas" element={<ReservationsPage />} />
              <Route path="/estadias" element={<StaysPage />} />
              <Route path="/habitaciones" element={<RoomsPage />} />
              <Route path="/tipos-habitacion" element={<RoomTypesPage />} />
              <Route path="/clientes" element={<ClientsPage />} />
              <Route path="/cochera" element={<ParkingPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['admin', 'storekeeper']} />}>
              <Route path="/inventario" element={<InventoryPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="/personal" element={<StaffPage />} />
              <Route path="/usuarios" element={<UsersPage />} />
              <Route path="/reportes" element={<ReportsPage />} />
              <Route path="/auditoria" element={<AuditPage />} />
              <Route path="/facturacion" element={<UnderConstructionPage module="Facturación electrónica" />} />
            </Route>
            <Route element={<ProtectedRoute roles={['client']} />}>
              <Route path="/mis-reservas" element={<MyReservationsPage />} />
              <Route path="/reservar" element={<MyReservationsPage startBooking />} />
              <Route path="/mi-perfil" element={<ProfilePage />} />
            </Route>
            <Route path="/403" element={<ForbiddenPage />} />
          </Route>
        </Route>

        <Route path="/sesion-expirada" element={<SessionExpiredPage />} />
        <Route path="/demasiadas-peticiones" element={<TooManyRequestsPage />} />
        <Route path="/500" element={<ServerErrorPage />} />
        <Route path="/503" element={<ServiceUnavailablePage />} />
        <Route path="/en-construccion" element={<UnderConstructionPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppEvents>
  )
}
