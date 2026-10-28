// English version of the project report: docs/informes/informe-final/LeGrandHotel_Week11.docx
// Same structure and data as generar-informe.js (Spanish). Application screenshots keep the Spanish UI.
//   node docs/informes/informe-final/generar-informe-en.js <logo_tecsup.jpg>
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType, PageOrientation,
  HeadingLevel, PageBreak, Footer, PageNumber, LevelFormat, BorderStyle, ShadingType, TableOfContents, VerticalAlign,
} = require('docx')

const ROOT = 'C:/Proyectos/LeGrandHotel'
const BASE = path.join(ROOT, 'docs/informes/informe-final')
const CAPS = path.join(BASE, 'capturas')
const ROLES_DIR = path.join(BASE, 'capturas-roles')
const K6 = path.join(ROOT, 'docs/pruebas/informe-k6')
const DIAG = path.join(ROOT, 'docs/diagramas/bd')
const LOGO = process.argv[2]
const OUT = path.join(BASE, 'LeGrandHotel_Week11.docx')

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

/** Code excerpt with its source file. */
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
    caption(`Figure ${figure}. ${label}`),
  ]
}

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

// ── real data ────────────────────────────────────────────
const k6 = (name) => JSON.parse(fs.readFileSync(path.join(K6, 'salidas', `${name}.json`), 'utf8')).metrics
const ms = (v) => `${Math.round(v).toLocaleString('en-US')} ms`
const pct = (v) => `${(v * 100).toFixed(2)}%`
const smoke = k6('1-smoke')
const ESC = [5, 10, 25, 50].map((v) => {
  const m = k6(`3-escalon-${v}vu`)
  const d = m.http_req_duration
  return { vus: v, reqs: m.http_reqs.count, rps: m.http_reqs.rate, p50: d.med, p95: d['p(95)'], max: d.max, failed: m.http_req_failed.value }
})
const e5 = ESC[0]
const e50 = ESC[3]

// Incident log (docs/incidentes.md), translated.
const INCIDENTS = [
  ['2026-10-26', 'Login returned 500 INTERNAL_ERROR with incident code XG1R7UASWT', 'php artisan serve starts child PHP processes without the pdo_sqlite extension, which was loaded with -d only in the parent ("could not find driver")', 'The local server is started with php -d extension=pdo_sqlite -S … (.claude/launch.json). The error came back as JSON without traces, as the plan requires', '~2 min'],
  ['2026-10-26', 'The frontend showed the 503 screen "Could not reach the server"', 'During the previous change the PHP server pointed to a server.php that looked for index.php in the wrong folder', 'api/public/index.php is used as the server router. The 503 screen retried by itself every 30 s', '~1 min'],
  ['2026-10-27', 'First k6 series: 100% failed requests', 'The PHP server listened only on IPv6 (::1) and k6 resolved localhost to IPv4 (127.0.0.1)', 'BASE_URL=http://[::1]:8000/api/v1; the invalid results were deleted and the 5 runs repeated', '~5 min'],
  ['2026-10-27', 'The first Google sign-in returned 500 INTERNAL_ERROR (incident JJA05WR4CG) and /health reported the database as down', 'While editing api/.env to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, one character of DB_PASSWORD was deleted: MySQL answered "Access denied for user legrandhotel"', 'DB_PASSWORD was restored to match MYSQL_PASSWORD in docker-compose.yml; /health went back to ok. The incident code located the cause in storage/logs in seconds', '~1 min'],
  ['2026-10-27', 'After signing in with Google the browser showed ERR_INVALID_REDIRECT', 'FRONTEND_URL lists two comma-separated domains (for CORS) and the Google callback and email verification used the whole value as the return address', 'New App\\Support\\Frontend::url() redirects to the first domain; covered by a test in ClientPortalTest', '~3 min'],
  ['2026-10-27', 'k6 stopped in setup() with "The API is not healthy before the test: 503"', 'The nginx container from docker compose was using port 8000, so k6 talked to that Nginx (with no PHP behind it) instead of the API', 'docker compose down and start only MySQL (docker compose up -d mysql); the k6 tutorial explains it in step 2', '~10 min'],
  ['2026-10-27', 'After coming back from Google the page stayed blank with #token=… in the address', 'The application did not start in that Brave tab (the API never received /auth/me), probably because of its Shields; the same flow worked in Chrome', 'Use Chrome or turn off Shields for localhost; the whole flow was verified with a test account', '~15 min'],
  ['2026-10-27', 'The "Errors" tab of the Developer view showed the 500 screen with code WEB-MVRL1WBX', 'Laravel stores some exceptions in the log as an object (class, message, file) and the screen tried to show them as text (React error)', 'RequestLogReader now always returns the class as text; new test in DeveloperViewTest', '~5 min'],
]

// ── cover (caratula-tecsup skill) ────────────────────────
const cov = (text, o = {}, spacingAfter = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 360, after: spacingAfter }, children: [t(text, o)] })
const cover = [
  cov('INSTITUTO TECNOLÓGICO SUPERIOR TECSUP', { bold: true }),
  cov('SOFTWARE DESIGN AND DEVELOPMENT', {}, 240),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(LOGO), transformation: { width: 189, height: 113 } })] }),
  cov('COURSE: CLOUD SOLUTIONS DEVELOPMENT', { bold: true }),
  cov('PROJECT:', { bold: true }),
  cov('LeGrandHotel – Web-based hotel management system', { bold: true }, 240),
  cov('LeGrandHotel Week11', { bold: true, size: 32 }, 120),
  cov('Features, tests and mobile design'),
  cov('AREQUIPA, 2026', {}, 360),
  cov('Lecturer:', { bold: true }),
  cov('VÍCTOR CALVO', {}, 360),
  cov('Presented by:', { bold: true }),
  cov('- Huacca Ccaso, Diego Armando'),
  cov('- Marcani Leyva, Joseph Fredy'),
  cov('- Pinto Garate, Leo Mathiu'),
  cov('- Quispe Encarnación, Rusell', {}, 360),
  cov('Arequipa – Peru', { bold: true }),
  cov('2026', { bold: true }),
  pageBreak(),
]

