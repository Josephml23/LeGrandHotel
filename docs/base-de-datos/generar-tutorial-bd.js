// Genera docs/base-de-datos/LeGrandHotel_Tutorial_Base_de_datos.docx: cómo encender la base MySQL del proyecto,
// conectarse con MySQL Workbench (o por terminal), qué hay en cada tabla y cómo consultarla sin romper nada.
//   node docs/base-de-datos/generar-tutorial-bd.js <logo_tecsup.jpg>
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, PageBreak, Footer, PageNumber, LevelFormat, BorderStyle, ShadingType, TableOfContents, VerticalAlign,
} = require('docx')

const BASE = 'C:/Proyectos/LeGrandHotel/docs/base-de-datos'
const LOGO = process.argv[2]
const OUT = path.join(BASE, 'LeGrandHotel_Tutorial_Base_de_datos.docx')
const SHOTS = path.join(BASE, 'capturas')
const salida = (f) => fs.readFileSync(path.join(BASE, 'salidas', f), 'utf8').replace(/\s+$/, '').split('\n')

const FONT = 'Times New Roman'
const CODE = 'Consolas'
const CM = 567
const PAGE_W = 11906 - 2 * Math.round(2.5 * CM)

// ── helpers ─────────────────────────────────────────────
const t = (text, o = {}) => new TextRun({ text, font: FONT, size: 24, ...o })
const b = (text) => t(text, { bold: true })
const c = (text, size = 19) => new TextRun({ text, font: CODE, size })
const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [t(children)], spacing: { after: 120, line: 300 }, ...o })
const center = (children, o = {}) => p(children, { alignment: AlignmentType.CENTER, ...o })
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 240, after: 160 } })
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 200, after: 120 } })
const bullet = (children) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: Array.isArray(children) ? children : [t(children)], spacing: { after: 60, line: 288 } })
let listId = 0
/** Empieza una lista numerada nueva (vuelve a 1). */
const nueva = () => { listId += 1; return [] }
const num = (children) => new Paragraph({ numbering: { reference: 'pasos', level: 0, instance: listId }, children: Array.isArray(children) ? children : [t(children)], spacing: { after: 80, line: 288 } })
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })
const caption = (text) => center([t(text, { italics: true, size: 20 })], { spacing: { after: 200 } })
const gap = () => p('', { spacing: { after: 80 } })

/** Bloque monoespaciado con etiqueta (comandos, SQL o resultados). */
function block(label, lines, size = 19) {
  return [
    new Paragraph({ keepNext: true, spacing: { before: 60, after: 0 }, children: [t(label, { bold: true, size: 20, color: '444444' })] }),
    ...lines.map((l, i) => new Paragraph({
      keepNext: i < lines.length - 1, keepLines: true,
      children: [c(l, size)], spacing: { after: i === lines.length - 1 ? 140 : 0, line: 250 },
      shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' }, indent: { left: 200 },
    })),
  ]
}
const ps = (...lines) => block('PowerShell', lines)
const sql = (...lines) => block('SQL (en Workbench)', lines)
const result = (file) => block('Resultado real', salida(file), 16)
const por = (...children) => p([b('Por qué: '), ...children.map((x) => (typeof x === 'string' ? t(x) : x))])
const ver = (...children) => p([b('Qué debes ver: '), ...children.map((x) => (typeof x === 'string' ? t(x) : x))])

