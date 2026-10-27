// Genera docs/informes/LeGrandHotel_Entrega_25.docx (carátula TECSUP + informe de la entrega del 25%).
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, PageBreak, Footer, PageNumber, LevelFormat, BorderStyle, ShadingType, TableOfContents,
  VerticalAlign,
} = require('docx')

const ROOT = 'C:/Proyectos/LeGrandHotel'
const LOGO = process.argv[2]
const OUT = path.join(ROOT, 'docs/informes/LeGrandHotel_Entrega_25.docx')
const resumen = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/pruebas/graficos/resumen.json'), 'utf8'))
const smoke = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/pruebas/datos/smoke-5vu.json'), 'utf8')).metrics
const CAPS = path.join(ROOT, 'docs/informes/capturas')

const FONT = 'Times New Roman'
const CM = 567 // twips por cm
const PAGE_W = 11906 - 2 * Math.round(2.5 * CM) // ancho útil A4 con márgenes de 2.5 cm

// ── helpers ─────────────────────────────────────────────
const t = (text, o = {}) => new TextRun({ text, font: FONT, size: 24, ...o })
const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [t(children)], spacing: { after: 120, line: 300 }, ...o })
const center = (children, o = {}) => p(children, { alignment: AlignmentType.CENTER, ...o })
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 240, after: 160 } })
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 200, after: 120 } })
const bullet = (children) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: Array.isArray(children) ? children : [t(children)], spacing: { after: 60, line: 288 } })
const code = (text) => new Paragraph({ children: [new TextRun({ text, font: 'Consolas', size: 19 })], spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' } })
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })
const caption = (text) => center([t(text, { italics: true, size: 20 })], { spacing: { after: 200 } })

function image(file, widthCm, type = 'png') {
  const data = fs.readFileSync(file)
  // Dimensiones reales del PNG/JPG para conservar la proporción.
  let w, h
  if (type === 'png') { w = data.readUInt32BE(16); h = data.readUInt32BE(20) } else {
    let i = 2
    while (i < data.length) {
      const marker = data[i + 1]; const len = data.readUInt16BE(i + 2)
      if (marker >= 0xc0 && marker <= 0xc3) { h = data.readUInt16BE(i + 5); w = data.readUInt16BE(i + 7); break }
      i += 2 + len
    }
  }
  const pxW = Math.round(widthCm * 37.8)
  return center([new ImageRun({ type, data, transformation: { width: pxW, height: Math.round(pxW * h / w) } })], { spacing: { after: 60 }, keepNext: true })
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: border, bottom: border, left: border, right: border }

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0)
  const scaled = widths.map((w) => Math.round((w / total) * PAGE_W))
  const cell = (text, i, head) => new TableCell({
    borders,
    width: { size: scaled[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'D9D9D9' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ children: [t(String(text), { size: 20, bold: !!head })], spacing: { after: 0 } })],
  })
  return new Table({
    width: { size: scaled.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: scaled,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((hh, i) => cell(hh, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) })),
    ],
  })
}
const gap = () => p('', { spacing: { after: 80 } })

// ── carátula (modelo exacto de la skill caratula-tecsup) ──────────────
const cov = (text, o = {}, spacingAfter = 0) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { line: 360, after: spacingAfter }, children: [t(text, o)],
})
const caratula = [
  cov('INSTITUTO TECNOLÓGICO SUPERIOR TECSUP', { bold: true }),
  cov('DISEÑO Y DESARROLLO DE SOFTWARE', {}, 240),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(LOGO), transformation: { width: 189, height: 113 } })] }),
  cov('CURSO: DESARROLLO DE SOLUCIONES EN LA NUBE', { bold: true }),
  cov('PROYECTO:', { bold: true }),
  cov('LeGrandHotel – Sistema web de gestión de hospedaje', { bold: true }, 360),
  cov('ENTREGA N.º 1 (25%)', { bold: true }),
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

// ── datos de las pruebas ─────────────────────────────────
const runs = resumen.runs
const fmt = (n, d = 0) => Number(n).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d })
const runRows = runs.map((r) => [
  `${r.vus}`, fmt(r.reqs), fmt(r.rps, 1), `${fmt(r.med)} ms`, `${fmt(r.p95)} ms`, `${fmt(r.max)} ms`, `${fmt(r.fail_rate, 2)}%`,
  r.p95 < 500 ? 'Cumple' : 'No cumple',
])
const byType = resumen.p95_por_tipo
const last = runs[runs.length - 1]
const first = runs[0]
const sm = smoke.http_req_duration