// ── 1. Description ───────────────────────────────────────
const s1 = [
  p([t('Table of contents', { bold: true, size: 30 })], { spacing: { after: 160 } }),
  new TableOfContents('Table of contents', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),

  h1('1. Project description'),
  p('LeGrandHotel is a web system to manage a hotel. It brings together the staff’s daily work (reservations, check-in and check-out, rooms, guests, parking and inventory) and online booking for guests, who choose a room type, see what it includes and the total, and the hotel assigns them a free room.'),
  p('The system has two parts: a REST API that stores the data and enforces every business rule, and a web page (single-page application) that uses it. The same API will also serve the Android and iOS mobile app designed in section 8.'),
  h2('1.1 Objectives'),
  bullet('Prevent operational errors: a room cannot be booked twice for the same dates, two guests cannot be in the same room and inventory cannot go negative.'),
  bullet('Each person sees only what their role allows, and the API enforces it even if someone types an address by hand.'),
  bullet('Leave a trail: every change is recorded in the audit log with who made it and when, and every error has an incident code to find it in the log.'),
  bullet('Measure performance with load tests before publishing the system.'),
  h2('1.2 Modules'),
  table(['Module', 'What it covers'], [
    ['Reservations and stays', 'Reservations with the total calculated on the server, check-in (creates the stay and occupies the room) and check-out (the room goes to cleaning)'],
    ['Rooms and room types', 'Rooms by floor and status; types with price per night, capacity and amenities'],
    ['Guests', 'Guest records with document, phone and nationality; linked to the web account if the guest has one'],
    ['Parking', 'Parking spots, vehicle entry and exit, with or without a related stay'],
    ['Inventory', 'Supplies with stock and minimum; stock in and out with a reason'],
    ['Staff and accounts', 'Staff records, account registration and role changes'],
    ['Reports and audit', 'Occupancy, income for the last 6 months and who changed what'],
    ['Guest portal', 'Google sign-in, guest details, online booking and their reservations'],
    ['Developer view', 'API health, latencies, requests, errors and routes, without logging into the server'],
  ], [3, 8.5]),
  h2('1.3 Technologies'),
  table(['Part', 'Technology', 'What it is used for'], [
    ['API (backend)', 'PHP 8.2 and Laravel 12', 'REST routes, validation, business rules and data access'],
    ['Authentication', 'Laravel Sanctum', 'Bearer tokens that expire (60 minutes) for the web and the mobile app'],
    ['Google sign-in', 'Laravel Socialite (OAuth 2.0)', 'Guest accounts without a password'],
    ['Database', 'MySQL 8.4', 'Hotel data with foreign keys, indexes and transactions'],
    ['Web page (frontend)', 'React 18, TypeScript and Vite', 'Fast, typed single-page interface'],
    ['Data on the web', 'TanStack Query and Axios', 'Query cache, pagination and a single handler for 401/403/429/5xx errors'],
    ['Navigation', 'React Router', 'Role-protected routes and error screens'],
    ['API tests', 'Pest (PHPUnit)', '121 automated tests of rules, permissions and errors'],
    ['Web tests', 'Vitest and Testing Library', '25 tests of routes, forms and permissions'],
    ['Code quality', 'PHPStan level 5, Laravel Pint, ESLint and strict TypeScript', 'Catch errors before running and keep one style'],
    ['Load tests', 'k6 (Grafana)', 'Measure response times and errors with many users at once'],
    ['Local environment', 'Docker Compose', 'The same MySQL database for the whole team'],
    ['Mobile app (design)', 'React Native with Expo and TypeScript', 'One codebase for Android and iOS'],
    ['Version control', 'Git and GitHub', 'History and teamwork'],
  ], [2.6, 3.6, 5.3]),
  gap(),
  p([b('Note: '), t('the server where the system will be published has not been defined yet. Everything in this report was run in the team’s local environment.')]),
  h2('1.4 How the parts connect'),
  p('The web page and the mobile app do not store data: they request everything from the API in JSON with the session token. The API validates every request (FormRequest), checks the role (role: middleware) and the per-record rules (policies), and always answers in the same format, whether success or error. The MySQL database has 16 system tables related by 13 foreign keys; the diagram in section 1.5 was generated by reading the real database schema.'),
]

const sDiagram = [
  pageBreak(),
  h2('1.5 Database diagram'),
  p('The diagram is split into three parts so it is easy to read. When a table relates to one in another part, that table appears in a dashed box with only its id. Each line shows the foreign key column and what MySQL does when the parent record is deleted (CASCADE, SET NULL or RESTRICT). Table and column names are the real ones in the database.'),
  ...img(path.join(DIAG, 'diagrama-bd-part1-en.png'), 'Database diagram, part 1: accounts, permissions and audit.', 16, 21.5),
  ...img(path.join(DIAG, 'diagrama-bd-part2-en.png'), 'Database diagram, part 2: guests, reservations and rooms.', 16, 21.5),
  ...img(path.join(DIAG, 'diagrama-bd-part3-en.png'), 'Database diagram, part 3: parking and inventory.', 16, 21.5),
]

