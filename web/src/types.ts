/** Personal del hotel (correo y contraseña) y clientes (solo Google). */
export type RoleName = 'admin' | 'receptionist' | 'storekeeper' | 'developer' | 'client'

export const ROLE_LABELS: Record<RoleName, string> = {
  admin: 'Administrador',
  receptionist: 'Recepcionista',
  storekeeper: 'Almacenero',
  developer: 'Programador',
  client: 'Cliente',
}

/** Roles del personal: usan el panel interno. */
export const STAFF_ROLES: RoleName[] = ['admin', 'receptionist', 'storekeeper', 'developer']

export interface AuthUser {
  id: number
  name: string
  email: string
  email_verified: boolean
  roles: RoleName[]
  /** Solo en cuentas de cliente: null hasta que completa su DNI y teléfono. */
  client?: { id: number; document_number: string; phone: string | null } | null
}

export interface Session {
  token: string
  expires_at: string | null
  user: AuthUser
}

export interface PageMeta {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}

export interface ApiErrorBody {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string[]> & { retry_after?: number; incident_id?: string }
  }
}

export interface RoomType {
  id: number
  name: string
  description: string | null
  amenities: string[] | null
  capacity: number
  price_per_night: string
  rooms_count?: number
}

/** Tipo de habitación tal como lo ve el cliente al reservar: con disponibilidad y total para sus fechas. */
export interface RoomTypeOffer {
  id: number
  name: string
  description: string | null
  amenities: string[]
  capacity: number
  price_per_night: string
  available_rooms: number
  nights: number
  total: string
}

export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance'

export interface Room {
  id: number
  number: string
  floor: number
  status: RoomStatus
  room_type_id: number
  room_type?: Pick<RoomType, 'id' | 'name' | 'capacity' | 'price_per_night'>
}

export interface Client {
  id: number
  user_id: number | null
  document_type: 'DNI' | 'PASAPORTE' | 'CE'
  document_number: string
  full_name: string
  phone: string | null
  nationality: string | null
  reservations_count?: number
}

export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled'

export interface Stay {
  id: number
  reservation_id: number
  checked_in_at: string
  checked_out_at: string | null
  reservation?: Reservation
}

export interface Reservation {
  id: number
  client_id: number
  room_id: number
  check_in: string
  check_out: string
  guests: number
  status: ReservationStatus
  total: string
  notes: string | null
  client?: Pick<Client, 'id' | 'full_name' | 'document_number'>
  room?: Pick<Room, 'id' | 'number' | 'room_type_id'> & { room_type?: Pick<RoomType, 'id' | 'name'> & { amenities?: string[] | null } }
  stay?: Stay | null
}

export interface ParkingSpot {
  id: number
  code: string
  status: 'free' | 'occupied' | 'maintenance'
}

export interface ParkingAssignment {
  id: number
  parking_spot_id: number
  stay_id: number | null
  plate: string
  entered_at: string
  left_at: string | null
  parking_spot?: Pick<ParkingSpot, 'id' | 'code'>
  stay?: { reservation?: { client?: { full_name: string }; room?: { number: string } } } | null
}

export interface InventoryItem {
  id: number
  name: string
  unit: string
  stock: number
  min_stock: number
  low_stock: boolean
}

export interface InventoryMovement {
  id: number
  type: 'in' | 'out'
  quantity: number
  reason: string | null
  created_at: string
  user?: { id: number; name: string } | null
}

export interface Staff {
  id: number
  user_id: number
  position: string
  shift: 'morning' | 'afternoon' | 'night'
  hired_at: string
  user: { id: number; name: string; email: string; roles: { id: number; name: RoleName }[] }
}

export interface UserRow {
  id: number
  name: string
  email: string
  email_verified_at: string | null
  roles: { id: number; name: RoleName }[]
}

export interface AuditLog {
  id: number
  action: 'created' | 'updated' | 'deleted'
  entity: string
  entity_id: number | null
  changes: Record<string, unknown> | null
  created_at: string
  user?: { id: number; name: string } | null
}
