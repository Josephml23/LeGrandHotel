// Genera docs/informes/informe-final/LeGrandHotel_Informe_del_proyecto.docx:
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
const OUT = path.join(BASE, 'LeGrandHotel_Informe_del_proyecto.docx')

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
  cov('INFORME DEL PROYECTO: FUNCIONALIDADES, PRUEBAS Y DISEÑO MÓVIL', { bold: true }),
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
  p('La página web y la app móvil no guardan datos: le piden todo a la API en formato JSON con el token de la sesión. La API valida cada petición (FormRequest), revisa el rol (middleware role:) y las reglas por registro (policies), y responde siempre con el mismo formato, sea éxito o error. La base de datos MySQL tiene 16 tablas del sistema relacionadas por 13 claves foráneas; el diagrama de la página siguiente se generó leyendo el esquema real de la base.'),
]

const sDiagrama = [
  // PNG de alta resolución: Word dibuja mal el texto del SVG de matplotlib.
  ...img(path.join(ROOT, 'docs/diagramas/bd/diagrama-bd.png'),
    'Diagrama de la base de datos (MySQL), generado desde information_schema: tablas, columnas, claves y regla ON DELETE de cada relación. Versión ampliable en docs/diagramas/bd/diagrama-bd.pdf.', 24.5, 17),
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
  ...screen('35-admin-registrar-personal', 'Registrar personal (Administrador).', 'Crea la cuenta de una persona del hotel con su contraseña inicial. Solo ofrece Recepcionista, Almacenero y Administrador; el aviso recuerda que el hotel tiene un solo Programador. La nueva cuenta recibe un correo para verificarse.'),
  ...screen('50-cliente-completar-registro', 'Completar registro del cliente después de Google.', 'El nombre y el correo vienen de Google y no se editan. El huésped escribe su DNI y su teléfono una sola vez; si su DNI ya estaba registrado en recepción, se vincula esa ficha en vez de crear otra.'),
]