// ── 2. Endpoints ─────────────────────────────────────────
const s2 = [
  h1('2. Defined endpoints'),
  p('All routes live under /api/v1 and answer JSON. There are 77 routes (counted with php artisan route:list). In the table, “CRUD” means list (GET), create (POST), show (GET /{id}), update (PUT/PATCH) and delete (DELETE).'),
  table(['Group', 'Method and route', 'Who can use it'], [
    ['Health', '`GET /health', 'Public'],
    ['Authentication', '`POST /auth/login', 'Public (5 attempts per minute)'],
    ['', '`GET /auth/google/redirect · /auth/google/callback', 'Public (guests)'],
    ['', '`GET /auth/me · POST /auth/logout · POST /auth/refresh', 'Any session'],
    ['', '`POST /auth/register', 'Administrator and Developer (3 per minute)'],
    ['Email', '`GET /email/verify/{id}/{hash} · POST /email/verification-notification', 'Signed link · session'],
    ['Guest portal', '`PUT /portal/profile', 'Guest'],
    ['', '`GET /portal/room-types', 'Guest'],
    ['', '`GET · POST /portal/reservations', 'Guest'],
    ['', '`POST /portal/reservations/{id}/cancel', 'Guest (own reservations only)'],
    ['Dashboard', '`GET /dashboard', 'Administrator, Receptionist, Storekeeper, Developer'],
    ['Room types', '`GET /room-types · /room-types/{id}', 'Administrator and Receptionist'],
    ['', '`POST · PUT · DELETE /room-types', 'Administrator'],
    ['Reservations', '`CRUD /reservations · POST /reservations/{id}/check-in', 'Administrator and Receptionist'],
    ['Stays', '`GET /stays · /stays/{id} · POST /stays/{id}/check-out', 'Administrator and Receptionist'],
    ['Rooms', '`CRUD /rooms · GET /rooms/available · PATCH /rooms/{id}/status', 'Administrator and Receptionist'],
    ['Guests', '`CRUD /clients', 'Administrator and Receptionist'],
    ['Parking', '`CRUD /parking-spots · CRUD /parking-assignments', 'Administrator and Receptionist'],
    ['Inventory', '`CRUD /inventory-items · GET · POST /inventory-items/{id}/movements', 'Administrator and Storekeeper'],
    ['Staff', '`CRUD /staff', 'Administrator'],
    ['Users', '`CRUD /users · PUT /users/{id}/roles', 'Administrator'],
    ['Reports', '`GET /reports/occupancy · /reports/income', 'Administrator'],
    ['Audit', '`GET /audit-logs', 'Administrator'],
    ['Developer', '`GET /dev/overview · /dev/requests · /dev/errors · /dev/routes', 'Developer and Administrator'],
  ], [2.4, 5.6, 3.5]),
  gap(),
  h2('2.1 Single response format'),
  p('Every response uses App\\Support\\ApiResponse. A success carries success and data (plus meta in paginated lists, with at most 50 per page); an error carries a stable code that the web uses to decide what to show, never HTML or server traces. Messages are in Spanish because the system is for a Peruvian hotel.'),
  ...code('Error response (real example: double booking)', [
    '{',
    '  "success": false,',
    '  "error": {',
    '    "code": "ROOM_ALREADY_BOOKED",',
    '    "message": "La habitación ya está reservada en esas fechas."',
    '  }',
    '}',
  ]),
  table(['HTTP code', 'When the API returns it', 'What the web shows'], [
    ['401', 'No session or expired token', '“Your session ended” screen and back to login'],
    ['403', 'The role is not allowed', '“You do not have access to this section” screen'],
    ['404', 'The record or route does not exist', '“We could not find this page” screen'],
    ['409', 'Business rule: double booking, occupied room, insufficient stock, single Developer…', 'Message in the form'],
    ['422', 'Invalid data (FormRequest)', 'Error next to each field'],
    ['429', 'Too many attempts (Retry-After)', 'Screen with a countdown'],
    ['500', 'Unexpected error, with an incident code', '500 screen with the code for support'],
    ['503', 'Service unavailable or offline', 'Screen that retries by itself'],
  ], [1.6, 5.2, 4.7]),
]

