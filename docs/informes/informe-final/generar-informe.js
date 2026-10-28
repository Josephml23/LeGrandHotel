// Genera docs/informes/informe-final/LeGrandHotel_Semana11.docx (versión en inglés: generar-informe-en.js):
// descripción y tecnologías, endpoints, registro y login, roles con su recorrido en capturas, pantallas de error,
// registro de incidentes, pruebas k6 y diseño de la app móvil.
//   node docs/informes/informe-final/generar-informe.js <logo_tecsup.jpg>
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, PageOrientation,
  HeadingLevel, PageBreak, Footer, PageNumber, LevelFormat, BorderStyle, ShadingType, TableOfContents, VerticalAlign,
} = require('docx')

const ROOT = 'C:/Proyectos/LeGrandHotel'
const BASE = path.join(ROOT, 'docs/informes/informe-final')
const CAPS = path.join(BASE, 'capturas')
const K6 = path.join(ROOT, 'docs/pruebas/informe-k6')
const LOGO = process.argv[2]
const OUT = path.join(BASE, 'LeGrandHotel_Semana11.docx')

const FONT = 'Times New Roman'
const CODE = 'Consolas'
const CM = 567
const PAGE_W = 11906 - 2 * Math.round(2.5 * CM)

// ── helpers ─────────────────────────────────────────────
const t = (text, o = {}) => new TextRun({ text, font: FONT, size: 24, ...o })
const b = (text) => t(text, { bold: true })
const c = (text, size = 18) => new TextRun({ text, font: CODE, size })
const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [t(children)], spacing: { after: 120, line: 300 }, alignment: AlignmentType.JUSTIFIED, ...o })
const center = (children, o = {}) => p(children, { alignment: AlignmentType.CENTER, ...o })
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 240, after: 160 } })
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 200, after: 120 } })
const bullet = (children) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: Array.isArray(children) ? children : [t(children)], spacing: { after: 60, line: 288 } })
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })
const caption = (text) => center([t(text, { italics: true, size: 20 })], { spacing: { after: 200 } })
const gap = () => p('', { spacing: { after: 80 } })
const lead = (label, text) => p([b(label), t(text)])

/** Fragmento de código con su archivo de origen. */
function code(file, lines) {
  return [
    new Paragraph({ keepNext: true, spacing: { before: 60, after: 0 }, children: [t(file, { bold: true, size: 19, color: '444444' })] }),
    ...lines.map((l, i) => new Paragraph({
      keepNext: i < lines.length - 1, keepLines: true,
      children: [c(l)], spacing: { after: i === lines.length - 1 ? 160 : 0, line: 240 },
      shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' }, indent: { left: 200 },
    })),
  ]
}

let figure = 0
function img(file, label, widthCm = 15, maxHcm = 21) {
  const data = fs.readFileSync(file)
  const w = data.readUInt32BE(16)
  const h = data.readUInt32BE(20)
  let pxW = Math.round(widthCm * 37.8)
  const maxH = Math.round(maxHcm * 37.8)
  if (pxW * h / w > maxH) pxW = Math.round(maxH * w / h)
  figure += 1
  return [
    center([new ImageRun({ type: 'png', data, transformation: { width: pxW, height: Math.round(pxW * h / w) } })], { spacing: { after: 60 }, keepNext: true }),
    caption(`Figura ${figure}. ${label}`),
  ]
}
const shot = (name, label, widthCm = 15) => img(path.join(CAPS, `${name}.png`), label, widthCm)
/** Captura con su explicación debajo. */
const screen = (name, title, text) => [...shot(name, title), p(text, { spacing: { after: 220, line: 300 } })]

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: border, bottom: border, left: border, right: border }
function table(headers, rows, widths, total = PAGE_W) {
  const sum = widths.reduce((a, x) => a + x, 0)
  const scaled = widths.map((w) => Math.round((w / sum) * total))
  const cell = (text, i, head) => new TableCell({
    borders,
    width: { size: scaled[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'D9D9D9' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ children: [String(text).startsWith('`') ? c(String(text).slice(1), 17) : t(String(text), { size: 19, bold: !!head })], spacing: { after: 0 } })],
  })
  return new Table({
    width: { size: scaled.reduce((a, x) => a + x, 0), type: WidthType.DXA },
    columnWidths: scaled,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((hh, i) => cell(hh, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, i, false)) })),
    ],
  })
}

// ── datos reales ─────────────────────────────────────────
const k6 = (name) => JSON.parse(fs.readFileSync(path.join(K6, 'salidas', `${name}.json`), 'utf8')).metrics
const ms = (v) => `${Math.round(v).toLocaleString('es-PE')} ms`
const pct = (v) => `${(v * 100).toFixed(2)} %`
const smoke = k6('1-smoke')
const ESC = [5, 10, 25, 50].map((v) => {
  const m = k6(`3-escalon-${v}vu`)
  const d = m.http_req_duration
  return { vus: v, reqs: m.http_reqs.count, rps: m.http_reqs.rate, p50: d.med, p95: d['p(95)'], max: d.max, failed: m.http_req_failed.value }
})