const capture = (name, label, widthCm = 15) => {
  const f = path.join(CAPS, name)
  return fs.existsSync(f) ? [image(f, widthCm, name.endsWith('.png') ? 'png' : 'jpg'), caption(label)] : []
}

// ── contenido ────────────────────────────────────────────
const body = [
  p([t('Índice', { bold: true, size: 30 })], { spacing: { after: 160 } }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),

  h1('1. Alcance de la entrega del 25%'),
  p('Esta entrega presenta únicamente los puntos evaluados para la semana 9, según el documento «Pasos para presentación de entregables semana 9-11-13». Todo lo demás que ya se avanzó se presenta al final, en la sección 8, marcado como EXTRA, tal como pidió el docente.'),
  table(
    ['Punto evaluado (25%)', 'Cómo se cumple', 'Evidencia en este informe', 'Estado'],
    [
      ['Entorno cloud preparado (cuenta AWS, VPC, EC2, RDS)', 'Infraestructura como código con Terraform: VPC con subredes públicas y privadas, EC2, RDS MySQL 8, Security Groups y SSM', 'Sección 3: diagrama, recursos y costo estimado', 'Definido como código (Terraform)'],
      ['Endpoints definidos', 'Rutas en api/routes/api.php bajo /api/v1, formato JSON único y especificación OpenAPI', 'Sección 4', 'Cumplido'],
      ['Registro y login diferenciados y funcionales', 'POST /auth/register y POST /auth/login con validaciones propias y pantallas separadas /registro y /login', 'Sección 5 (flujo, capturas y pruebas automáticas)', 'Cumplido'],
    ],
    [3, 4, 3, 2.2],
  ),
  gap(),
  p([t('Repositorio: ', { bold: true }), t('https://github.com/Josephml23/LeGrandHotel')]),

  h1('2. Descripción del proyecto'),
  p('LeGrandHotel es un sistema web de gestión de hospedaje. Cubre habitaciones y tipos, reservas y estadías (check-in y check-out), cochera, clientes, personal e inventario. Lo usan cinco tipos de usuario: Administrador, Recepcionista, Almacenero, Cliente y Programador.'),
  h2('2.1 Tecnologías'),
  table(
    ['Capa', 'Tecnología'],
    [
      ['Backend (API)', 'Laravel 12 · PHP 8.3 (Docker) · Sanctum (tokens) · Socialite (Google) · Pest (pruebas)'],
      ['Frontend', 'React 18 · TypeScript · Vite · React Router · TanStack Query · Axios · Vitest'],
      ['Base de datos y caché', 'MySQL 8 en Amazon RDS · Redis (ElastiCache, entrega 80%)'],
      ['Contenedores', 'Docker + docker-compose (Nginx, PHP-FPM, MySQL, Redis en local)'],
      ['Nube', 'AWS: VPC, EC2, RDS, S3, CloudFront, ALB, CloudWatch, SSM, ECR'],
      ['Pruebas de carga', 'k6 con reporte HTML y gráficos'],
      ['Repositorio', 'Monorepo: api/, web/, infra/, tests/k6/, docs/'],
    ],
    [3, 8],
  ),

  h1('3. Arquitectura y entorno cloud'),
  p('El usuario solo llega a CloudFront (sitio web) y al balanceador (API). La API corre en EC2 y la base de datos no tiene acceso desde internet: vive en subredes privadas y solo acepta conexiones desde las instancias de la API.'),
  image(path.join(ROOT, 'docs/diagramas/arquitectura.png'), 16),
  caption('Figura 1. Arquitectura de LeGrandHotel en AWS (us-east-1).'),
  h2('3.1 Recursos del entorno (Terraform)'),
  p('Todo el entorno está descrito como código en infra/terraform, así se puede crear, revisar y destruir de forma repetible y sin pasos manuales.'),
  table(
    ['Recurso', 'Configuración', 'Archivo'],
    [
      ['VPC', '10.20.0.0/16, 2 subredes públicas y 2 privadas en 2 zonas de disponibilidad', 'network.tf'],
      ['EC2', 't3.small con Docker (Nginx + PHP-FPM), Auto Scaling de 1 a 3 instancias', 'compute.tf'],
      ['RDS', 'MySQL 8, db.t3.micro, 20 GB gp3 cifrado, subred privada, snapshots automáticos de 7 días', 'data.tf'],
      ['Security Groups', 'ALB: 443/80 · EC2: solo desde el ALB · RDS: 3306 solo desde EC2', 'network.tf'],
      ['SSM Parameter Store', 'Secretos y variables de producción (contraseña de BD como SecureString)', 'data.tf'],
      ['Presupuesto', 'Alerta de USD 10 desde el primer día', 'monitoring.tf'],
    ],
    [2.2, 7, 2],
  ),
  gap(),
  h2('3.2 Costo estimado'),
  table(
    ['Recurso', 'USD/mes (24/7)'],
    [['EC2 t3.small', '≈ 15'], ['RDS db.t3.micro + 20 GB', '≈ 15'], ['IPv4 públicas', '≈ 4–8'], ['Total 25% (sin ALB ni Redis)', '≈ 35; ≈ 12 apagando EC2 y RDS fuera de horario']],
    [6, 5],
  ),
  gap(),

  h1('4. Endpoints definidos'),
  p('Todas las rutas viven bajo /api/v1 y responden JSON. Salvo autenticación y salud, exigen un token de Sanctum. Los listados aceptan ?page= y ?per_page= (máximo 50). La especificación completa está en docs/endpoints/openapi.yaml y se puede abrir en editor.swagger.io.'),
  table(
    ['Módulo', 'Método y ruta', 'Acceso'],
    [
      ['Salud', 'GET /health', 'Público'],
      ['Autenticación', 'POST /auth/register', 'Público (3/min)'],
      ['Autenticación', 'POST /auth/login', 'Público (5/min)'],
      ['Autenticación', 'GET /auth/me · POST /auth/logout · POST /auth/refresh', 'Autenticado'],
      ['Autenticación', 'GET /auth/google/redirect · GET /auth/google/callback', 'Público'],
      ['Tipos de habitación', 'GET, POST /room-types · GET, PUT, DELETE /room-types/{id}', 'Admin (escritura), Recepción (lectura)'],
      ['Habitaciones', 'GET, POST /rooms · GET, PUT, DELETE /rooms/{id} · PATCH /rooms/{id}/status', 'Admin, Recepción'],
      ['Habitaciones', 'GET /rooms/available?from=&to=', 'Admin, Recepción, Cliente'],
      ['Clientes', 'CRUD /clients · GET, PUT /me/client', 'Admin, Recepción · Cliente'],
      ['Reservas y estadías', 'CRUD /reservations · POST /reservations/{id}/check-in · POST /stays/{id}/check-out', 'Admin, Recepción, Cliente (solo las suyas)'],
      ['Cochera', 'CRUD /parking-spots · CRUD /parking-assignments', 'Admin, Recepción'],
      ['Inventario', 'CRUD /inventory-items · POST /inventory-items/{id}/movements', 'Admin, Almacenero'],
      ['Personal y usuarios', 'CRUD /staff · CRUD /users · PUT /users/{id}/roles', 'Admin'],
      ['Reportes', 'GET /reports/occupancy · GET /reports/income', 'Admin'],
      ['Programador', 'GET /dev/overview · /dev/routes · /dev/requests · /dev/errors', 'Programador, Admin'],
    ],
    [2.5, 6.5, 3],
  ),
  gap(),
  h2('4.1 Formato único de respuesta'),
  code('Éxito: { "success": true, "data": {...}, "meta": { "page": 1, "per_page": 15, "total": 120 } }'),
  code('Error: { "success": false, "error": { "code": "ROOM_ALREADY_BOOKED", "message": "...", "details": {...} } }'),
  gap(),
  h2('4.2 Códigos HTTP'),
  table(
    ['Código', 'Cuándo se devuelve'],
    [
      ['200 / 201 / 204', 'Lectura, creación y eliminación correctas'],
      ['400', 'Cuerpo JSON mal formado'],
      ['401', 'Sin token, token vencido o credenciales incorrectas'],
      ['403', 'El rol no tiene permiso (aunque la ruta se escriba a mano)'],
      ['404', 'Recurso o ruta inexistente (p. ej. ROOM_NOT_FOUND)'],
      ['409', 'Conflicto: habitación ya reservada en esas fechas'],
      ['422', 'Validación fallida (detalle por campo)'],
      ['429', 'Demasiadas peticiones, con cabecera Retry-After'],
      ['500 / 503', 'Error interno o servicio caído: mensaje claro y código de incidente, sin trazas'],
    ],
    [2.5, 9],
  ),

  h1('5. Registro y login diferenciados'),
  p('El registro y el inicio de sesión son dos endpoints, dos validaciones (FormRequest) y dos pantallas distintas:'),
  table(
    ['', 'Registro', 'Login'],
    [
      ['Endpoint', 'POST /api/v1/auth/register', 'POST /api/v1/auth/login'],
      ['Pantalla', '/registro', '/login'],
      ['Datos', 'Nombre, correo, contraseña (2 veces), tipo y número de documento, teléfono, nacionalidad', 'Correo y contraseña'],
      ['Validación', 'Correo y documento únicos; contraseña ≥ 8 con letras y números', 'Credenciales contra el hash bcrypt'],
      ['Resultado', 'Crea la cuenta con rol Cliente y su ficha de huésped; envía correo de verificación; devuelve token', 'Devuelve token Bearer de 60 minutos y los roles del usuario'],
      ['Errores', '422 con detalle por campo; 429 al 4.º intento por minuto', '401 credenciales incorrectas; 429 al 6.º intento por minuto'],
    ],
    [2, 5, 5],
  ),
  gap(),
  p('La contraseña nunca se guarda en texto plano: el modelo User usa el cast «hashed» (bcrypt, 12 rondas). Tras iniciar sesión, cada rol entra a su propio inicio: el personal al Panel, el Cliente a «Mis reservas» y el Programador a su vista de diagnóstico.'),
  ...capture('login.png', 'Figura 2. Pantalla de inicio de sesión (/login).'),
  ...capture('registro.png', 'Figura 3. Pantalla de registro de huésped (/registro), separada del login.'),
  ...capture('panel.png', 'Figura 4. Panel de recepción después de iniciar sesión como Administrador.'),
  h2('5.1 Pruebas automáticas del registro y login'),
  table(
    ['Prueba (api/tests/Feature/AuthTest.php)', 'Resultado'],
    [
      ['Registro crea un Cliente con contraseña bcrypt y devuelve token', 'Pasa'],
      ['Registro con datos inválidos responde 422', 'Pasa'],
      ['No se permite registrar un correo repetido', 'Pasa'],
      ['Registro limitado a 3 por minuto (429 con Retry-After)', 'Pasa'],
      ['Login con credenciales válidas devuelve token y roles', 'Pasa'],
      ['Login con contraseña incorrecta responde 401', 'Pasa'],
      ['Login limitado a 5 intentos por minuto', 'Pasa'],
      ['Sin token o con token vencido responde 401', 'Pasa'],
      ['Frontend: login y registro son pantallas separadas; errores 401 y 422 visibles (Vitest)', 'Pasa'],
    ],
    [9, 2],
  ),
  gap(),
  p([t('Resultado global: ', { bold: true }), t('89 pruebas de la API (376 aserciones) y 14 pruebas del frontend pasan. El análisis estático con PHPStan no reporta errores y el pipeline de GitHub Actions está en verde.')]),

  h1('6. Registro de incidentes'),
  p('Toda caída, aunque sea en desarrollo, se registra el mismo día (docs/incidentes.md).'),
  table(
    ['Fecha', 'Qué falló', 'Motivo', 'Solución', 'Tiempo'],
    [
      ['26/10/2026', 'El login devolvía 500 con código de incidente XG1R7UASWT', '«php artisan serve» lanzaba PHP sin la extensión pdo_sqlite', 'Servidor local con php -S cargando la extensión', '≈ 2 min'],
      ['26/10/2026', 'El frontend mostró la pantalla 503', 'El servidor apuntaba a un index.php inexistente', 'Usar api/public/index.php como router; la pantalla 503 reintentó sola', '≈ 1 min'],
      ['27/10/2026', 'Primera corrida de k6: 100% de peticiones fallidas', 'PHP escuchaba solo en IPv6 (::1) y k6 resolvía localhost a IPv4', 'BASE_URL=http://[::1]:8000; se repitieron las corridas', '≈ 5 min'],
    ],
    [1.6, 3, 3, 3, 1.2],
  ),

  h1('7. Conclusiones de la entrega'),
  bullet('Los tres puntos del 25% están implementados: endpoints definidos y documentados, registro y login separados y probados, y el entorno cloud descrito como código.'),
  bullet('Las pruebas de carga locales (sección 8.2) muestran que el servidor de desarrollo se satura con pocos usuarios. En la entrega del 80% se repetirán en AWS con Nginx + PHP-FPM, que atiende varias peticiones a la vez.'),

  pageBreak(),
  h1('8. EXTRAS (adicionales a lo evaluado en el 25%)'),
  p([t('Todo lo de esta sección es EXTRA: no forma parte de lo evaluado en el 25% y se presenta como avance adicional.', { bold: true })]),

  h2('8.1 EXTRA: Diagrama de base de datos'),
  p('13 tablas del dominio en MySQL 8 con los índices que pide el plan: rooms(status), reservations(check_in, check_out), reservations(client_id), clients(document_number) único e inventory_items(name). La versión editable está en DBML (docs/diagramas/legrandhotel.dbml) y se abre en dbdiagram.io.'),
  image(path.join(ROOT, 'docs/diagramas/base-de-datos.png'), 16.5),
  caption('Figura 5. Modelo entidad-relación de LeGrandHotel.'),

  h2('8.2 EXTRA: Pruebas de rendimiento y estrés con k6 (varias corridas)'),
  p('Se hicieron cinco corridas con k6 contra la API en el equipo de desarrollo (Windows, PHP 8.2, servidor integrado de PHP que atiende una petición a la vez, SQLite y caché en archivo). No es el servidor de producción: sirven para comparar la carga entre corridas y detectar cuellos de botella antes de subir a AWS.'),
  p('Escenario: 70% lecturas (habitaciones disponibles, mis reservas, tipos de habitación), 20% login y 10% creación de reservas. Cada escalón sube en 10 s, mantiene la carga 45 s y baja en 5 s. Meta del plan: p95 menor a 500 ms y 0% de errores.'),
  table(
    ['Corrida', 'Peticiones', 'Errores', 'p50', 'p95', 'Resultado'],
    [[
      'Smoke (5 VU, 30 s): salud, BD, caché y 401', fmt(smoke.http_reqs.count), `${fmt((smoke.http_req_failed.value || 0) * 100, 2)}%`,
      `${fmt(sm.med)} ms`, `${fmt(sm['p(95)'])} ms`, 'Cumple (100% de verificaciones)',
    ]],
    [4.5, 1.6, 1.4, 1.4, 1.4, 2.8],
  ),
  gap(),
  table(['VU', 'Peticiones', 'Pet./s', 'p50', 'p95', 'Máx.', 'Errores', 'p95 < 500 ms'], runRows, [1, 1.6, 1.3, 1.4, 1.4, 1.4, 1.3, 1.8]),
  gap(),
  image(path.join(ROOT, 'docs/pruebas/graficos/01-latencia-por-carga.png'), 15),
  caption('Figura 6. Tiempo de respuesta (p50, p90, p95) según la cantidad de usuarios virtuales.'),
  image(path.join(ROOT, 'docs/pruebas/graficos/02-peticiones-por-segundo.png'), 15),
  caption('Figura 7. Peticiones atendidas por segundo en cada corrida.'),
  image(path.join(ROOT, 'docs/pruebas/graficos/03-tasa-de-errores.png'), 15),
  caption('Figura 8. Porcentaje de peticiones fallidas en cada corrida.'),
  image(path.join(ROOT, 'docs/pruebas/graficos/04-p95-por-operacion.png'), 15),
  caption('Figura 9. p95 por tipo de operación (lecturas, login, crear reserva).'),
  image(path.join(ROOT, 'docs/pruebas/graficos/05-evolucion-' + last.vus + 'vu.png'), 15),
  caption(`Figura 10. Evolución de la latencia segundo a segundo en la corrida de ${last.vus} usuarios.`),
  h2('8.3 Análisis y cuello de botella encontrado'),
  bullet(`Con ${first.vus} usuarios el p95 fue ${fmt(first.p95)} ms; con ${last.vus} usuarios llegó a ${fmt(last.p95)} ms. Las peticiones por segundo apenas suben (${fmt(first.rps, 1)} → ${fmt(last.rps, 1)}): el servidor ya estaba al máximo de lo que puede atender.`),
  bullet('Causa: el servidor integrado de PHP en Windows procesa una petición a la vez. Cuando llegan más usuarios, las peticiones esperan en cola y el tiempo de respuesta crece de forma casi lineal, aunque el código de cada endpoint sea rápido (en la prueba masiva de Pest, el listado de 5000 reservas responde en menos de 500 ms).'),
  bullet(`Con ${last.vus} VU, lecturas, login y creación de reservas tienen casi el mismo p95 (${fmt((byType[last.vus] || {}).lectura || 0)}, ${fmt((byType[last.vus] || {}).login || 0)} y ${fmt((byType[last.vus] || {}).escritura || 0)} ms). El tiempo lo domina la espera en la cola del servidor, no el trabajo de cada endpoint.`),
  bullet('A pesar de la saturación no hubo errores (0% en todas las corridas): la API responde más lento, pero no se cae ni pierde peticiones.'),
  bullet('Corrección prevista para el 80%: Docker con Nginx + PHP-FPM (20 procesos), OPcache, MySQL en RDS y Redis para caché y rate limit. Las mismas corridas se repetirán en AWS con 50–100 y luego 1000–5000 usuarios, para comparar el antes y el después.'),
  p('Los reportes HTML interactivos de cada corrida (generados por k6) están en docs/pruebas/local-*.html y los datos crudos en docs/pruebas/datos/.'),

  h2('8.4 EXTRA: Cifrado (ofuscación) del código'),
  p('El build de producción del frontend sale ofuscado con javascript-obfuscator: los nombres se reemplazan por identificadores hexadecimales y los textos se guardan codificados en base64. Comparación del mismo texto de la interfaz («No tienes acceso»):'),
  table(['Build', 'Comando', 'Veces que aparece legible'], [['Normal', 'npm run build:plain', '1'], ['Ofuscado (producción)', 'npm run build', '0']], [3, 4, 4]),
  gap(),
  p('El backend no se publica: corre en un servidor privado sin acceso al código.'),

  h2('8.5 EXTRA: Vista del programador'),
  p('El rol Programador tiene una pantalla de diagnóstico (/programador) que muestra, sin entrar al servidor: estado de la aplicación, la base de datos y la caché; versión y configuración (vida del token, rate limits, CORS); latencias p50/p95/p99 calculadas del log JSON; rutas más lentas; últimas peticiones; errores buscables por código de incidente, el mismo que ve el usuario en la pantalla 500; y la lista de todas las rutas de la API con su rol de acceso. No muestra contraseñas ni claves, y una prueba automática lo verifica.'),
  ...capture('programador.png', 'Figura 11. Vista del programador.'),

  h2('8.6 EXTRA: Seguridad y calidad adelantadas'),
  bullet('Rate limits: login 5/min, registro 3/min y API 60/min, con respuesta 429 y Retry-After (punto del 80%).'),
  bullet('Roles y permisos: el rol se valida antes de buscar el registro, así una ruta pedida a mano responde 403 sin revelar si el id existe.'),
  bullet('Pantallas de error en React: 404, «En construcción», 403, sesión expirada, 500 con código de incidente, 503 con reintento cada 30 s, sin conexión y 429 con cuenta regresiva.'),
  bullet('CI/CD en GitHub Actions: estilo (Pint), análisis (PHPStan), pruebas (Pest y Vitest), auditoría de dependencias y Semgrep en cada cambio. Auditoría actual: 0 vulnerabilidades en composer y npm y 0 hallazgos en Semgrep.'),
  bullet('Logs estructurados en JSON (una línea por petición con request_id, ruta, código y duración), listos para CloudWatch.'),

  h1('9. Siguientes pasos (entrega del 80%)'),
  bullet('Desplegar con el pipeline: imagen Docker en ECR, frontend en S3 + CloudFront, ALB con HTTPS.'),
  bullet('Repetir las pruebas k6 en AWS con 50–100 y 1000–5000 usuarios, con reportes HTML y comparación antes/después.'),
  bullet('Configurar el login con Google (credenciales OAuth) y los respaldos automáticos de RDS y S3.'),
]

const doc = new Document({
  creator: 'Equipo LeGrandHotel',
  title: 'LeGrandHotel – Entrega N.º 1 (25%)',
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  features: { updateFields: true },
  sections: [{
    properties: { page: { margin: { top: Math.round(2.5 * CM), bottom: Math.round(2.5 * CM), left: Math.round(2.5 * CM), right: Math.round(2.5 * CM) } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) },
    children: [...caratula, ...body],
  }],
})

fs.mkdirSync(path.dirname(OUT), { recursive: true })
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT) })