// ── 3. Registration and login ────────────────────────────
const s3 = [
  h1('3. Separate registration and login'),
  p('There are two kinds of account with separate paths, both on screen and in the API. The rules are validated on the server: even if someone modifies the page, the API rejects what is not allowed.'),
  table(['', 'Hotel staff', 'Guest'], [
    ['Roles', 'Administrator, Receptionist, Storekeeper, Developer', 'Client (guest)'],
    ['How they sign in', 'Email and password (POST /auth/login)', 'Only with Google (OAuth); no password'],
    ['Who creates the account', 'The Administrator or the Developer, from “Register staff”. There is no public sign-up', 'Created automatically the first time they sign in with Google'],
    ['Extra data', 'Staff record: position, shift and start date', 'DNI (8 digits) and phone (9 digits), only once'],
    ['Protection', '5 login attempts per minute; bcrypt-hashed password; at least 8 characters with letters and numbers', 'Google verifies the email; a DNI cannot be linked to two accounts'],
    ['Where they land', 'Their role’s dashboard', '“Complete registration”, then “Book”'],
  ], [2.4, 4.6, 4.5]),
  gap(),
  p([b('There is only one Developer. '), t('Neither the Administrator nor the Developer can create another Developer account, give that role to someone else, remove it from the existing one or delete it. The API answers 409 DEVELOPER_UNIQUE or DEVELOPER_LOCKED if someone tries.')]),
  ...img(path.join(CAPS, '00-login.png'), 'Login: staff sign in with email and password; guests with “Continuar con Google”. The interface is in Spanish.', 15),
  h2('3.1 Code excerpts'),
  p('Password login only lets staff in; a guest who tries it gets 403:'),
  ...code('api/app/Http/Controllers/Api/AuthController.php', [
    "if (! $user || ! $user->password || ! Hash::check($request->string('password'), $user->password)) {",
    "    throw new ApiException('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.', 401);",
    '}',
    '// Only staff sign in with a password; guests sign in with Google (they have no password).',
    'if (! $user->hasRole(...Role::INTERNAL)) {',
    "    throw new ApiException('ACCOUNT_WITHOUT_ACCESS', 'Esta cuenta no tiene acceso al sistema del hotel.', 403);",
    '}',
  ]),
  p('Staff registration only accepts the allowed roles, and the route is protected by role and by an attempt limit:'),
  ...code('api/routes/api.php and api/app/Http/Requests/Auth/RegisterRequest.php', [
    "Route::post('register', [AuthController::class, 'register'])",
    "    ->middleware(['role:admin,developer', 'throttle:register']);",
    '',
    "'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],",
    "'role'     => ['required', Rule::in(Role::ASSIGNABLE)],   // Front desk, Storeroom or Administration",
  ]),
  p('Google is only for guests: if the email already belongs to a staff member, they are sent back to the login with a warning:'),
  ...code('api/app/Http/Controllers/Api/GoogleAuthController.php', [
    "$user = User::where('google_id', $googleUser->getId())->orWhere('email', $googleUser->getEmail())->first();",
    '// Google is only for guests: staff sign in with their email and password.',
    'if ($user && ! $user->hasRole(Role::CLIENT)) {',
    '    return redirect()->away("{$frontend}/login?error=google_personal");',
    '}',
  ]),
  p('On the web, each route declares which roles can open it; otherwise the 403 screen is shown (and the API also answers 403):'),
  ...code('web/src/auth/ProtectedRoute.tsx', [
    'export function ProtectedRoute({ roles }: { roles?: RoleName[] }) {',
    '  const { user, hasRole } = useAuth()',
    '  if (!user) return <Navigate to="/login" replace />',
    '  if (roles && !hasRole(...roles)) return <ForbiddenPage />',
    '  return <Outlet />',
    '}',
  ]),
  h2('3.2 Registration screens'),
  p('The “Register staff” and the guest’s “Complete registration” screens are shown with their description in sections 4.3 and 4.5.'),
]

// ── 4. Roles ─────────────────────────────────────────────
const Y = '✓'
const N = '—'
/** Title and description above; the screenshot (view without the menu or pop-up window) below. */
function view(name, title, text, widthCm = 15.5) {
  return [
    new Paragraph({ keepNext: true, spacing: { before: 200, after: 60 }, children: [b(title)] }),
    p(text, { keepNext: true }),
    ...img(path.join(ROLES_DIR, `${name}.png`), title, widthCm, 19),
  ]
}
const popup = (name, title, text) => view(name, `Pop-up window: ${title}`, text, 11)
const roleMenu = (name, role, text, widthCm = 5.5) => [
  new Paragraph({ keepNext: true, spacing: { before: 120, after: 60 }, children: [b(`${role} menu`)] }),
  p(text, { keepNext: true }),
  ...img(path.join(ROLES_DIR, `${name}.png`), `${role} menu.`, widthCm, 15),
]