const incidentes = fs.readFileSync(path.join(ROOT, 'docs/incidentes.md'), 'utf8').split('\n')
  .filter((l) => /^\| 20\d\d-/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((s) => s.trim().replace(/`/g, '')))

// ── carátula (skill caratula-tecsup) ─────────────────────
const cov = (text, o = {}, spacingAfter = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 360, after: spacingAfter }, children: [t(text, o)] })
const caratula = [
  cov('INSTITUTO TECNOLÓGICO SUPERIOR TECSUP', { bold: true }),
  cov('DISEÑO Y DESARROLLO DE SOFTWARE', {}, 240),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(LOGO), transformation: { width: 189, height: 113 } })] }),
  cov('CURSO: DESARROLLO DE SOLUCIONES EN LA NUBE', { bold: true }),
  cov('PROYECTO:', { bold: true }),
  cov('LeGrandHotel – Sistema web de gestión de hospedaje', { bold: true }, 240),
  cov('LeGrandHotel Semana11', { bold: true, size: 32 }, 120),
  cov('Funcionalidades, pruebas y diseño móvil'),
  cov('AREQUIPA, 2026', {}, 360),
  cov('Docente:', { bold: true }),
  cov('VÍCTOR CALVO', {}, 360),
  cov('Presentado por:', { bold: true }),
  cov('- Huacca Ccaso, Diego Armando'),
  cov('- Marcani Leyva, Joseph Fredy'),
  cov('- Pinto Garate, Leo Mathiu'),
  cov('- Quispe Encarnación, Rusell', {}, 360),
  cov('Arequipa – Perú', { bold: true }),
  cov('2026', { bold: true }),
  pageBreak(),
]

// ── 1. Descripción ───────────────────────────────────────
const s1 = [
  p([t('Índice', { bold: true, size: 30 })], { spacing: { after: 160 } }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),

  h1('1. Descripción del proyecto'),
  p('LeGrandHotel es un sistema web para gestionar un hotel. Reúne en un solo lugar el trabajo diario del personal (reservas, check-in y check-out, habitaciones, huéspedes, cochera e inventario) y la reserva en línea de los huéspedes, que eligen el tipo de habitación, ven lo que incluye y el total, y el hotel les asigna una habitación libre.'),
  p('El sistema tiene dos partes: una API REST que guarda los datos y aplica todas las reglas del negocio, y una página web (aplicación de una sola página) que la consume. La misma API servirá también a la aplicación móvil para Android e iOS que se diseña en la sección 8.'),
  h2('1.1 Objetivos'),
  bullet('Evitar errores de operación: que una habitación no se reserve dos veces en las mismas fechas, que no haya dos huéspedes en la misma habitación y que el inventario no quede en negativo.'),
  bullet('Que cada persona vea solo lo que le corresponde según su rol, y que la API lo haga cumplir aunque alguien intente entrar escribiendo la dirección a mano.'),
  bullet('Dejar rastro: cada cambio queda en la auditoría con quién lo hizo y cuándo, y cada error tiene un código de incidente para encontrarlo en el registro.'),
  bullet('Medir el rendimiento con pruebas de carga antes de publicar el sistema.'),
  h2('1.2 Módulos'),
  table(['Módulo', 'Qué cubre'], [
    ['Reservas y estadías', 'Reservas con cálculo del total en el servidor, check-in (crea la estadía y ocupa la habitación) y check-out (la habitación pasa a limpieza)'],
    ['Habitaciones y tipos', 'Habitaciones por piso y estado; tipos con precio por noche, capacidad y lo que incluyen'],
    ['Huéspedes', 'Fichas con documento, teléfono y nacionalidad; se vinculan con la cuenta web si el huésped tiene una'],
    ['Cochera', 'Espacios, entrada y salida de vehículos, con o sin estadía asociada'],
    ['Inventario', 'Insumos con stock y mínimo; entradas y salidas con motivo'],
    ['Personal y cuentas', 'Fichas del personal, registro de cuentas y cambio de roles'],
    ['Reportes y auditoría', 'Ocupación, ingresos de los últimos 6 meses y quién cambió qué'],
    ['Portal del cliente', 'Entrada con Google, datos del huésped, reserva en línea y sus reservas'],
    ['Vista del programador', 'Salud de la API, latencias, peticiones, errores y rutas, sin entrar al servidor'],
  ], [3, 8.5]),
  h2('1.3 Tecnologías'),
  table(['Parte', 'Tecnología', 'Para qué se usa'], [
    ['API (backend)', 'PHP 8.2 y Laravel 12', 'Rutas REST, validación, reglas del negocio y acceso a datos'],
    ['Autenticación', 'Laravel Sanctum', 'Tokens Bearer con vencimiento (60 minutos) para la web y la app móvil'],
    ['Inicio con Google', 'Laravel Socialite (OAuth 2.0)', 'Cuentas de clientes sin contraseña'],
    ['Base de datos', 'MySQL 8.4', 'Datos del hotel con claves foráneas, índices y transacciones'],
    ['Página web (frontend)', 'React 18, TypeScript y Vite', 'Interfaz de una sola página, rápida y con tipos'],
    ['Datos en la web', 'TanStack Query y Axios', 'Caché de consultas, paginación y manejo único de errores 401/403/429/5xx'],
    ['Navegación', 'React Router', 'Rutas protegidas por rol y pantallas de error'],
    ['Pruebas de la API', 'Pest (PHPUnit)', '121 pruebas automáticas de reglas, permisos y errores'],
    ['Pruebas de la web', 'Vitest y Testing Library', '25 pruebas de rutas, formularios y permisos'],
    ['Calidad de código', 'PHPStan nivel 5, Laravel Pint, ESLint y TypeScript estricto', 'Detectar errores antes de ejecutar y mantener un estilo único'],
    ['Pruebas de carga', 'k6 (Grafana)', 'Medir tiempos de respuesta y errores con muchos usuarios a la vez'],
    ['Entorno local', 'Docker Compose', 'La misma base MySQL para todo el equipo'],
    ['App móvil (diseño)', 'React Native con Expo y TypeScript', 'Una sola base de código para Android e iOS'],
    ['Control de versiones', 'Git y GitHub', 'Historial y trabajo en equipo'],
  ], [2.6, 3.6, 5.3]),
  gap(),
  p([b('Nota: '), t('el servidor donde se publicará el sistema todavía no está definido. Todo lo de este informe se ejecutó en el entorno local del equipo.')]),
  h2('1.4 Cómo se conectan las partes'),
  p('La página web y la app móvil no guardan datos: le piden todo a la API en formato JSON con el token de la sesión. La API valida cada petición (FormRequest), revisa el rol (middleware role:) y las reglas por registro (policies), y responde siempre con el mismo formato, sea éxito o error. La base de datos MySQL tiene 16 tablas del sistema relacionadas por 13 claves foráneas; el diagrama de la sección 1.5 se generó leyendo el esquema real de la base.'),
]

const DIAG = path.join(ROOT, 'docs/diagramas/bd')
const sDiagrama = [
  pageBreak(),
  h2('1.5 Diagrama de la base de datos'),
  p('El diagrama se divide en tres partes para que se lea bien. Cuando una tabla se relaciona con otra de una parte distinta, esa tabla aparece en un recuadro punteado solo con su id. Cada línea muestra la columna de la clave foránea y qué hace MySQL al borrar el registro padre (CASCADE, SET NULL o RESTRICT).'),
  ...img(path.join(DIAG, 'diagrama-bd-parte1.png'), 'Diagrama de la base de datos, parte 1: cuentas, permisos y auditoría.', 16, 21.5),
  ...img(path.join(DIAG, 'diagrama-bd-parte2.png'), 'Diagrama de la base de datos, parte 2: huéspedes, reservas y habitaciones.', 16, 21.5),
  ...img(path.join(DIAG, 'diagrama-bd-parte3.png'), 'Diagrama de la base de datos, parte 3: cochera e inventario.', 16, 21.5),
]

// ── 2. Endpoints ─────────────────────────────────────────
const s2 = [
  h1('2. Endpoints definidos'),
  p('Todas las rutas viven bajo /api/v1 y responden JSON. Son 77 rutas (contadas con php artisan route:list). En la tabla, «CRUD» significa listar (GET), crear (POST), ver (GET /{id}), editar (PUT/PATCH) y eliminar (DELETE).'),
  table(['Grupo', 'Método y ruta', 'Quién puede usarla'], [
    ['Salud', '`GET /health', 'Público'],
    ['Autenticación', '`POST /auth/login', 'Público (5 intentos por minuto)'],
    ['', '`GET /auth/google/redirect · /auth/google/callback', 'Público (clientes)'],
    ['', '`GET /auth/me · POST /auth/logout · POST /auth/refresh', 'Cualquier sesión'],
    ['', '`POST /auth/register', 'Administrador y Programador (3 por minuto)'],
    ['Correo', '`GET /email/verify/{id}/{hash} · POST /email/verification-notification', 'Enlace firmado · sesión'],
    ['Portal del cliente', '`PUT /portal/profile', 'Cliente'],
    ['', '`GET /portal/room-types', 'Cliente'],
    ['', '`GET · POST /portal/reservations', 'Cliente'],
    ['', '`POST /portal/reservations/{id}/cancel', 'Cliente (solo las suyas)'],
    ['Panel', '`GET /dashboard', 'Administrador, Recepcionista, Almacenero, Programador'],
    ['Tipos de habitación', '`GET /room-types · /room-types/{id}', 'Administrador y Recepcionista'],
    ['', '`POST · PUT · DELETE /room-types', 'Administrador'],
    ['Reservas', '`CRUD /reservations · POST /reservations/{id}/check-in', 'Administrador y Recepcionista'],
    ['Estadías', '`GET /stays · /stays/{id} · POST /stays/{id}/check-out', 'Administrador y Recepcionista'],
    ['Habitaciones', '`CRUD /rooms · GET /rooms/available · PATCH /rooms/{id}/status', 'Administrador y Recepcionista'],
    ['Huéspedes', '`CRUD /clients', 'Administrador y Recepcionista'],
    ['Cochera', '`CRUD /parking-spots · CRUD /parking-assignments', 'Administrador y Recepcionista'],
    ['Inventario', '`CRUD /inventory-items · GET · POST /inventory-items/{id}/movements', 'Administrador y Almacenero'],
    ['Personal', '`CRUD /staff', 'Administrador'],
    ['Usuarios', '`CRUD /users · PUT /users/{id}/roles', 'Administrador'],
    ['Reportes', '`GET /reports/occupancy · /reports/income', 'Administrador'],
    ['Auditoría', '`GET /audit-logs', 'Administrador'],
    ['Programador', '`GET /dev/overview · /dev/requests · /dev/errors · /dev/routes', 'Programador y Administrador'],
  ], [2.4, 5.6, 3.5]),
  gap(),
  h2('2.1 Formato único de respuesta'),
  p('Todas las respuestas usan App\\Support\\ApiResponse. Un éxito trae success y data (y meta en los listados paginados, con un máximo de 50 por página); un error trae un código estable que la web usa para decidir qué mostrar, nunca HTML ni trazas del servidor.'),
  ...code('Respuesta de error (ejemplo real: doble reserva)', [
    '{',
    '  "success": false,',
    '  "error": {',
    '    "code": "ROOM_ALREADY_BOOKED",',
    '    "message": "La habitación ya está reservada en esas fechas."',
    '  }',
    '}',
  ]),
  table(['Código HTTP', 'Cuándo responde la API', 'Qué muestra la web'], [
    ['401', 'Sin sesión o token vencido', 'Pantalla «Tu sesión terminó» y vuelve al login'],
    ['403', 'El rol no tiene permiso', 'Pantalla «No tienes acceso a esta sección»'],
    ['404', 'El registro o la ruta no existe', 'Pantalla «No encontramos esta página»'],
    ['409', 'Regla del negocio: doble reserva, habitación ocupada, stock insuficiente, Programador único…', 'Mensaje en el formulario'],
    ['422', 'Datos inválidos (FormRequest)', 'Error junto a cada campo'],
    ['429', 'Demasiados intentos (Retry-After)', 'Pantalla con cuenta regresiva'],
    ['500', 'Error inesperado, con código de incidente', 'Pantalla 500 con el código para soporte'],
    ['503', 'Servicio no disponible o sin conexión', 'Pantalla que reintenta sola'],
  ], [1.6, 5.2, 4.7]),
]