// ── 4. Roles ─────────────────────────────────────────────
const Y = '✓'
const N = '—'
const s4 = [
  h1('4. Qué puede hacer cada rol'),
  p('Cada rol ve en el menú solo sus pestañas. Las capturas de esta sección se tomaron el 27 de octubre de 2026 con la página funcionando sobre la base MySQL del proyecto, con los datos de demostración (70 habitaciones, 1000 huéspedes y 5000 reservas).'),
  table(['Pestaña', 'Admin.', 'Recep.', 'Almacén', 'Program.', 'Cliente'], [
    ['Panel', Y, Y, Y, N, N],
    ['Reservas, Estadías, Habitaciones, Clientes, Cochera', Y, Y, N, N, N],
    ['Tipos de habitación', 'edita', 've', N, N, N],
    ['Inventario', Y, N, Y, N, N],
    ['Personal, Usuarios y roles, Reportes, Auditoría, Facturación', Y, N, N, N, N],
    ['Registrar personal', Y, N, N, Y, N],
    ['Vista del programador', Y, N, N, Y, N],
    ['Completar registro, Reservar, Mis reservas', N, N, N, N, Y],
  ], [5, 1.3, 1.3, 1.3, 1.4, 1.3]),

  h2('4.1 Recepcionista'),
  p('Atiende a los huéspedes en el día a día: reserva por ellos, hace el check-in y el check-out, controla la cochera y el estado de las habitaciones.'),
  ...screen('10-recepcion-panel', 'Panel de Recepción.', 'Resumen del día: ocupación, llegadas y salidas de hoy con su botón de check-in, ingresos del mes y el tablero de habitaciones por piso con su estado (libre, ocupada, limpieza o mantenimiento).'),
  ...screen('11-recepcion-reservas', 'Reservas.', 'Lista paginada en el servidor con filtros por estado (confirmadas, hospedados, finalizadas, canceladas) y búsqueda por huésped o documento. Desde aquí se hace el check-in o se cancela una reserva.'),
  ...screen('12-recepcion-nueva-reserva', 'Nueva reserva.', 'Se busca al huésped, se eligen las fechas y solo aparecen las habitaciones libres para esas fechas y esa cantidad de personas. El total lo calcula el servidor (noches × precio); si otra persona toma la misma habitación al mismo tiempo, la API responde 409.'),
  ...screen('13-recepcion-estadias', 'Estadías.', 'Huéspedes que están dentro del hotel y su historial. El check-out cierra la estadía, pasa la habitación a limpieza y libera su espacio de cochera.'),
  ...screen('14-recepcion-habitaciones', 'Habitaciones.', 'Habitaciones por estado y tipo. Recepción marca como «lista» una habitación después de la limpieza.'),
  ...screen('15-recepcion-tipos', 'Tipos de habitación (solo lectura para Recepción).', 'Recepción consulta el precio por noche, la capacidad y lo que incluye cada tipo para informar al huésped, pero no puede cambiarlos.'),
  ...screen('16-recepcion-clientes', 'Clientes (huéspedes).', 'Fichas de huéspedes con documento, teléfono, si tienen cuenta web y cuántas reservas tienen. Solo se puede eliminar un huésped sin reservas.'),
  ...screen('17-recepcion-nuevo-cliente', 'Nuevo cliente.', 'Registro de un huésped que llega o llama: tipo y número de documento (único), nombre, teléfono y nacionalidad.'),
  ...screen('18-recepcion-cochera', 'Cochera.', 'Vehículos dentro y espacios libres. Cada entrada puede asociarse a una estadía.'),
  ...screen('19-recepcion-entrada-cochera', 'Registrar entrada a cochera.', 'Se anota la placa y el espacio; si el espacio ya está ocupado, la API responde 409 PARKING_SPOT_NOT_FREE.'),
  ...screen('19b-recepcion-403', 'Recepción intentando abrir Inventario.', 'Si alguien escribe a mano la dirección de una pestaña que no le corresponde, ve la pantalla 403. La API también responde 403, así que no hay forma de saltarse el permiso.'),

  h2('4.2 Almacenero'),
  p('Controla los insumos del hotel: lo que entra, lo que sale y lo que hay que reponer.'),
  ...screen('20-almacen-panel', 'Panel del Almacén.', 'Muestra los insumos que están por debajo del mínimo para reponerlos a tiempo.'),
  ...screen('21-almacen-inventario', 'Inventario.', 'Cada insumo con su stock, el mínimo y una barra de nivel. Se puede filtrar solo los que están bajo el mínimo.'),
  ...screen('22-almacen-movimiento', 'Registrar movimiento.', 'Entrada o salida con cantidad y motivo; abajo se ven los últimos movimientos. La API no deja sacar más de lo que hay (409 INSUFFICIENT_STOCK).'),
  ...screen('23-almacen-nuevo-insumo', 'Nuevo insumo.', 'Nombre, unidad, stock inicial y mínimo. Después el stock solo cambia con movimientos, para que todo quede registrado.'),

  h2('4.3 Administrador'),
  p('Es el responsable del sistema: tiene todas las pestañas del personal, define tipos y precios, gestiona al personal y sus cuentas, y revisa reportes y auditoría.'),
  ...screen('30-admin-panel', 'Panel del Administrador con el menú completo.', 'El mismo resumen del día, con todos los grupos del menú: Inicio, Recepción, Almacén, Administración y Programador.'),
  ...screen('31-admin-tipos', 'Tipos de habitación (Administrador).', 'A diferencia de Recepción, el Administrador puede crear, editar y eliminar tipos.'),
  ...screen('32-admin-nuevo-tipo', 'Nuevo tipo de habitación.', 'Nombre, capacidad, precio por noche, descripción y lo que incluye (separado por comas). Eso es lo que verá el cliente al reservar.'),
  ...screen('33-admin-personal', 'Personal.', 'Fichas del personal con cargo, turno y fecha de ingreso, cada una ligada a su cuenta.'),
  ...screen('34-admin-agregar-persona', 'Agregar persona del personal.', 'Crea la ficha y la cuenta en un solo paso. El rol Programador no aparece porque el hotel tiene uno solo.'),
  ...screen('36-admin-usuarios', 'Usuarios y roles.', 'Todas las cuentas con su rol y si verificaron el correo; se filtran por rol y se busca por nombre o correo.'),
  ...screen('37-admin-usuario-programador', 'Editar la cuenta del Programador.', 'La casilla Programador está bloqueada: no se puede dar ese rol a otra cuenta ni quitárselo al Programador. Sí se pueden editar su nombre, su correo y su contraseña.'),
  ...screen('38-admin-reportes', 'Reportes.', 'Ocupación de un rango de fechas e ingresos de los últimos 6 meses en un gráfico de barras.'),
  ...screen('39-admin-auditoria', 'Auditoría.', 'Quién creó, editó o eliminó cada registro, cuándo y desde qué IP, con los valores antes y después del cambio.'),
  ...screen('39b-admin-facturacion', 'Facturación.', 'Módulo previsto que todavía no está construido: muestra la pantalla «En construcción» en vez de un error.'),

  h2('4.4 Programador'),
  p('Da soporte técnico: ve el estado de la API sin entrar al servidor y registra cuentas del personal cuando hace falta.'),
  ...screen('40-dev-resumen', 'Vista del programador · Resumen.', 'Estado de la API, latencias p50, p95 y p99, porcentaje de errores 5xx y respuestas 4xx, y la configuración (sin mostrar secretos).'),
  ...screen('41-dev-peticiones', 'Vista del programador · Peticiones.', 'Últimas peticiones con su código y duración, y las rutas más lentas por p95.'),
  ...screen('42-dev-errores', 'Vista del programador · Errores.', 'Errores del servidor, buscables por el código de incidente que ve el usuario en la pantalla 500. Aquí aparece el incidente real JJA05WR4CG de la sección 6.'),
  ...screen('43-dev-rutas', 'Vista del programador · Rutas de la API.', 'Las rutas de la API con su método, si piden sesión, los roles que la pueden usar y su límite de peticiones.'),
  ...screen('44-dev-registrar-personal', 'Registrar personal (Programador).', 'El Programador también crea cuentas de Recepción, Almacén y Administración, pero no de Programador.'),

  h2('4.5 Cliente'),
  p('Es el huésped con cuenta propia: entra con Google, completa su DNI y teléfono una vez y reserva en línea. No ve nada del panel interno.'),
  ...screen('51-cliente-reservar', 'Reservar una habitación.', 'Elige llegada, salida y personas. Ve cada tipo con lo que incluye, cuántas habitaciones quedan libres y el total de su estadía. Los tipos que no alcanzan para esa cantidad de personas no aparecen.'),
  ...screen('52-cliente-confirmar-reserva', 'Confirmar la reserva.', 'Resumen con fechas, noches y total antes de confirmar. Al confirmar, el hotel le asigna una habitación libre de ese tipo; si otra persona la toma en ese instante, el sistema prueba con la siguiente.'),
  ...screen('53-cliente-mis-reservas', 'Mis reservas.', 'Sus reservas con habitación, fechas, total y estado. Puede cancelar una reserva confirmada mientras falte al menos un día para la llegada.'),
  ...screen('54-cliente-403', 'Cliente intentando abrir el panel del personal.', 'Un cliente no puede entrar a ninguna pestaña del personal: ve la pantalla 403 y la API responde 403.'),
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
  ...img(path.join(K6, 'capturas/d1-dashboard-50vu.png'), 'Reporte HTML de k6 del escalón de 50 usuarios.', 15),
  p('Interpretación del reporte: en «HTTP Performance overview» la curva de peticiones por segundo se aplana en unas 5/s mientras el p95 sube hasta casi 10 s, y la de peticiones fallidas queda en 0. En «VUs» se ve la subida a 50 usuarios, la meseta de 45 segundos y la bajada.'),
  h2('7.4 Conclusión de las pruebas'),
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
  bullet('LeGrandHotel cubre la operación completa del hotel para cuatro roles del personal y la reserva en línea para los huéspedes, con 77 endpoints REST que responden siempre con el mismo formato.'),
  bullet('El registro y el login están separados: el personal entra con correo y contraseña y lo registran el Administrador o el Programador; los clientes entran solo con Google. Hay un solo Programador y la API lo hace cumplir.'),
  bullet('Los permisos se revisan dos veces: la web oculta lo que no corresponde y la API responde 403 aunque alguien escriba la dirección a mano.'),
  bullet('El registro de incidentes y el código de incidente permitieron encontrar y corregir cada falla el mismo día.'),
  bullet('Las pruebas k6 muestran una API correcta y sin errores bajo carga; su velocidad en la laptop está limitada por el servidor de desarrollo, y se medirá de nuevo cuando se defina el servidor.'),
  bullet('La app móvil reutilizará la API y las tecnologías de la web, y se construirá por etapas empezando por el login y el flujo del cliente.'),
]

// ── documento ────────────────────────────────────────────
const margins = { top: Math.round(2.5 * CM), bottom: Math.round(2.5 * CM), left: Math.round(2.5 * CM), right: Math.round(2.5 * CM) }
const footer = { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) }
const portrait = (children) => ({ properties: { page: { margin: margins, size: { width: 11906, height: 16838 } } }, footers: footer, children })
const landscape = (children) => ({ properties: { page: { margin: { ...margins, top: Math.round(1.5 * CM), bottom: Math.round(1.5 * CM) }, size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE } } }, footers: footer, children })

const doc = new Document({
  creator: 'Equipo LeGrandHotel',
  title: 'LeGrandHotel – Informe del proyecto',
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
    portrait([...caratula, ...s1]),
    landscape(sDiagrama),
    portrait([...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8]),
    landscape(sMaquetas),
    portrait([...s9, ...s10]),
  ],
})

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT, `${figure} figuras`) })