const s4 = [
  h1('4. What each role can do'),
  p('Each role sees only its options in the menu. For each role, its menu is shown first and then each menu view separately, without the side bar, with a description of what it is for above each screenshot. When a view opens a pop-up window (form), only that window is shown. The screenshots were taken on October 27, 2026 with the page running on the project’s MySQL database (70 rooms, 1,000 guests and 5,000 demo reservations). The application interface is in Spanish; the menu option names are given in English with the Spanish label in quotes.'),
  table(['Menu option', 'Admin', 'Front desk', 'Storeroom', 'Developer', 'Guest'], [
    ['Dashboard («Panel»)', Y, Y, Y, N, N],
    ['Reservations, Stays, Rooms, Guests, Parking', Y, Y, N, N, N],
    ['Room types', 'edits', 'views', N, N, N],
    ['Inventory', Y, N, Y, N, N],
    ['Staff, Users and roles, Reports, Audit, Billing', Y, N, N, N, N],
    ['Register staff', Y, N, N, Y, N],
    ['Developer view', Y, N, N, Y, N],
    ['Book, My bookings', N, N, N, N, Y],
  ], [5, 1.3, 1.5, 1.5, 1.5, 1.2]),
  gap(),
  p('If someone types the address of an option that is not in their menu, they see the 403 screen (section 5) and the API also answers 403.'),

  pageBreak(),
  h2('4.1 Receptionist'),
  p('Serves guests day to day: books for them, does check-in and check-out, and manages parking and room status.'),
  ...roleMenu('rec-00-menu', 'Receptionist', 'It has the “Inicio” group with the Dashboard and the “Recepción” group with its six work views. It does not see Inventory or the Administration options.'),
  ...view('rec-01-panel', 'Front desk dashboard («Panel»)', 'Summary of the day: occupancy, free rooms, today’s arrivals and departures and rooms being cleaned. On the right, today’s arrivals with their check-in button and the supplies below the minimum; below, the room board by floor with each room’s status.'),
  ...view('rec-02-reservas', 'Reservations («Reservas»)', 'Reservation list paginated on the server, with tabs by status (confirmed, pending, checked in, completed and cancelled) and search by guest or document. From each row you can check in or cancel the reservation.'),
  ...popup('rec-02b-nueva-reserva', 'New reservation', 'You search for the guest, choose the dates and number of guests, and only the rooms free for those dates appear. The server calculates the total; if someone else takes the same room at the same moment, the API answers 409.'),
  ...view('rec-03-estadias', 'Stays («Estadías»)', 'Guests currently in the hotel and the stay history. Check-out closes the stay, sends the room to cleaning and frees its parking spot.'),
  ...view('rec-04-habitaciones', 'Rooms («Habitaciones»)', 'Rooms with their floor, type, capacity, price and status, filterable by status. The front desk marks them as “ready” after cleaning.'),
  ...view('rec-05-tipos', 'Room types (read only)', 'The front desk checks the price per night, capacity and amenities of each type to inform guests, but cannot create or change them.'),
  ...view('rec-06-clientes', 'Guests («Clientes»)', 'Guest records with their document, phone, whether they have a web account and how many reservations they have. Only a guest without reservations can be deleted.'),
  ...popup('rec-06b-nuevo-cliente', 'New guest', 'Registers a guest who arrives or calls: name, document type and number (cannot repeat), phone and nationality.'),
  ...view('rec-07-cochera', 'Parking («Cochera»)', 'Vehicles currently inside and the parking spots with their status.'),
  ...popup('rec-07b-entrada', 'Record parking entry', 'You enter the plate, the free spot and, if applicable, the guest’s stay. If the spot is already taken, the API answers 409 PARKING_SPOT_NOT_FREE.'),

  pageBreak(),
  h2('4.2 Storekeeper'),
  p('Manages the hotel’s supplies: what comes in, what goes out and what needs restocking.'),
  ...roleMenu('alm-00-menu', 'Storekeeper', 'It has only two options: the Dashboard and Inventory.'),
  ...view('alm-01-panel', 'Storeroom dashboard («Panel»)', 'Shows the supplies below the minimum, to restock them in time, and the button to record a movement.'),
  ...view('alm-02-inventario', 'Inventory («Inventario»)', 'Each supply with its unit, stock, minimum and a level bar; you can show only those below the minimum. From each row you record a movement or edit the supply.'),
  ...popup('alm-02b-movimiento', 'Record movement', 'Stock in or out with quantity and reason; the latest movements of the supply appear below. The API does not allow taking out more than there is (409 INSUFFICIENT_STOCK).'),
  ...popup('alm-02c-nuevo-insumo', 'New supply', 'Name, unit, initial stock and minimum. After that, stock only changes through movements, so everything is recorded.'),

  pageBreak(),
  h2('4.3 Administrator'),
  p('Responsible for the system: has every staff option, defines room types and prices, manages staff and their accounts, and reviews reports and the audit log.'),
  ...roleMenu('adm-00-menu', 'Administrator', 'It is the full menu: Inicio, Recepción, Almacén, Administración and Programador.', 4.6),
  ...view('adm-01-panel', 'Administrator dashboard («Panel»)', 'The same daily summary as the front desk, plus the month’s income.'),
  ...view('adm-02-reservas', 'Reservations', 'The same reservations the front desk manages: the Administrator can also create, check in and cancel.'),
  ...view('adm-03-estadias', 'Stays', 'Guests in the hotel and the history, with check-out.'),
  ...view('adm-04-habitaciones', 'Rooms', 'Rooms by status; the Administrator also creates and edits rooms.'),
  ...popup('adm-04b-nueva-habitacion', 'New room', 'Number (unique), floor, type and initial status of the room.'),
  ...view('adm-05-tipos', 'Room types', 'Unlike the front desk, the Administrator creates, edits and deletes room types.'),
  ...popup('adm-05b-nuevo-tipo', 'New room type', 'Name, capacity, price per night, description and amenities, comma-separated. This is what the guest sees when booking.'),
  ...view('adm-06-clientes', 'Guests', 'The guest records, same as the front desk.'),
  ...view('adm-07-cochera', 'Parking', 'Vehicles and spots; the Administrator also adds spots.'),
  ...view('adm-08-inventario', 'Inventory', 'The same inventory as the Storekeeper, with the same permissions.'),
  ...view('adm-09-personal', 'Staff («Personal»)', 'Staff records with position, shift and start date, each linked to its account.'),
  ...popup('adm-09b-agregar-persona', 'Add staff member', 'Creates the record and the account in one step. The Developer role does not appear because the hotel has only one.'),
  ...view('adm-10-registrar', 'Register staff («Registrar personal»)', 'Creates the account of a hotel staff member with an initial password. It only offers Receptionist, Storekeeper and Administrator; the new account receives an email to verify it.'),
  ...view('adm-11-usuarios', 'Users and roles («Usuarios y roles»)', 'Every account with its role and whether the email was verified, with role filters and search by name or email.'),
  ...popup('adm-11b-usuario-programador', 'Edit the Developer account', 'The Developer checkbox is locked: the role cannot be given to another account or removed from the Developer. Their name, email and password can be changed.'),
  ...view('adm-12-reportes', 'Reports («Reportes»)', 'Occupancy for a date range and income for the last 6 months in a bar chart.'),
  ...view('adm-13-auditoria', 'Audit («Auditoría»)', 'Who created, edited or deleted each record, when and from which IP, with the values before and after the change.'),
  ...view('adm-14-facturacion', 'Billing («Facturación»)', 'A planned module that is not built yet: it shows “Under construction” instead of an error.'),
  ...view('adm-15-programador', 'Developer view', 'The Administrator also sees the API diagnostics (details in section 4.4).'),

  pageBreak(),
  h2('4.4 Developer'),
  p('Provides technical support: checks the API status without logging into the server and registers staff accounts when needed.'),
  ...roleMenu('dev-00-menu', 'Developer', 'It has two options: Register staff and the Developer view.'),
  ...view('dev-01-registrar', 'Register staff', 'Like the Administrator, creates Front desk, Storeroom and Administration accounts, but not Developer accounts.'),
  ...view('dev-02-resumen', 'Developer view · Summary', 'API status, p50, p95 and p99 latencies, percentage of 5xx errors and 4xx responses, and the configuration without showing secrets. It refreshes by itself every 10 to 15 seconds.'),
  ...view('dev-03-peticiones', 'Developer view · Requests', 'The slowest routes by p95 and the latest requests with their code and duration (the top part is shown).'),
  ...view('dev-04-errores', 'Developer view · Errors', 'Server errors, searchable by the incident code the user sees on the 500 screen. The real incident JJA05WR4CG from section 6 appears here.'),
  ...view('dev-05-rutas', 'Developer view · API routes', 'The 77 routes with their method, whether they require a session, the roles that can use them and their rate limit (the top part is shown).'),

  pageBreak(),
  h2('4.5 Guest'),
  p('The guest with their own account: signs in with Google, completes their DNI and phone once and books online. They see nothing of the staff panel.'),
  ...view('cli-00-completar-registro', 'Complete registration (before the menu)', 'The first time they sign in with Google this screen appears, still without a menu. Name and email come from Google; the guest enters their DNI (8 digits) and phone (9 digits). If their DNI was already registered at the front desk, that record is linked.'),
  ...roleMenu('cli-01-menu', 'Guest', 'Their “Mi cuenta” menu has two options: Book («Reservar») and My bookings («Mis reservas»).'),
  ...view('cli-02-reservar', 'Book («Reservar»)', 'They choose arrival, departure and number of guests; they see each room type with its amenities, how many are free and the total of their stay. Types that do not fit that many guests do not appear.'),
  ...popup('cli-02b-confirmar', 'Confirm reservation', 'Summary with the type, dates, nights and total before confirming. On confirmation, the hotel assigns a free room of that type.'),
  ...view('cli-03-mis-reservas', 'My bookings («Mis reservas»)', 'Their reservations with room, dates, nights, total and status. They can cancel a confirmed reservation as long as at least one day remains before arrival.'),
]