// ── 3. Registro y login ──────────────────────────────────
const s3 = [
  h1('3. Registro y login diferenciados'),
  p('Hay dos tipos de cuenta con caminos separados, tanto en la pantalla como en la API. Las reglas se validan en el servidor: aunque alguien modifique la página, la API rechaza lo que no corresponde.'),
  table(['', 'Personal del hotel', 'Cliente (huésped)'], [
    ['Roles', 'Administrador, Recepcionista, Almacenero, Programador', 'Cliente'],
    ['Cómo entra', 'Correo y contraseña (POST /auth/login)', 'Solo con Google (OAuth); no tiene contraseña'],
    ['Quién crea la cuenta', 'El Administrador o el Programador, desde «Registrar personal». No hay registro público', 'Se crea sola la primera vez que entra con Google'],
    ['Datos extra', 'Ficha de personal: cargo, turno y fecha de ingreso', 'DNI (8 dígitos) y teléfono (9 dígitos), una sola vez'],
    ['Protección', '5 intentos de login por minuto; contraseña cifrada con bcrypt; mínimo 8 caracteres con letras y números', 'Google verifica el correo; un DNI no puede quedar ligado a dos cuentas'],
    ['A dónde llega', 'Al panel de su rol', 'A «Completar registro» y luego a «Reservar»'],
  ], [2.4, 4.6, 4.5]),
  gap(),
  p([b('El Programador es único. '), t('Ni el Administrador ni el Programador pueden crear otra cuenta de Programador, darle ese rol a otra persona, quitárselo al que existe o eliminarlo. La API responde 409 DEVELOPER_UNIQUE o DEVELOPER_LOCKED si se intenta.')]),
  ...shot('00-login', 'Login: el personal entra con correo y contraseña; el huésped, con «Continuar con Google».'),
  h2('3.1 Fragmentos de código'),
  p('El login con contraseña solo deja entrar al personal; un cliente que intente usarlo recibe 403:'),
  ...code('api/app/Http/Controllers/Api/AuthController.php', [
    "if (! $user || ! $user->password || ! Hash::check($request->string('password'), $user->password)) {",
    "    throw new ApiException('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.', 401);",
    '}',
    '// Con contraseña solo entra el personal; los clientes entran con Google (no tienen contraseña).',
    'if (! $user->hasRole(...Role::INTERNAL)) {',
    "    throw new ApiException('ACCOUNT_WITHOUT_ACCESS', 'Esta cuenta no tiene acceso al sistema del hotel.', 403);",
    '}',
  ]),
  p('El registro del personal solo acepta los roles permitidos, y está protegido en la ruta por rol y por límite de intentos:'),
  ...code('api/routes/api.php y api/app/Http/Requests/Auth/RegisterRequest.php', [
    "Route::post('register', [AuthController::class, 'register'])",
    "    ->middleware(['role:admin,developer', 'throttle:register']);",
    '',
    "'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],",
    "'role'     => ['required', Rule::in(Role::ASSIGNABLE)],   // Recepción, Almacén o Administración",
  ]),
  p('Google es solo para clientes: si el correo ya pertenece a alguien del personal, se le devuelve al login con un aviso:'),
  ...code('api/app/Http/Controllers/Api/GoogleAuthController.php', [
    "$user = User::where('google_id', $googleUser->getId())->orWhere('email', $googleUser->getEmail())->first();",
    '// Google es solo para clientes: el personal entra con su correo y contraseña.',
    'if ($user && ! $user->hasRole(Role::CLIENT)) {',
    '    return redirect()->away("{$frontend}/login?error=google_personal");',
    '}',
  ]),
  p('En la web, cada ruta declara qué roles la pueden abrir; si no corresponde, se muestra la pantalla 403 (y la API también responde 403):'),
  ...code('web/src/auth/ProtectedRoute.tsx', [
    'export function ProtectedRoute({ roles }: { roles?: RoleName[] }) {',
    '  const { user, hasRole } = useAuth()',
    '  if (!user) return <Navigate to="/login" replace />',
    '  if (roles && !hasRole(...roles)) return <ForbiddenPage />',
    '  return <Outlet />',
    '}',
  ]),
  h2('3.2 Pantallas de registro'),
  p('Las pantallas «Registrar personal» y «Completar registro» del cliente se muestran con su descripción en las secciones 4.3 y 4.5.'),
]