let figure = 0
function shot(name, label, widthCm = 15) {
  const data = fs.readFileSync(path.join(SHOTS, `${name}.png`))
  const w = data.readUInt32BE(16)
  const h = data.readUInt32BE(20)
  let pxW = Math.round(widthCm * 37.8)
  const maxH = Math.round(20 * 37.8)
  if (pxW * h / w > maxH) pxW = Math.round(maxH * w / h)
  figure += 1
  return [
    center([new ImageRun({ type: 'png', data, transformation: { width: pxW, height: Math.round(pxW * h / w) } })], { spacing: { after: 60 }, keepNext: true }),
    caption(`Figura ${figure}. ${label}`),
  ]
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: border, bottom: border, left: border, right: border }
function table(headers, rows, widths) {
  const total = widths.reduce((a, x) => a + x, 0)
  const scaled = widths.map((w) => Math.round((w / total) * PAGE_W))
  const cell = (text, i, head) => new TableCell({
    borders,
    width: { size: scaled[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'D9D9D9' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ children: [String(text).startsWith('`') ? c(String(text).slice(1)) : t(String(text), { size: 20, bold: !!head })], spacing: { after: 0 } })],
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

// ── carátula (skill caratula-tecsup) ─────────────────────
const cov = (text, o = {}, spacingAfter = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 360, after: spacingAfter }, children: [t(text, o)] })
const caratula = [
  cov('INSTITUTO TECNOLÓGICO SUPERIOR TECSUP', { bold: true }),
  cov('DISEÑO Y DESARROLLO DE SOFTWARE', {}, 240),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(LOGO), transformation: { width: 189, height: 113 } })] }),
  cov('CURSO: DESARROLLO DE SOLUCIONES EN LA NUBE', { bold: true }),
  cov('PROYECTO:', { bold: true }),
  cov('LeGrandHotel – Sistema web de gestión de hospedaje', { bold: true }, 240),
  cov('TUTORIAL: ACCESO A LA BASE DE DATOS CON MYSQL WORKBENCH', { bold: true }),
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