// ── 5. Error screens ─────────────────────────────────────
const s5 = [
  h1('5. Error screens'),
  p('Every API error response has its own screen, with the same style as the page, a clear message and a way out (go home, reload or sign in). A single interceptor in web/src/lib/api.ts decides which one to show, so they behave the same in every view.'),
  ...img(path.join(ROOT, 'docs/diseno/errores.png'), '401, 403, 404, 429, 500, 503, under construction and offline screens (Spanish interface).', 15.5),
  table(['Screen', 'When it appears'], [
    ['401 · Session expired', 'The token expired (60 minutes) or the session was closed elsewhere'],
    ['403 · No access', 'The role is not allowed to open that view or do that action'],
    ['404 · Not found', 'The address does not exist or the record was deleted'],
    ['429 · Too many requests', 'The limit was exceeded (for example 5 logins per minute); it shows how long to wait'],
    ['500 · Server error', 'Something failed; it shows the incident code to look it up in the Developer view'],
    ['503 · Unavailable', 'The API does not respond; it retries by itself every 30 seconds'],
    ['Under construction', 'A planned module that is not built yet (Billing)'],
    ['Offline', 'The computer lost internet; it comes back by itself when reconnected'],
  ], [3.6, 7.9]),
]

// ── 6. Incidents ─────────────────────────────────────────
const s6 = [
  h1('6. Incident log'),
  p(`Every outage or failure, even in the local environment or in tests, is recorded the same day in docs/incidentes.md with its cause and solution. The log now has ${INCIDENTS.length} incidents; ${INCIDENTS.filter((i) => i[0] === '2026-10-27').length} are from October 27, while repeating the load tests, setting up Google sign-in and reviewing the Developer view.`),
  table(['Date', 'What failed', 'Cause', 'Solution', 'Time'], INCIDENTS, [1.5, 3, 3.4, 3.4, 1]),
  gap(),
  p([b('How the incident code helped: '), t('when the API fails, it answers 500 with a code (for example JJA05WR4CG) that the user sees on screen. The same code is stored in the API’s JSON log, and the Developer view finds it in seconds (figure in section 4.4). That is how we found that the problem with the first Google sign-in was the database password, not Google.')]),
  ...code('API log (storage/logs/laravel.json), summarized', [
    '{"message": "SQLSTATE[HY000] [1045] Access denied for user \'legrandhotel\'…",',
    ' "context": {"incident_id": "JJA05WR4CG", "exception": "Illuminate\\\\Database\\\\QueryException"},',
    ' "level_name": "ERROR", "datetime": "2026-10-27T22:14:14-05:00"}',
  ]),
]