// ── 4. Roles ─────────────────────────────────────────────
const ROLES_DIR = path.join(BASE, 'capturas-roles')
const Y = '✓'
const N = '—'
/** Título y descripción arriba; debajo la captura (vista sin menú o ventana emergente). */
function vista(name, titulo, texto, widthCm = 15.5) {
  return [
    new Paragraph({ keepNext: true, spacing: { before: 200, after: 60 }, children: [b(titulo)] }),
    p(texto, { keepNext: true }),
    ...img(path.join(ROLES_DIR, `${name}.png`), titulo, widthCm, 19),
  ]
}
const emergente = (name, titulo, texto) => vista(name, `Ventana emergente: ${titulo}`, texto, 11)
const menuRol = (name, rol, texto, widthCm = 5.5) => [
  new Paragraph({ keepNext: true, spacing: { before: 120, after: 60 }, children: [b(`Menú del ${rol}`)] }),
  p(texto, { keepNext: true }),
  ...img(path.join(ROLES_DIR, `${name}.png`), `Menú del ${rol}.`, widthCm, 15),
]

const s4 = [
  h1('4. Qué puede hacer cada rol'),
  p('Cada rol ve en el menú solo sus opciones. Para cada rol se muestra primero su menú y después cada vista del menú por separado, sin la barra lateral, con la descripción de para qué sirve arriba de cada captura. Cuando una vista abre una ventana emergente (formulario), se muestra solo esa ventana. Las capturas se tomaron el 27 de octubre de 2026 con la página funcionando sobre la base MySQL del proyecto (70 habitaciones, 1000 huéspedes y 5000 reservas de demostración).'),
  table(['Opción del menú', 'Admin.', 'Recep.', 'Almacén', 'Program.', 'Cliente'], [
    ['Panel', Y, Y, Y, N, N],
    ['Reservas, Estadías, Habitaciones, Clientes, Cochera', Y, Y, N, N, N],
    ['Tipos de habitación', 'edita', 've', N, N, N],
    ['Inventario', Y, N, Y, N, N],
    ['Personal, Usuarios y roles, Reportes, Auditoría, Facturación', Y, N, N, N, N],
    ['Registrar personal', Y, N, N, Y, N],
    ['Vista del programador', Y, N, N, Y, N],
    ['Reservar, Mis reservas', N, N, N, N, Y],
  ], [5, 1.3, 1.3, 1.3, 1.4, 1.3]),
  gap(),
  p('Si alguien escribe a mano la dirección de una opción que no está en su menú, ve la pantalla 403 (sección 5) y la API también responde 403.'),

  pageBreak(),
  h2('4.1 Recepcionista'),
  p('Atiende a los huéspedes en el día a día: reserva por ellos, hace el check-in y el check-out, controla la cochera y el estado de las habitaciones.'),
  ...menuRol('rec-00-menu', 'Recepcionista', 'Tiene el grupo «Inicio» con el Panel y el grupo «Recepción» con sus seis vistas de trabajo. No ve Inventario ni las opciones de Administración.'),
  ...vista('rec-01-panel', 'Panel de Recepción', 'Resumen del día: ocupación, habitaciones libres, llegadas y salidas de hoy y habitaciones en limpieza. A la derecha, las llegadas del día con su botón de check-in y los insumos bajo el mínimo; abajo, el tablero de habitaciones por piso con su estado.'),
  ...vista('rec-02-reservas', 'Reservas', 'Lista de reservas paginada en el servidor, con pestañas por estado (confirmadas, por confirmar, hospedados, finalizadas y canceladas) y búsqueda por huésped o documento. Desde cada fila se hace el check-in o se cancela la reserva.'),
  ...emergente('rec-02b-nueva-reserva', 'Nueva reserva', 'Se busca al huésped, se eligen las fechas y la cantidad de huéspedes, y solo aparecen las habitaciones libres para esas fechas. El total lo calcula el servidor; si otra persona toma la misma habitación al mismo tiempo, la API responde 409.'),
  ...vista('rec-03-estadias', 'Estadías', 'Huéspedes que están dentro del hotel y el historial de estadías. El check-out cierra la estadía, pasa la habitación a limpieza y libera su espacio de cochera.'),
  ...vista('rec-04-habitaciones', 'Habitaciones', 'Habitaciones con su piso, tipo, capacidad, precio y estado, filtrables por estado. Recepción las marca como «lista» después de la limpieza.'),
  ...vista('rec-05-tipos', 'Tipos de habitación (solo lectura)', 'Recepción consulta el precio por noche, la capacidad y lo que incluye cada tipo para informar al huésped, pero no puede crearlos ni cambiarlos.'),
  ...vista('rec-06-clientes', 'Clientes', 'Fichas de los huéspedes con su documento, teléfono, si tienen cuenta web y cuántas reservas tienen. Solo se puede eliminar un huésped sin reservas.'),
  ...emergente('rec-06b-nuevo-cliente', 'Nuevo cliente', 'Registro de un huésped que llega o llama: nombre, tipo y número de documento (no se puede repetir), teléfono y nacionalidad.'),
  ...vista('rec-07-cochera', 'Cochera', 'Vehículos que están dentro y los espacios de la cochera, con su estado.'),
  ...emergente('rec-07b-entrada', 'Registrar entrada a cochera', 'Se anota la placa, el espacio libre y, si corresponde, la estadía del huésped. Si el espacio ya está ocupado, la API responde 409 PARKING_SPOT_NOT_FREE.'),

  pageBreak(),
  h2('4.2 Almacenero'),
  p('Controla los insumos del hotel: lo que entra, lo que sale y lo que hay que reponer.'),
  ...menuRol('alm-00-menu', 'Almacenero', 'Tiene solo dos opciones: el Panel y el Inventario.'),
  ...vista('alm-01-panel', 'Panel del Almacén', 'Muestra los insumos que están por debajo del mínimo, para reponerlos a tiempo, y el botón para registrar un movimiento.'),
  ...vista('alm-02-inventario', 'Inventario', 'Cada insumo con su unidad, stock, mínimo y una barra de nivel; se pueden ver solo los que están bajo el mínimo. Desde cada fila se registra un movimiento o se edita el insumo.'),
  ...emergente('alm-02b-movimiento', 'Registrar movimiento', 'Entrada o salida con cantidad y motivo; abajo aparecen los últimos movimientos del insumo. La API no deja sacar más de lo que hay (409 INSUFFICIENT_STOCK).'),
  ...emergente('alm-02c-nuevo-insumo', 'Nuevo insumo', 'Nombre, unidad, stock inicial y mínimo. Después el stock solo cambia con movimientos, para que todo quede registrado.'),

  pageBreak(),
  h2('4.3 Administrador'),
  p('Es el responsable del sistema: tiene todas las opciones del personal, define tipos y precios, gestiona al personal y sus cuentas, y revisa reportes y auditoría.'),
  ...menuRol('adm-00-menu', 'Administrador', 'Es el menú completo: Inicio, Recepción, Almacén, Administración y Programador.', 4.6),
  ...vista('adm-01-panel', 'Panel del Administrador', 'El mismo resumen del día que Recepción, más los ingresos del mes.'),
  ...vista('adm-02-reservas', 'Reservas', 'Las mismas reservas que gestiona Recepción: el Administrador también puede crear, hacer check-in y cancelar.'),
  ...vista('adm-03-estadias', 'Estadías', 'Huéspedes dentro del hotel y el historial, con el check-out.'),
  ...vista('adm-04-habitaciones', 'Habitaciones', 'Habitaciones por estado; el Administrador además crea y edita habitaciones.'),
  ...emergente('adm-04b-nueva-habitacion', 'Nueva habitación', 'Número (único), piso, tipo y estado inicial de la habitación.'),
  ...vista('adm-05-tipos', 'Tipos de habitación', 'A diferencia de Recepción, el Administrador crea, edita y elimina tipos.'),
  ...emergente('adm-05b-nuevo-tipo', 'Nuevo tipo de habitación', 'Nombre, capacidad, precio por noche, descripción y lo que incluye, separado por comas. Es lo que verá el cliente al reservar.'),
  ...vista('adm-06-clientes', 'Clientes', 'Las fichas de huéspedes, igual que en Recepción.'),
  ...vista('adm-07-cochera', 'Cochera', 'Vehículos y espacios; el Administrador también agrega espacios.'),
  ...vista('adm-08-inventario', 'Inventario', 'El mismo inventario del Almacenero, con los mismos permisos.'),
  ...vista('adm-09-personal', 'Personal', 'Fichas del personal con su cargo, turno y fecha de ingreso, cada una ligada a su cuenta.'),
  ...emergente('adm-09b-agregar-persona', 'Agregar persona', 'Crea la ficha y la cuenta en un solo paso. El rol Programador no aparece porque el hotel tiene uno solo.'),
  ...vista('adm-10-registrar', 'Registrar personal', 'Crea la cuenta de una persona del hotel con su contraseña inicial. Solo ofrece Recepcionista, Almacenero y Administrador; la cuenta nueva recibe un correo para verificarse.'),
  ...vista('adm-11-usuarios', 'Usuarios y roles', 'Todas las cuentas con su rol y si verificaron el correo, con filtros por rol y búsqueda por nombre o correo.'),
  ...emergente('adm-11b-usuario-programador', 'Editar la cuenta del Programador', 'La casilla Programador está bloqueada: no se puede dar ese rol a otra cuenta ni quitárselo al Programador. Sí se pueden cambiar su nombre, su correo y su contraseña.'),
  ...vista('adm-12-reportes', 'Reportes', 'Ocupación de un rango de fechas e ingresos de los últimos 6 meses en un gráfico de barras.'),
  ...vista('adm-13-auditoria', 'Auditoría', 'Quién creó, editó o eliminó cada registro, cuándo y desde qué IP, con los valores antes y después del cambio.'),
  ...vista('adm-14-facturacion', 'Facturación', 'Módulo previsto que todavía no está construido: muestra «En construcción» en vez de un error.'),
  ...vista('adm-15-programador', 'Vista del programador', 'El Administrador también ve el diagnóstico de la API (detalle en la sección 4.4).'),

  pageBreak(),
  h2('4.4 Programador'),
  p('Da soporte técnico: revisa el estado de la API sin entrar al servidor y registra cuentas del personal cuando hace falta.'),
  ...menuRol('dev-00-menu', 'Programador', 'Tiene dos opciones: Registrar personal y la Vista del programador.'),
  ...vista('dev-01-registrar', 'Registrar personal', 'Igual que el Administrador, crea cuentas de Recepción, Almacén y Administración, pero no de Programador.'),
  ...vista('dev-02-resumen', 'Vista del programador · Resumen', 'Estado de la API, latencias p50, p95 y p99, porcentaje de errores 5xx y respuestas 4xx, y la configuración sin mostrar secretos. Se actualiza sola cada 10 a 15 segundos.'),
  ...vista('dev-03-peticiones', 'Vista del programador · Peticiones', 'Las rutas más lentas por p95 y las últimas peticiones con su código y su duración (se muestra la parte superior).'),
  ...vista('dev-04-errores', 'Vista del programador · Errores', 'Errores del servidor, buscables por el código de incidente que el usuario ve en la pantalla 500. Aparece el incidente real JJA05WR4CG de la sección 6.'),
  ...vista('dev-05-rutas', 'Vista del programador · Rutas de la API', 'Las 77 rutas con su método, si piden sesión, los roles que pueden usarlas y su límite de peticiones (se muestra la parte superior).'),

  pageBreak(),
  h2('4.5 Cliente'),
  p('Es el huésped con cuenta propia: entra con Google, completa su DNI y teléfono una vez y reserva en línea. No ve nada del panel del personal.'),
  ...vista('cli-00-completar-registro', 'Completar registro (antes del menú)', 'La primera vez que entra con Google aparece esta pantalla, todavía sin menú. El nombre y el correo vienen de Google; el huésped escribe su DNI (8 dígitos) y su teléfono (9 dígitos). Si su DNI ya estaba registrado en recepción, se vincula esa ficha.'),
  ...menuRol('cli-01-menu', 'Cliente', 'Su menú «Mi cuenta» tiene dos opciones: Reservar y Mis reservas.'),
  ...vista('cli-02-reservar', 'Reservar', 'Elige llegada, salida y personas; ve cada tipo de habitación con lo que incluye, cuántas quedan libres y el total de su estadía. Los tipos que no alcanzan para esa cantidad de personas no aparecen.'),
  ...emergente('cli-02b-confirmar', 'Confirmar reserva', 'Resumen con el tipo, las fechas, las noches y el total antes de confirmar. Al confirmar, el hotel le asigna una habitación libre de ese tipo.'),
  ...vista('cli-03-mis-reservas', 'Mis reservas', 'Sus reservas con habitación, fechas, noches, total y estado. Puede cancelar una reserva confirmada mientras falte al menos un día para la llegada.'),
]