// ── contenido ─────────────────────────────────────────────
const body = [
  p([t('Índice', { bold: true, size: 30 })], { spacing: { after: 160 } }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),

  h1('1. Qué base de datos usa LeGrandHotel'),
  p('LeGrandHotel guarda todo (huéspedes, reservas, habitaciones, inventario, cuentas y auditoría) en una base de datos MySQL 8.4 llamada legrandhotel. En la computadora de desarrollo esa base corre dentro de Docker; en la nube correrá en Amazon RDS.'),
  table(['Dónde', 'Motor', 'Para qué'], [
    ['Laptop (este tutorial)', 'MySQL 8.4 en Docker (contenedor legrandhotel-mysql-1)', 'Desarrollar, probar la página y revisar los datos'],
    ['Pruebas automáticas (Pest)', 'SQLite en memoria', 'Se crea y se borra sola en cada prueba; no se abre con Workbench'],
    ['AWS (entrega final)', 'MySQL en Amazon RDS', 'La base real del hotel'],
  ], [3, 4.2, 4.8]),
  gap(),
  p([b('Por qué en Docker: '), t('Docker trae MySQL ya configurado, con la misma versión para todo el equipo, sin instalarlo en Windows. Los datos se guardan en un volumen de Docker (mysql-data), así que no se pierden al apagar el contenedor.')]),
  h2('1.1 Qué vas a lograr'), ...nueva(),
  num('Encender la base de datos.'),
  num('Asegurarte de que tiene todas sus tablas al día.'),
  num('Conectarte con MySQL Workbench y guardar la conexión.'),
  num('Ver las tablas, entender qué guarda cada una y hacer consultas.'),
  num('Hacer un respaldo y apagar todo sin perder datos.'),
  h2('1.2 Qué necesitas'),
  bullet('Docker Desktop instalado.'),
  bullet('MySQL Workbench instalado (este tutorial usa la versión 26.10, la nueva interfaz de Workbench).'),
  bullet('El proyecto en C:\\Proyectos\\LeGrandHotel con su archivo api\\.env.'),
  bullet('PHP 8.2 (solo para el paso 3, crear o actualizar las tablas).'),

  h1('2. Los datos de conexión'),
  p('Son los mismos para Workbench, para la terminal y para la API. Están en el archivo api\\.env del proyecto (líneas que empiezan con DB_):'),
  table(['Dato', 'Valor', 'Dónde se ve en api\\.env', 'Por qué'], [
    ['Host', '127.0.0.1', 'DB_HOST', 'La base corre en tu propia computadora. Se escribe 127.0.0.1 y no «localhost» para que Windows no intente IPv6'],
    ['Puerto', '3306', 'DB_PORT', 'Puerto estándar de MySQL; Docker lo conecta con el del contenedor'],
    ['Usuario', 'legrandhotel', 'DB_USERNAME', 'Usuario propio del proyecto (no root): solo tiene permiso sobre la base legrandhotel'],
    ['Contraseña', 'la de DB_PASSWORD', 'DB_PASSWORD', 'Debe ser igual a MYSQL_PASSWORD del archivo docker-compose.yml, que es con la que se creó la base'],
    ['Base (esquema)', 'legrandhotel', 'DB_DATABASE', 'Es donde Laravel creó todas las tablas'],
  ], [2, 2.3, 2.5, 5.2]),
  gap(),
  p([b('Sobre la contraseña: '), t('ábrela en api\\.env con el Bloc de notas o VS Code y cópiala de la línea DB_PASSWORD. No la escribas en documentos ni la subas a GitHub: el archivo .env está fuera del repositorio a propósito.')]),

  h1('3. Paso 1: encender Docker Desktop'), ...nueva(),
  num('Abre Docker Desktop desde el menú Inicio.'),
  num('Espera a que abajo a la izquierda diga «Engine running» (motor corriendo). La primera vez puede tardar uno o dos minutos.'),
  por('MySQL vive dentro de Docker. Si Docker está apagado, ningún programa (ni Workbench ni la API) puede llegar a la base, y verás el error «Can\'t connect to MySQL server».'),

  h1('4. Paso 2: encender la base de datos'),
  p('Abre PowerShell en la carpeta del proyecto (la línea debe decir PS C:\\Proyectos\\LeGrandHotel>) y escribe:'),
  ...ps('cd C:\\Proyectos\\LeGrandHotel', 'docker compose up -d mysql'),
  ...shot('b1-docker-up', 'Docker enciende el contenedor de MySQL.'),
  por('docker compose lee el archivo docker-compose.yml, que está en la carpeta del proyecto (por eso hay que estar ahí). La palabra mysql enciende solo la base de datos: si encendieras todo el proyecto, el contenedor nginx ocuparía el puerto 8000 que usa la API cuando la corres con PHP. La opción -d deja el contenedor corriendo en segundo plano y te devuelve la terminal.'),
  p('Comprueba que está listo:'),
  ...ps('docker compose ps mysql'),
  ...shot('b2-docker-ps', 'MySQL está encendido y sano (healthy) en el puerto 3306.'),
  ver('en la columna STATUS, «Up … (healthy)». Si dice «(health: starting)», espera unos segundos y repite el comando: MySQL todavía está arrancando. En PORTS debe aparecer 0.0.0.0:3306->3306/tcp, que significa que el puerto 3306 de tu computadora lleva al MySQL del contenedor.'),

  h1('5. Paso 3: tener las tablas al día'),
  p('Laravel crea y actualiza las tablas con «migraciones». Hay que correrlas la primera vez y cada vez que alguien del equipo agrega una nueva (por ejemplo, cuando se agregó el rol Cliente):'),
  ...ps('cd api', 'php artisan migrate'),
  ...shot('b3-migrate', 'Laravel aplica la migración que faltaba.'),
  p('Para ver cuáles están aplicadas:'),
  ...ps('php artisan migrate:status'),
  ...shot('b3b-migrate-status', 'Todas las migraciones dicen «Ran»: la base está al día.'),
  por('si la base no tiene una migración reciente, le faltan tablas o columnas (por ejemplo clients.user_id o room_types.amenities) y la página falla al usarlas. Revisar el estado antes de abrir Workbench evita confundirse buscando una columna que todavía no existe. Las migraciones nunca borran datos existentes: solo agregan o cambian estructura.'),
  p([b('Si la base está vacía '), t('(la primera vez), carga también los datos de demostración y los masivos:')]),
  ...ps('php artisan db:seed --class=DemoSeeder', 'php artisan db:seed --class=MassiveDataSeeder'),
  p('DemoSeeder crea las cuentas de prueba, los tipos y las habitaciones; MassiveDataSeeder agrega 1000 huéspedes y 5000 reservas. No corras MassiveDataSeeder dos veces: duplicaría los datos.'),

  h1('6. Paso 4: abrir MySQL Workbench'),
  p('Ábrelo desde el menú Inicio. Verás la pantalla de bienvenida y, abajo, la sección Database Connections (conexiones guardadas). La primera vez está vacía.'),
  ...shot('w1-inicio', 'Pantalla de inicio de MySQL Workbench 26.10. El botón + de la derecha crea una conexión.'),
  p([b('Si la ventana se queda en negro: '), t('es la nueva interfaz cargando. Espera unos segundos; si sigue igual, pulsa Ctrl + B (mostrar u ocultar la barra lateral) para que se redibuje.')]),
  p([b('Por qué esta versión: '), t('Workbench 26.10 es la versión nueva y está hecha para MySQL 8.4 y posteriores, que es justo la versión que usamos en Docker. El Workbench 8.0 anterior muestra advertencias con MySQL 8.4.')]),

  h1('7. Paso 5: crear la conexión'), ...nueva(),
  num([t('En la fila '), b('Database Connections'), t(', pulsa el botón '), b('+'), t(' (a la derecha). Se abre la ventana Database Connection Configuration.')]),
  ...shot('w2-formulario-vacio', 'Ventana de nueva conexión, tal como aparece.', 12.5),
  num('Llena los campos así:'),
  table(['Campo', 'Qué escribir', 'Por qué'], [
    ['Caption', 'LeGrandHotel (local)', 'Nombre con el que verás la conexión en la pantalla de inicio'],
    ['Description', 'MySQL en Docker', 'Opcional: te recuerda de dónde es'],
    ['Connection Method', 'mysql (déjalo así)', 'Conexión directa por TCP, que es como Docker expone la base'],
    ['User Name', 'legrandhotel', 'El usuario del proyecto (DB_USERNAME)'],
    ['Host Name or IP Address', '127.0.0.1', 'Cambia «localhost» por 127.0.0.1 para usar IPv4, la dirección por donde Docker publica el puerto'],
    ['Port', '3306', 'Ya viene puesto'],
    ['Default Schema', 'legrandhotel', 'Al conectarte, Workbench ya entra a esta base y no tienes que escribir USE legrandhotel'],
    ['Pestañas TLS y Options', 'No cambies nada', 'En local no hace falta cifrar la conexión'],
  ], [3, 3, 5]),
  gap(),
  ...shot('w3-formulario-lleno', 'La conexión con los datos de LeGrandHotel.', 12.5),

  h1('8. Paso 6: guardar la contraseña y probar'), ...nueva(),
  num([t('En la pestaña '), b('Authentication'), t(', Factor 1 queda en «password». Pulsa '), b('Store Password'), t('.')]),
  num([t('Se abre el cuadro '), b('Open MySQL Connection'), t('. Escribe la contraseña (la de DB_PASSWORD en api\\.env) y pulsa '), b('OK'), t('. Mientras escribes no se ve nada: es normal.')]),
  ...shot('w4-contrasena', 'Cuadro para guardar la contraseña de forma segura.', 12.5),
  num([t('Pulsa '), b('Test Connection'), t('. Debe decir que la conexión fue exitosa. Si sale un error, ve a la sección 14.')]),
  num([t('Pulsa '), b('OK'), t(' para guardar la conexión. Aparecerá como una tarjeta en Database Connections.')]),
  por('Store Password guarda la contraseña de forma segura en tu usuario de Windows, así no la escribes cada vez que te conectas. Si prefieres que la pida siempre, no pulses Store Password: Workbench la pedirá al conectarte («Password will be prompted»). Test Connection comprueba los cinco datos antes de guardar, para no quedarte con una conexión que no funciona.'),

  h1('9. Paso 7: conectarte y ver las tablas'), ...nueva(),
  num('En la pantalla de inicio, haz clic en la tarjeta LeGrandHotel (local).'),
  num('Se abre una pestaña nueva con el editor SQL, ya dentro de la base legrandhotel.'),
  num('Abre la barra lateral (Ctrl + B si no se ve) y despliega la base legrandhotel → Tables para ver las 23 tablas.'),
  num('Para ver el contenido de una tabla, escribe una consulta en el editor (sección 11) y ejecútala con Ctrl + Enter.'),
  p('Estas son las tablas que debes ver (resultado real de SHOW TABLES):'),
  ...shot('b4-mysql-tablas', 'Las 23 tablas de la base legrandhotel.', 11),

  h1('10. Qué guarda cada tabla'),
  h2('10.1 Tablas del hotel'),
  table(['Tabla', 'Qué guarda', 'Se relaciona con'], [
    ['clients', 'Fichas de huéspedes: nombre, documento, teléfono, correo. user_id indica si el huésped tiene cuenta web (rol Cliente)', 'users, reservations'],
    ['room_types', 'Tipos de habitación: precio por noche, capacidad y amenities (lo que incluye, en formato JSON)', 'rooms'],
    ['rooms', 'Habitaciones: número, piso, estado (available, occupied, cleaning, maintenance)', 'room_types, reservations'],
    ['reservations', 'Reservas: huésped, habitación, fechas, estado y total', 'clients, rooms, stays'],
    ['stays', 'Estadías: hora real de check-in y de check-out', 'reservations, parking_assignments'],
    ['parking_spots', 'Espacios de la cochera y su estado', 'parking_assignments'],
    ['parking_assignments', 'Qué vehículo (placa) ocupa qué espacio y desde cuándo', 'parking_spots, stays'],
    ['inventory_items', 'Insumos del almacén: stock actual y mínimo', 'inventory_movements'],
    ['inventory_movements', 'Entradas y salidas de cada insumo, con motivo y quién las hizo', 'inventory_items, users'],
    ['staff', 'Personal del hotel: cargo, turno y fecha de ingreso', 'users'],
    ['audit_logs', 'Auditoría: quién creó, editó o borró cada registro, con los valores antes y después', 'users'],
  ], [3, 6, 2.6]),
  h2('10.2 Cuentas y permisos'),
  table(['Tabla', 'Qué guarda'], [
    ['users', 'Cuentas: nombre, correo y contraseña cifrada (bcrypt). Los clientes tienen google_id y no tienen contraseña'],
    ['roles', 'Los 5 roles: admin, receptionist, storekeeper, developer, client'],
    ['role_user', 'Qué rol tiene cada cuenta (una cuenta puede tener varios)'],
    ['personal_access_tokens', 'Tokens de sesión de la API (Sanctum), que vencen a los 60 minutos'],
    ['password_reset_tokens', 'Pedidos de cambio de contraseña'],
  ], [3.4, 8]),
  h2('10.3 Tablas internas de Laravel'),
  table(['Tabla', 'Qué guarda'], [
    ['migrations', 'Qué migraciones se aplicaron (es lo que lee migrate:status). No la edites'],
    ['cache, cache_locks', 'Caché de la aplicación'],
    ['sessions', 'Sesiones del navegador'],
    ['jobs, job_batches, failed_jobs', 'Tareas en segundo plano (por ejemplo, correos) y las que fallaron'],
  ], [3.4, 8]),
  p([b('Por qué conviene saberlo: '), t('para revisar un dato casi siempre basta con las tablas del hotel. Las internas de Laravel las maneja el sistema solo y no hace falta abrirlas.')]),

  h1('11. Consultas útiles (con su resultado real)'),
  p('Copia cada consulta en el editor de Workbench y pulsa Ctrl + Enter. Debajo de cada una está lo que devolvió nuestra base el 27 de octubre de 2026.'),
  h2('11.1 Cuántos registros hay en cada tabla'),
  ...sql(
    "SELECT 'clients' AS tabla, COUNT(*) AS filas FROM clients",
    "UNION ALL SELECT 'reservations', COUNT(*) FROM reservations",
    "UNION ALL SELECT 'rooms', COUNT(*) FROM rooms",
    "UNION ALL SELECT 'room_types', COUNT(*) FROM room_types",
    "UNION ALL SELECT 'users', COUNT(*) FROM users",
    "UNION ALL SELECT 'stays', COUNT(*) FROM stays",
    "UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_items;",
  ),
  ...result('11-conteos.txt'),
  p('Sirve para confirmar que los datos de demostración se cargaron. Los 55 usuarios son las 5 cuentas del equipo más los 50 recepcionistas de las pruebas k6.'),
  h2('11.2 Cuentas de demostración y su rol'),
  ...sql(
    'SELECT u.id, u.name, u.email, r.name AS rol',
    'FROM users u',
    'JOIN role_user ru ON ru.user_id = u.id',
    'JOIN roles r ON r.id = ru.role_id',
    "WHERE u.email LIKE '%@legrandhotel.test'",
    'ORDER BY u.id;',
  ),
  ...result('12-usuarios.txt'),
  p('Une tres tablas (JOIN): users tiene la cuenta, roles el nombre del rol y role_user dice qué rol tiene cada cuenta.'),
  h2('11.3 Tipos de habitación y lo que incluyen'),
  ...sql('SELECT name, price_per_night, capacity, amenities FROM room_types;'),
  ...result('13-tipos.txt'),
  p('amenities es una columna JSON: guarda la lista de servicios que ve el cliente al reservar.'),
  h2('11.4 Próximas llegadas'),
  ...sql(
    'SELECT r.id, c.full_name AS huesped, ro.number AS hab,',
    '       r.check_in, r.check_out, r.status, r.total',
    'FROM reservations r',
    'JOIN clients c ON c.id = r.client_id',
    'JOIN rooms ro ON ro.id = r.room_id',
    'WHERE r.check_in >= CURDATE()',
    'ORDER BY r.check_in',
    'LIMIT 8;',
  ),
  ...result('14-reservas.txt'),
  p('CURDATE() es la fecha de hoy; LIMIT 8 muestra solo las primeras 8 para no cargar las 5000.'),
  h2('11.5 Reservas por estado'),
  ...sql('SELECT status, COUNT(*) AS cantidad FROM reservations GROUP BY status;'),
  ...result('15-estados.txt'),
  p('GROUP BY junta las reservas por estado y COUNT(*) las cuenta. completed = ya terminaron; confirmed = por llegar; checked_in = el huésped está dentro.'),

  h1('12. Cuidado al modificar datos'),
  p('Workbench permite editar y borrar filas directamente, pero en LeGrandHotel conviene hacerlo desde la página y no desde la base. Estas son las razones:'),
  table(['Si cambias algo en Workbench…', 'Lo que se pierde'], [
    ['Las validaciones', 'La API revisa fechas, capacidad, stock y documentos repetidos. En la base puedes crear una reserva que se cruza con otra o dejar stock negativo'],
    ['La auditoría', 'Cada cambio hecho desde la página queda en audit_logs con quién y cuándo. Un cambio en Workbench no deja rastro'],
    ['Las reglas de negocio', 'Un check-out desde la página libera la habitación y la cochera. Cambiar solo el estado en la base deja esos datos inconsistentes'],
    ['Las contraseñas', 'Están cifradas con bcrypt. Si escribes una contraseña en texto plano en users.password, esa cuenta no podrá entrar'],
  ], [3.5, 7.5]),
  gap(),
  p([b('Regla práctica: '), t('usa Workbench para mirar (SELECT). Si de verdad necesitas cambiar algo, primero haz un respaldo (sección 13) y escribe la consulta con WHERE y el id exacto. Un UPDATE o DELETE sin WHERE cambia o borra la tabla entera.')]),

  h1('13. Respaldo y apagado'),
  h2('13.1 Hacer un respaldo'),
  p('Desde la carpeta del proyecto, en PowerShell (te pedirá la contraseña):'),
  ...ps(
    'docker compose exec mysql sh -c "mysqldump -u legrandhotel -p legrandhotel > /tmp/respaldo.sql"',
    'docker compose cp mysql:/tmp/respaldo.sql .\\respaldo-legrandhotel.sql',
  ),
  por('mysqldump copia toda la base (estructura y datos) en un archivo .sql. Se genera dentro del contenedor y luego se copia afuera con docker compose cp porque, si se guardara directo con > en PowerShell, el archivo quedaría en otra codificación (UTF-16) y MySQL no lo podría leer al restaurarlo. No subas ese archivo a GitHub: tiene datos y contraseñas cifradas.'),
  h2('13.2 Apagar la base'),
  ...ps('docker compose stop mysql'),
  por('apaga el contenedor y libera memoria. Los datos siguen guardados en el volumen mysql-data: la próxima vez que hagas docker compose up -d mysql estará todo igual.'),
  p([b('Nunca uses docker compose down -v '), t('si quieres conservar los datos: la opción -v borra el volumen, es decir, la base completa.')]),

  h1('14. Si algo sale mal'),
  table(['Lo que ves', 'Por qué pasa', 'Qué hacer'], [
    ['«Can\'t connect to MySQL server on 127.0.0.1:3306»', 'Docker o el contenedor está apagado', 'Pasos 1 y 2; espera a que diga (healthy)'],
    ['«Access denied for user \'legrandhotel\'»', 'Contraseña distinta de la de DB_PASSWORD', 'Vuelve a pulsar Store Password y cópiala exacta de api\\.env'],
    ['Access denied aunque la contraseña es la de api\\.env', 'La base se creó con otra MYSQL_PASSWORD (el volumen guarda la primera)', 'Usa la contraseña con la que se creó; pregunta al equipo antes de borrar el volumen'],
    ['docker compose up falla: «port 3306 is already allocated»', 'Otro MySQL usa el puerto, por ejemplo el de XAMPP', 'Detén MySQL en el panel de XAMPP (o el servicio MySQL de Windows) y repite el paso 2'],
    ['Workbench conecta, pero no ve las tablas', 'Te conectaste a otro MySQL (el de XAMPP) o la base está vacía', 'Comprueba el paso 2 y corre las migraciones (paso 3)'],
    ['«Unknown column \'user_id\'» o falta amenities', 'Falta una migración', 'php artisan migrate (paso 3)'],
    ['La ventana de Workbench se queda en negro', 'La interfaz nueva está cargando', 'Espera unos segundos o pulsa Ctrl + B'],
    ['«docker» no se reconoce como comando', 'Docker Desktop no está instalado o no se abrió nunca', 'Instálalo, ábrelo una vez y abre una terminal nueva'],
  ], [3.6, 3.6, 3.8]),

  h1('15. Sin Workbench: consultar desde la terminal'),
  p('Si no tienes Workbench a la mano, el contenedor trae el cliente de MySQL. Desde la carpeta del proyecto:'),
  ...ps('docker compose exec mysql mysql -u legrandhotel -p legrandhotel -t -e "SELECT status, COUNT(*) AS cantidad FROM reservations GROUP BY status;"'),
  ...shot('b5-mysql-estados', 'La misma consulta de la sección 11.5, desde la terminal.'),
  p('-p hace que pida la contraseña (no se ve al escribirla), legrandhotel es la base, -t dibuja la tabla con bordes y -e ejecuta la consulta entre comillas. Sin -e entras al modo interactivo (mysql>), del que sales con exit.'),

  h1('16. Resumen rápido'),
  ...ps(
    '# 1. Encender la base (con Docker Desktop abierto)',
    'cd C:\\Proyectos\\LeGrandHotel',
    'docker compose up -d mysql',
    'docker compose ps mysql            # debe decir (healthy)',
    '',
    '# 2. Tablas al día',
    'cd api',
    'php artisan migrate',
    '',
    '# 3. Workbench: + -> Host 127.0.0.1, Port 3306, User legrandhotel,',
    '#    Default Schema legrandhotel, Store Password (DB_PASSWORD de api\\.env)',
    '',
    '# 4. Al terminar',
    'cd ..',
    'docker compose stop mysql',
  ),
]

function section(children) {
  return {
    properties: { page: { margin: { top: Math.round(2.5 * CM), bottom: Math.round(2.5 * CM), left: Math.round(2.5 * CM), right: Math.round(2.5 * CM) }, size: { width: 11906, height: 16838 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) },
    children,
  }
}

const doc = new Document({
  creator: 'Equipo LeGrandHotel',
  title: 'LeGrandHotel – Tutorial de acceso a la base de datos',
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: 'pasos', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    ],
  },
  features: { updateFields: true },
  sections: [section([...caratula, ...body])],
})

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT, `${figure} figuras`) })