// ── 7. k6 ────────────────────────────────────────────────
const s7 = [
  h1('7. Performance and stress tests with k6'),
  p('k6 simulates many “virtual users” (VU) using the API at the same time and measures how long each response takes. Each script has goals (thresholds): if they are not met, k6 marks the test with ✗ and exits with code 99. The runs were made on October 27, 2026 on the team’s laptop, with the API on PHP’s built-in server (php -S, which handles one request at a time) and a database with 5,000 reservations.'),
  table(['Test', 'What it does', 'Why'], [
    ['1. Smoke', '5 VU for 30 s request /health and a protected route without a token', 'Confirm the API, database and cache work before adding load'],
    ['2. Login limit', '6 login attempts with a wrong password', 'Show the brute-force protection (429)'],
    ['3 to 6. Steps', 'Front desk work (70% queries, 20% login, 10% new reservation) with 5, 10, 25 and 50 VU, 1 minute each', 'See when the API slows down and whether errors appear as load grows'],
  ], [2.6, 5, 3.9]),
  h2('7.1 Smoke test'),
  ...img(path.join(K6, 'capturas/t1-smoke.png'), 'Smoke test command and k6 output.', 15),
  p(`Interpretation: all three goals pass with ✓. 95% of the responses took less than ${ms(smoke.http_req_duration['p(95)'])} (goal: 800 ms), there were no failed requests (${pct(smoke.http_req_failed.value)}) and all ${smoke.checks.passes} checks passed: the API, database and cache respond, and a protected route without a token returns 401 in JSON.`),
  h2('7.2 Login attempt limit'),
  ...img(path.join(K6, 'capturas/t2-rate-limit.png'), 'Login limit test: the sixth attempt gets 429.', 15),
  p('Interpretation: “Estados recibidos: 401, 401, 401, 401, 401, 429”. The first five attempts answer 401 (wrong password) and the sixth 429, with the Retry-After header and the TOO_MANY_REQUESTS code. Nobody can try passwords without limit.'),
  h2('7.3 Load steps (5, 10, 25 and 50 users)'),
  ...img(path.join(K6, 'capturas/t3-escalon-5vu.png'), '5-user step: command and output.', 15),
  p(`Interpretation: with 5 users every request succeeds (0% errors and all checks ✓), but the speed goal fails with ✗: the p95 was ${ms(e5.p95)} and the goal is 500 ms. The final line “thresholds … have been crossed” is k6 reporting that the test did not pass.`),
  ...img(path.join(K6, 'capturas/t3-escalon-50vu.png'), '50-user step: command and output.', 15),
  p(`Interpretation: with 50 users there are still no errors (${pct(e50.failed)}), but the p95 rises to ${ms(e50.p95)}. The API does not go down: it answers everything, but requests wait their turn.`),
  table(['Users', 'Requests', 'Req/s', 'Median', 'p95', 'Maximum', 'Errors', 'Goal p95 < 500 ms'],
    ESC.map((e) => [e.vus, e.reqs, e.rps.toFixed(1), ms(e.p50), ms(e.p95), ms(e.max), pct(e.failed), e.p95 < 500 ? '✓' : '✗']),
    [1.2, 1.4, 1.1, 1.6, 1.5, 1.5, 1.3, 1.8]),
  gap(),
  ...img(path.join(K6, 'graficos-en/01-latency.png'), 'Response time (median and p95) by number of users.', 14.5),
  p(`Chart interpretation: the horizontal axis is the number of simultaneous users and the vertical axis the response time. The dotted line is the 500 ms goal. Both curves rise almost in a straight line: from 5 to 50 users the p95 grows from ${ms(e5.p95)} to ${ms(e50.p95)}. Growing in proportion to the users is the sign of a queue: each new user waits for the previous ones.`),
  ...img(path.join(K6, 'graficos-en/02-requests-per-second.png'), 'Requests served per second in each step.', 14.5),
  p(`Chart interpretation: the bars barely change (from ${ESC[0].rps.toFixed(1)} to ${e50.rps.toFixed(1)} requests per second). Even with ten times more users, the API serves the same per second: it reached its ceiling. Together with the previous chart it confirms the bottleneck.`),
  h2('7.4 k6 HTML report (50-user step)'),
  p('k6 also produces a report with charts of the minute the test lasted (salidas/3-escalon-50vu.html). Its three charts are shown separately. The horizontal axis is the time of day (20:50:20 to 20:51:40) and each point summarizes 10 seconds.'),
  ...img(path.join(K6, 'capturas/d1a-http-performance.png'), 'HTTP Performance overview: requests per second, p95 and failed requests.', 16),
  p([b('What it shows: '), t('three measures at once, each with its own axis. The green line is the number of requests per second (axis from 2/s to 6/s); the blue one, the p95 response time (right axis, 0 to 10 s); the purple one, the percentage of failed requests (left axis).')]),
  p([b('Interpretation: '), t(`until 20:50:30 there is almost no load and the p95 is low. From 20:50:35, when the users come in, the p95 jumps to about 9.7 s at 20:51:00 and stays between 8 and 9 s for the rest of the test (overall p95: ${ms(e50.p95)}). Requests per second rise only to about 5.5/s and flatten: the API serves no more even though more users are waiting. The purple line stays at 0% the whole time: none of the ${e50.reqs} requests failed. Conclusion: the API slows down, but it does not go down.`)]),
  ...img(path.join(K6, 'capturas/d1b-vus.png'), 'VUs: active virtual users and requests per second.', 13),
  p([b('What it shows: '), t('the green line is the active virtual users (left axis, 0 to 50); the blue one, requests per second (right axis).')]),
  p([b('Interpretation: '), t('the three stages of the step are visible: the ramp from 0 to 50 users between 20:50:38 and 20:51:00, the plateau with 50 users until 20:51:30 and the start of the ramp-down at the end. Before the ramp there are already requests with 0 users: that is the setup, which signs in the 50 test receptionists. The key point is that the blue line reaches its ceiling (about 5.5/s) with around 40 users and does not rise further at 50: the extra users only add waiting. It is the same bottleneck signal as the previous chart.')]),
  ...img(path.join(K6, 'capturas/d1c-transfer-rate.png'), 'Transfer Rate: data received and sent per second.', 13),
  p([b('What it shows: '), t('how much data k6 received from the API (data_received, green) and how much it sent (data_sent, blue), in kilobytes per second.')]),
  p([b('Interpretation: '), t('data received varies between 11 and 38 kB/s, with a peak at 20:51:10. It varies because it depends on what each user requested: a list of reservations or free rooms weighs more than a login. Data sent stays around 1 to 2 kB/s because requests are small (a token and a few fields). In total, 1.8 MB were received and 108 kB sent over the whole minute: the network is far from being the limit, so the slowness comes from the API processing one request at a time, not from the amount of data.')]),
  h2('7.5 Test conclusions'),
  bullet('Correct and stable: across the 6 runs there was not a single failed request or 500 error.'),
  bullet('Secure under load: 401 without a session and 429 when the login limit is exceeded, always in the API’s JSON format.'),
  bullet('Slow on the laptop because of PHP’s development server, which handles one request at a time. The fix is to run the API with several PHP processes in parallel and code caching (OPcache) on the final server, and repeat these same tests there, with more users, once the server is defined.'),
]