// ── 5. Errores ───────────────────────────────────────────
const s5 = [
  h1('5. Pantallas de error'),
  p('Cada respuesta de error de la API tiene su pantalla, con el mismo estilo de la página, un mensaje claro y una salida (volver al inicio, recargar o iniciar sesión). Las decide un solo interceptor en web/src/lib/api.ts, así se comportan igual en todas las pestañas.'),
  ...img(path.join(ROOT, 'docs/diseno/errores.png'), 'Pantallas 401, 403, 404, 429, 500, 503, en construcción y sin conexión.', 15.5),
  table(['Pantalla', 'Cuándo aparece'], [
    ['401 · Sesión expirada', 'El token venció (60 minutos) o se cerró la sesión en otro lugar'],
    ['403 · Sin acceso', 'El rol no tiene permiso para esa pestaña o esa acción'],
    ['404 · No encontrada', 'La dirección no existe o el registro fue eliminado'],
    ['429 · Demasiadas peticiones', 'Se superó el límite (por ejemplo 5 logins por minuto); muestra cuánto esperar'],
    ['500 · Error del servidor', 'Algo falló; muestra el código de incidente para buscarlo en la Vista del programador'],
    ['503 · No disponible', 'La API no responde; reintenta sola cada 30 segundos'],
    ['En construcción', 'Módulo previsto pero aún no construido (Facturación)'],
    ['Sin conexión', 'El equipo perdió internet; vuelve sola al reconectarse'],
  ], [3.6, 7.9]),
]

// ── 6. Incidentes ────────────────────────────────────────
const s6 = [
  h1('6. Registro de incidentes'),
  p(`Toda caída o falla, aunque sea en el entorno local o en pruebas, se anota el mismo día en docs/incidentes.md con su causa y su solución. El registro tiene ahora ${incidentes.length} incidentes; ${incidentes.filter((i) => i[0] === '2026-10-27').length} son del 27 de octubre, al repetir las pruebas de carga, configurar el inicio con Google y revisar la Vista del programador.`),
  table(['Fecha', 'Qué falló', 'Causa', 'Solución', 'Tiempo'],
    incidentes.map(([fecha, _entorno, falla, motivo, solucion, tiempo]) => [fecha, falla, motivo, solucion, tiempo]),
    [1.5, 3, 3.4, 3.4, 1]),
  gap(),
  p([b('Cómo ayudó el código de incidente: '), t('cuando la API falla, responde 500 con un código (por ejemplo JJA05WR4CG) que el usuario ve en pantalla. El mismo código queda en el registro JSON de la API, y la Vista del programador lo encuentra en segundos (figura de la sección 4.4). Así se halló que el problema del primer inicio con Google era la contraseña de la base de datos, no Google.')]),
  ...code('Registro de la API (storage/logs/laravel.json), resumido', [
    '{"message": "SQLSTATE[HY000] [1045] Access denied for user \'legrandhotel\'…",',
    ' "context": {"incident_id": "JJA05WR4CG", "exception": "Illuminate\\\\Database\\\\QueryException"},',
    ' "level_name": "ERROR", "datetime": "2026-10-27T22:14:14-05:00"}',
  ]),
]