// ── 8. Mobile app ────────────────────────────────────────
const s8 = [
  h1('8. Android and iOS app design'),
  p('LeGrandHotel will have a phone app that uses the same API and the same roles as the web, without duplicating any business rule. It covers what is convenient to do from a phone: guests book and review their reservations, the front desk handles arrivals and departures from the lobby, and the storeroom records movements in the warehouse.'),
  table(['Role', 'What they will do in the app'], [
    ['Guest', 'Sign in with Google, complete DNI and phone, book by room type, view and cancel their reservations, get a reminder one day before arrival'],
    ['Receptionist', '“Today” screen with arrivals and departures, check-in and check-out, reservations, room status and parking'],
    ['Storekeeper', 'See the inventory with supplies below the minimum and record stock in and out'],
    ['Administrator', 'The summarized dashboard (occupancy, income and alerts); full management stays on the web'],
  ], [2.6, 8.9]),
  gap(),
]

const sMockups = [
  ...img(path.join(ROOT, 'docs/movil/maquetas-en.png'), 'App mockups: sign in, the guest’s Book and My bookings, the front desk’s “Today” and the storeroom’s Inventory.', 24.5, 15),
]

const s9 = [
  h2('8.1 Technology'),
  p([b('React Native with Expo and TypeScript. '), t('A single codebase produces both apps and reuses what the team already uses on the web: React, TypeScript, TanStack Query, Axios and the same data types.')]),
  table(['Need', 'In the app', 'Web equivalent'], [
    ['Navigation', 'Expo Router, with a tab bar based on the role', 'React Router'],
    ['API calls', 'TanStack Query and Axios with the same 401/403/429/5xx handling', 'Same'],
    ['Session storage', 'expo-secure-store: Keychain (iOS) and Keystore (Android)', 'sessionStorage'],
    ['Google sign-in', 'expo-auth-session with the link legrandhotel://auth/callback', 'Socialite with redirect'],
    ['Notifications', 'expo-notifications (arrival reminder, room ready, low stock)', '—'],
    ['Unlock', 'Fingerprint or Face ID (expo-local-authentication)', '—'],
    ['Tests', 'Jest and Testing Library; Maestro for end-to-end flows', 'Vitest and Playwright'],
  ], [2.6, 5.5, 3.4]),
  gap(),
  table(['Option evaluated', 'Pros', 'Cons', 'Decision'], [
    ['React Native + Expo', 'One codebase for Android and iOS; same language as the web; builds iOS without a Mac (EAS Build)', 'Very specific native features need custom modules', 'Chosen'],
    ['Flutter', 'Good performance and consistent design', 'Another language (Dart): nothing from the web is reused', 'Discarded'],
    ['Native (Kotlin + Swift)', 'Full access to the system', 'Two different apps: twice the work', 'Discarded'],
  ], [2.6, 4, 3.6, 1.4]),
  h2('8.2 Security and API changes'),
  bullet('The token is stored in the phone’s secure storage, never in plain text, and is renewed with the same POST /auth/refresh as the web.'),
  bullet('The app contains no secrets: the Google and database credentials stay only in the API.'),
  bullet('The API barely changes: login already accepts a device name (device_name) so each phone gets its own token. Still pending: registering each phone’s notification token (POST /devices) and letting Google sign-in return to the app.'),
  h2('8.3 Build plan'),
  table(['Stage', 'What is built'], [
    ['1', 'Expo project, staff and guest login, secure session and a tab bar per role'],
    ['2', 'Guest: complete registration, book and my bookings'],
    ['3', 'Front desk: “Today” with check-in and check-out, reservations and rooms; Storeroom: inventory and movements'],
    ['4', 'Notifications, fingerprint unlock, tests and a test build for Android and iOS'],
  ], [1.4, 10.1]),
]

const s10 = [
  h1('9. Conclusions'),
  p([b('1. The system covers the hotel’s full operation. '), t('With 77 REST endpoints and a single response format, LeGrandHotel handles reservations, stays, rooms, guests, parking, inventory, staff, reports and audit, plus online booking for guests.')]),
  p([b('2. Access is separated and protected. '), t('Staff sign in with email and password and are registered by the Administrator or the Developer; guests sign in only with Google. Each role sees only its menu, the API answers 403 even if someone types the address by hand, and there is a single Developer.')]),
  p([b('3. The server enforces the business rules. '), t('The API prevents double booking, two guests in the same room, negative stock and an occupied parking spot (409), calculates the totals and records every change in the audit log.')]),
  p([b('4. Failures are logged and fixed with evidence. '), t('The incident log and the incident code the user sees made it possible to find the cause of each failure in the API log and fix it the same day, with a new automated test when appropriate.')]),
  p([b('5. The API is stable under load and the next step is clear. '), t('In the k6 tests there was not a single error with up to 50 simultaneous users; speed on the laptop is limited by the development server and will be measured again once the server is defined. The Android and iOS app will reuse this same API.')]),
]

// ── document ─────────────────────────────────────────────
const margins = { top: Math.round(2.5 * CM), bottom: Math.round(2.5 * CM), left: Math.round(2.5 * CM), right: Math.round(2.5 * CM) }
const footer = { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) }
const portrait = (children) => ({ properties: { page: { margin: margins, size: { width: 11906, height: 16838 } } }, footers: footer, children })
const landscape = (children) => ({ properties: { page: { margin: { ...margins, top: Math.round(1.5 * CM), bottom: Math.round(1.5 * CM) }, size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE } } }, footers: footer, children })

const doc = new Document({
  creator: 'LeGrandHotel team',
  title: 'LeGrandHotel Week11',
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
    portrait([...cover, ...s1, ...sDiagram, pageBreak(), ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8]),
    landscape(sMockups),
    portrait([...s9, ...s10]),
  ],
})

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT, `${figure} figures`) })