// ── 7. k6 ────────────────────────────────────────────────
const e5 = ESC[0]
const e50 = ESC[3]
const s7 = [
  h1('7. Pruebas de rendimiento y estrés con k6'),
  p('k6 simula muchos «usuarios virtuales» (VU) usando la API a la vez y mide cuánto tarda cada respuesta. Cada guion tiene metas (thresholds): si no se cumplen, k6 marca la prueba con ✗ y termina con código 99. Las corridas se hicieron el 27 de octubre de 2026 en la laptop del equipo, con la API en el servidor integrado de PHP (php -S, que atiende una petición a la vez) y la base con 5000 reservas.'),
  table(['Prueba', 'Qué hace', 'Para qué'], [
    ['1. Humo (smoke)', '5 VU durante 30 s piden /health y una ruta protegida sin token', 'Confirmar que la API, la base y la caché funcionan antes de cargar'],
    ['2. Límite de login', '6 intentos de login con contraseña incorrecta', 'Demostrar la protección contra fuerza bruta (429)'],
    ['3 a 6. Escalones', 'El trabajo de recepción (70 % consultas, 20 % login, 10 % crear reserva) con 5, 10, 25 y 50 VU, 1 minuto cada uno', 'Ver desde cuándo la API se pone lenta y si aparecen errores al subir la carga'],
  ], [2.6, 5, 3.9]),
  h2('7.1 Prueba de humo'),
  ...img(path.join(K6, 'capturas/t1-smoke.png'), 'Comando de la prueba de humo y la respuesta de k6.', 15),
  p(`Interpretación: las tres metas salen con ✓. El 95 % de las respuestas tardó menos de ${ms(smoke.http_req_duration['p(95)'])} (meta: 800 ms), no hubo peticiones fallidas (${pct(smoke.http_req_failed.value)}) y los ${smoke.checks.passes} checks pasaron: la API, la base de datos y la caché responden, y una ruta protegida sin token devuelve 401 en JSON.`),
  h2('7.2 Límite de intentos de login'),
  ...img(path.join(K6, 'capturas/t2-rate-limit.png'), 'Prueba del límite de login: el sexto intento recibe 429.', 15),
  p('Interpretación: «Estados recibidos: 401, 401, 401, 401, 401, 429». Los cinco primeros intentos responden 401 (contraseña incorrecta) y el sexto 429 con la cabecera Retry-After y el código TOO_MANY_REQUESTS. Nadie puede probar contraseñas sin límite.'),
  h2('7.3 Escalones de carga (5, 10, 25 y 50 usuarios)'),
  ...img(path.join(K6, 'capturas/t3-escalon-5vu.png'), 'Escalón de 5 usuarios: comando y respuesta.', 15),
  p(`Interpretación: con 5 usuarios todas las peticiones responden bien (0 % de errores y todos los checks ✓), pero la meta de velocidad sale con ✗: el p95 fue ${ms(e5.p95)} y la meta es 500 ms. La línea final «thresholds … have been crossed» es k6 avisando que la prueba no se aprobó.`),
  ...img(path.join(K6, 'capturas/t3-escalon-50vu.png'), 'Escalón de 50 usuarios: comando y respuesta.', 15),
  p(`Interpretación: con 50 usuarios sigue sin haber errores (${pct(e50.failed)}), pero el p95 sube a ${ms(e50.p95)}. La API no se cae: responde todo, solo que las peticiones esperan su turno.`),
  table(['Usuarios', 'Peticiones', 'Pet./s', 'Mediana', 'p95', 'Máximo', 'Errores', 'Meta p95 < 500 ms'],
    ESC.map((e) => [e.vus, e.reqs, e.rps.toFixed(1), ms(e.p50), ms(e.p95), ms(e.max), pct(e.failed), e.p95 < 500 ? '✓' : '✗']),
    [1.2, 1.4, 1.1, 1.6, 1.5, 1.5, 1.3, 1.8]),
  gap(),
  ...img(path.join(K6, 'graficos/01-latencia.png'), 'Tiempo de respuesta (mediana y p95) según la cantidad de usuarios.', 14.5),
  p(`Interpretación del gráfico: el eje horizontal son los usuarios a la vez y el vertical el tiempo de respuesta. La línea punteada es la meta de 500 ms. Las dos curvas suben casi en línea recta: al pasar de 5 a 50 usuarios el p95 crece de ${ms(e5.p95)} a ${ms(e50.p95)}. Que crezca en proporción a los usuarios es la señal de una cola: cada usuario nuevo espera a los anteriores.`),
  ...img(path.join(K6, 'graficos/02-peticiones-por-segundo.png'), 'Peticiones atendidas por segundo en cada escalón.', 14.5),
  p(`Interpretación del gráfico: las barras casi no cambian (de ${ESC[0].rps.toFixed(1)} a ${e50.rps.toFixed(1)} peticiones por segundo). Aunque haya diez veces más usuarios, la API atiende lo mismo por segundo: llegó a su techo. Junto con el gráfico anterior confirma el cuello de botella.`),
  h2('7.4 Reporte HTML de k6 (escalón de 50 usuarios)'),
  p('k6 genera además un reporte con gráficos del minuto que duró la prueba (salidas/3-escalon-50vu.html). Sus tres gráficos se muestran por separado. El eje horizontal es la hora (de 20:50:20 a 20:51:40) y cada punto resume 10 segundos.'),
  ...img(path.join(K6, 'capturas/d1a-http-performance.png'), 'HTTP Performance overview: peticiones por segundo, p95 y peticiones fallidas.', 16),
  p([b('Qué muestra: '), t('tres medidas a la vez, cada una con su propio eje. La línea verde es la cantidad de peticiones por segundo (eje de 2/s a 6/s); la azul, el p95 del tiempo de respuesta (eje derecho, de 0 a 10 s); la morada, el porcentaje de peticiones fallidas (eje izquierdo).')]),
  p([b('Interpretación: '), t(`hasta las 20:50:30 casi no hay carga y el p95 es bajo. Desde las 20:50:35, cuando entran los usuarios, el p95 sube de golpe hasta unos 9,7 s a las 20:51:00 y se queda entre 8 y 9 s el resto de la prueba (p95 total: ${ms(e50.p95)}). Las peticiones por segundo suben solo hasta unas 5,5/s y se aplanan: la API ya no atiende más aunque haya más usuarios esperando. La línea morada está pegada en 0 % todo el tiempo: ninguna de las ${e50.reqs} peticiones falló. Conclusión: la API se pone lenta, pero no se cae.`)]),
  ...img(path.join(K6, 'capturas/d1b-vus.png'), 'VUs: usuarios virtuales activos y peticiones por segundo.', 13),
  p([b('Qué muestra: '), t('la línea verde son los usuarios virtuales activos (eje izquierdo, de 0 a 50); la azul, las peticiones por segundo (eje derecho).')]),
  p([b('Interpretación: '), t('se ven las tres etapas del escalón: la subida de 0 a 50 usuarios entre las 20:50:38 y las 20:51:00, la meseta con 50 usuarios hasta las 20:51:30 y el inicio de la bajada al final. Antes de la subida ya hay peticiones con 0 usuarios: es la preparación (setup), que inicia sesión con los 50 recepcionistas de prueba. Lo importante es que la línea azul llega a su techo (unas 5,5/s) cuando todavía hay unos 40 usuarios y no sube más al llegar a 50: los usuarios extra solo agregan espera. Es la misma señal de cuello de botella del gráfico anterior.')]),
  ...img(path.join(K6, 'capturas/d1c-transfer-rate.png'), 'Transfer Rate: datos recibidos y enviados por segundo.', 13),
  p([b('Qué muestra: '), t('cuántos datos recibió k6 de la API (data_received, verde) y cuántos le envió (data_sent, azul), en kilobytes por segundo.')]),
  p([b('Interpretación: '), t('lo recibido varía entre 11 y 38 kB/s y tiene un pico a las 20:51:10. Varía porque depende de qué pidió cada usuario: una lista de reservas o de habitaciones libres pesa más que un login. Lo enviado se queda cerca de 1 a 2 kB/s porque las peticiones son pequeñas (un token y unos pocos datos). En total fueron 1,8 MB recibidos y 108 kB enviados en todo el minuto: la red está muy lejos de ser el límite, así que la lentitud viene de la API que procesa una petición a la vez, no de la cantidad de datos.')]),
  h2('7.5 Conclusión de las pruebas'),
  bullet('Correcta y estable: en las 6 corridas no hubo ni una petición fallida ni errores 500.'),
  bullet('Segura bajo carga: 401 sin sesión y 429 al pasar el límite de login, siempre en el formato JSON de la API.'),
  bullet('Lenta en la laptop por el servidor de desarrollo de PHP, que atiende una petición a la vez. La solución es correr la API con varios procesos PHP en paralelo y caché de código (OPcache) en el servidor definitivo, y repetir estas mismas pruebas allí, con más usuarios, cuando se defina el servidor.'),
]

// ── 8/9. App móvil ───────────────────────────────────────
const s8 = [
  h1('8. Diseño de la aplicación Android e iOS'),
  p('LeGrandHotel tendrá una aplicación para teléfonos que usa la misma API y los mismos roles que la web, sin duplicar ninguna regla del negocio. Cubre lo que conviene hacer desde el celular: el huésped reserva y revisa sus reservas, recepción atiende llegadas y salidas desde el lobby, y el almacén registra movimientos en el depósito.'),
  table(['Rol', 'Qué hará en la app'], [
    ['Cliente', 'Entrar con Google, completar DNI y teléfono, reservar por tipo de habitación, ver y cancelar sus reservas, recibir un recordatorio un día antes de llegar'],
    ['Recepcionista', 'Pantalla «Hoy» con llegadas y salidas, check-in y check-out, reservas, estado de habitaciones y cochera'],
    ['Almacenero', 'Ver el inventario con los insumos bajo el mínimo y registrar entradas y salidas'],
    ['Administrador', 'El panel resumido (ocupación, ingresos y alertas); la gestión completa sigue en la web'],
  ], [2.6, 8.9]),
  gap(),
]

const sMaquetas = [
  ...img(path.join(ROOT, 'docs/movil/maquetas.png'), 'Maquetas de la app: inicio de sesión, Reservar y Mis reservas del cliente, «Hoy» de recepción e Inventario del almacén.', 24.5, 15),
]

const s9 = [
  h2('8.1 Tecnología'),
  p([b('React Native con Expo y TypeScript. '), t('Con un solo código se generan las dos aplicaciones y se reutiliza lo que el equipo ya usa en la web: React, TypeScript, TanStack Query, Axios y los mismos tipos de datos.')]),
  table(['Necesidad', 'En la app', 'Equivalente en la web'], [
    ['Navegación', 'Expo Router, con barra de pestañas según el rol', 'React Router'],
    ['Llamadas a la API', 'TanStack Query y Axios con el mismo manejo de 401/403/429/5xx', 'Igual'],
    ['Guardar la sesión', 'expo-secure-store: Keychain (iOS) y Keystore (Android)', 'sessionStorage'],
    ['Inicio con Google', 'expo-auth-session con el enlace legrandhotel://auth/callback', 'Socialite con redirección'],
    ['Notificaciones', 'expo-notifications (recordatorio de llegada, habitación lista, stock bajo)', '—'],
    ['Desbloqueo', 'Huella o Face ID (expo-local-authentication)', '—'],
    ['Pruebas', 'Jest y Testing Library; Maestro para recorridos completos', 'Vitest y Playwright'],
  ], [2.6, 5.5, 3.4]),
  gap(),
  table(['Opción evaluada', 'A favor', 'En contra', 'Decisión'], [
    ['React Native + Expo', 'Un código para Android e iOS; mismo lenguaje que la web; compila iOS sin Mac (EAS Build)', 'Funciones nativas muy específicas requieren módulos propios', 'Elegida'],
    ['Flutter', 'Buen rendimiento y diseño uniforme', 'Otro lenguaje (Dart): no se reutiliza nada de la web', 'Descartada'],
    ['Nativo (Kotlin + Swift)', 'Acceso total al sistema', 'Dos aplicaciones distintas: el doble de trabajo', 'Descartada'],
  ], [2.6, 4, 3.6, 1.4]),
  h2('8.2 Seguridad y cambios en la API'),
  bullet('El token se guarda en el almacenamiento seguro del teléfono, nunca en texto plano, y se renueva con el mismo POST /auth/refresh de la web.'),
  bullet('La app no contiene secretos: las credenciales de Google y de la base de datos quedan solo en la API.'),
  bullet('La API casi no cambia: el login ya acepta un nombre de dispositivo (device_name) para que cada teléfono tenga su propio token. Faltará registrar el token de notificaciones de cada teléfono (POST /devices) y que el inicio con Google pueda volver a la app.'),
  h2('8.3 Plan de construcción'),
  table(['Etapa', 'Qué se construye'], [
    ['1', 'Proyecto Expo, login del personal y del cliente, sesión segura y barra de pestañas por rol'],
    ['2', 'Cliente: completar registro, reservar y mis reservas'],
    ['3', 'Recepción: «Hoy» con check-in y check-out, reservas y habitaciones; Almacén: inventario y movimientos'],
    ['4', 'Notificaciones, desbloqueo con huella, pruebas y versión de prueba para Android e iOS'],
  ], [1.4, 10.1]),
]

const s10 = [
  h1('9. Conclusiones'),
  p([b('1. El sistema cubre la operación completa del hotel. '), t('Con 77 endpoints REST y un formato único de respuesta, LeGrandHotel atiende reservas, estadías, habitaciones, huéspedes, cochera, inventario, personal, reportes y auditoría, y además la reserva en línea del huésped.')]),
  p([b('2. El acceso está separado y protegido. '), t('El personal entra con correo y contraseña y lo registran el Administrador o el Programador; los clientes entran solo con Google. Cada rol ve solo su menú, la API responde 403 aunque alguien escriba la dirección a mano y existe un solo Programador.')]),
  p([b('3. Las reglas del negocio las cuida el servidor. '), t('La API impide la doble reserva, dos huéspedes en la misma habitación, el stock negativo y la cochera ocupada (409), calcula los totales y deja cada cambio en la auditoría.')]),
  p([b('4. Las fallas se registran y se corrigen con evidencia. '), t('El registro de incidentes y el código de incidente que ve el usuario permitieron encontrar la causa de cada falla en el registro de la API y corregirla el mismo día, con una prueba automática nueva cuando correspondía.')]),
  p([b('5. La API es estable bajo carga y el siguiente paso está claro. '), t('En las pruebas k6 no hubo ni un error con hasta 50 usuarios a la vez; la velocidad en la laptop la limita el servidor de desarrollo y se medirá de nuevo cuando se defina el servidor. La app Android e iOS reutilizará esta misma API.')]),
]

// ── documento ────────────────────────────────────────────
const margins = { top: Math.round(2.5 * CM), bottom: Math.round(2.5 * CM), left: Math.round(2.5 * CM), right: Math.round(2.5 * CM) }
const footer = { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) }
const portrait = (children) => ({ properties: { page: { margin: margins, size: { width: 11906, height: 16838 } } }, footers: footer, children })
const landscape = (children) => ({ properties: { page: { margin: { ...margins, top: Math.round(1.5 * CM), bottom: Math.round(1.5 * CM) }, size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE } } }, footers: footer, children })

const doc = new Document({
  creator: 'Equipo LeGrandHotel',
  title: 'LeGrandHotel Semana11',
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  features: { updateFields: true },
  sections: [
    portrait([...caratula, ...s1, ...sDiagrama, pageBreak(), ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8]),
    landscape(sMaquetas),
    portrait([...s9, ...s10]),
  ],
})

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT, `${figure} figuras`) })
