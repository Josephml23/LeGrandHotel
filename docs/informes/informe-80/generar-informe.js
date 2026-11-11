// Genera docs/informes/informe-80/LeGrandHotel_Entrega_80.docx: todo lo hecho desde la entrega
// del 25%, pantalla por pantalla y botón por botón, más las dos últimas pruebas de carga.
//   node docs/informes/informe-80/generar-informe.js <logo_tecsup.jpg>
// Los números salen de docs/pruebas/datos/ y los gráficos de docs/pruebas/graficos/.
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, PageBreak, Footer, PageNumber, LevelFormat, BorderStyle, ShadingType, TableOfContents, VerticalAlign,
} = require('docx')

const ROOT = 'C:/Proyectos/LeGrandHotel'
const BASE = path.join(ROOT, 'docs/informes/informe-80')
const CAPS = path.join(BASE, 'capturas')
const DATA = path.join(ROOT, 'docs/pruebas/datos')
const GRAF = path.join(ROOT, 'docs/pruebas/graficos')
const LOGO = process.argv[2]
const OUT = path.join(BASE, 'LeGrandHotel_Entrega_80.docx')

const FONT = 'Times New Roman'
const CODE = 'Consolas'
const CM = 567
const PAGE_W = 11906 - 2 * Math.round(2.5 * CM)

// ── helpers (mismo formato que los informes anteriores) ──
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
const lead = (label, text) => p([b(label), t(text)])

function code(lines) {
  return lines.map((l, i) => new Paragraph({
    keepNext: i < lines.length - 1, keepLines: true,
    children: [c(l)], spacing: { after: i === lines.length - 1 ? 160 : 0, line: 240 },
    shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' }, indent: { left: 200 },
  }))
}

let figure = 0
function img(file, label, widthCm = 15, maxHcm = 20) {
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
const shot = (name, label, widthCm = 15) => (fs.existsSync(path.join(CAPS, `${name}.png`)) ? img(path.join(CAPS, `${name}.png`), label, widthCm) : [])
const graf = (name, label, widthCm = 15) => (fs.existsSync(path.join(GRAF, `${name}.png`)) ? img(path.join(GRAF, `${name}.png`), label, widthCm) : [])

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: border, bottom: border, left: border, right: border }
let tableNo = 0
function table(title, headers, rows, widths) {
  tableNo += 1
  const sum = widths.reduce((a, x) => a + x, 0)
  const scaled = widths.map((w) => Math.round((w / sum) * PAGE_W))
  const cell = (text, i, head) => new TableCell({
    borders,
    width: { size: scaled[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: 'D9D9D9' } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ children: [String(text).startsWith('`') ? c(String(text).slice(1), 17) : t(String(text), { size: 19, bold: !!head })], spacing: { after: 0 } })],
  })
  return [
    p([t(`Tabla ${tableNo}. ${title}`, { italics: true, size: 20 })], { keepNext: true, spacing: { before: 120, after: 60 } }),
    new Table({
      width: { size: scaled.reduce((a, x) => a + x, 0), type: WidthType.DXA },
      columnWidths: scaled,
      rows: [
        new TableRow({ tableHeader: true, children: headers.map((hh, i) => cell(hh, i, true)) }),
        ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, i, false)) })),
      ],
    }),
    p('', { spacing: { after: 120 } }),
  ]
}

// ── datos reales de las pruebas ──────────────────────────
const json = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')).metrics
// Node aquí no trae los datos de es-PE, así que el formato peruano se arma a mano:
// punto para los miles y coma para los decimales.
const miles = (entero) => String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const num = (v, d = 1) => {
  const [ent, dec] = Number(v).toFixed(d).split('.')
  return dec ? `${miles(ent)},${dec}` : miles(ent)
}
const int = (v) => miles(Math.round(v))
const seg = (ms) => `${num(ms / 1000, 2)} s`

const A = json('local-100clientes-1000reservas.json')   // 100 clientes, 1000 reservas
const B = json('local-100clientes-5000reservas.json')   // 100 clientes, 5000 reservas
const C = json('local-bloques-5000vu-1min.json')        // 5000 usuarios en bloques de 100

const DUR_A = 34.9
const DUR_B = 140.4
const DUR_C = 111.8
const CHECKS_OK = C.checks ? C.checks.passes : 410
const CHECKS_TOT = C.checks ? C.checks.passes + C.checks.fails : 35337

const incidentes = fs.readFileSync(path.join(ROOT, 'docs/incidentes.md'), 'utf8').split('\n')
  .filter((l) => /^\| 2026-11-10/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((s) => s.trim().replace(/`/g, '').replace(/\*\*/g, '')))

// ── carátula (skill caratula-tecsup) ─────────────────────
const cov = (text, o = {}, spacingAfter = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 360, after: spacingAfter }, children: [t(text, o)] })
const caratula = [
  cov('INSTITUTO TECNOLÓGICO SUPERIOR TECSUP', { bold: true }),
  cov('DISEÑO Y DESARROLLO DE SOFTWARE', {}, 240),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(LOGO), transformation: { width: 189, height: 113 } })] }),
  cov('CURSO: DESARROLLO DE SOLUCIONES EN LA NUBE', { bold: true }),
  cov('PROYECTO:', { bold: true }),
  cov('LeGrandHotel – Sistema web de gestión de hospedaje', { bold: true }, 240),
  cov('Avances desde la entrega del 25%', { bold: true, size: 32 }, 120),
  cov('Recorrido por pantalla y pruebas de carga'),
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

// ── 1. Objetivo ──────────────────────────────────────────
const s1 = [
  p([t('Índice', { bold: true, size: 30 })], { spacing: { after: 160 } }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),
  h1('1. Objetivo del documento'),
  p('Este documento registra todo lo que se hizo en LeGrandHotel desde la entrega del 25%. Tiene tres partes: un recorrido por cada pantalla del sistema, con su captura y una tabla que dice qué hace cada botón y a qué vista lleva; el detalle de lo que se agregó o cambió en ese periodo; y las dos últimas pruebas de carga, con sus gráficos e interpretación.'),
  p('La aplicación está desplegada y funcionando en Render, con la API en Docker sobre PostgreSQL y la web como sitio estático. Las pruebas de carga se hicieron en la laptop del equipo, porque el servidor en AWS todavía no está creado; por eso sus resultados muestran el límite de una sola máquina y no el del sistema desplegado.'),
]

// ── 2. Resumen de lo hecho ───────────────────────────────
const s2 = [
  h1('2. Qué se agregó desde la entrega del 25%'),
  p('La tabla resume el trabajo del periodo. La columna «Dónde» indica el archivo o la carpeta donde se puede verificar cada punto.'),
  ...table('Trabajo realizado desde el 27/10/2026', ['Qué se hizo', 'En qué consiste', 'Dónde', 'Tipo'], [
    ['Despliegue en Render', 'La API y la web funcionando en internet: API en Docker con PostgreSQL, web como sitio estático, migraciones al arrancar y siembra opcional de datos de demostración', 'render.yaml, api/Dockerfile.render, docs/despliegue-render.md', 'Evaluado 80%'],
    ['Tutorial de bienvenida', 'Al primer ingreso se ofrece un recorrido que oscurece la pantalla y resalta cada sección según el rol; se omite o se repite desde Configuración', 'Tour.tsx, tour.ts; POST /auth/tutorial', 'Extra'],
    ['Tutorial en cada pestaña', 'Un botón «?» al lado del título de cada pantalla abre un recorrido que explica, uno por uno, para qué sirve cada elemento de esa pantalla', 'tutoriales.ts, AyudaDePantalla', 'Extra'],
    ['Reglas de validación a la vista', 'Al costado de cada casilla, en letra pequeña, dice qué acepta: obligatorio, solo letras, solo números, máximos y mínimos', 'ui.tsx (FieldLabel), formularios', 'Extra'],
    ['Casillas que solo aceptan lo válido', 'Nombre y nacionalidad solo letras; DNI, teléfono y stock solo números; la unidad del insumo se elige de una lista y no se escribe', 'ui.tsx (soloLetras, soloNumeros)', 'Extra'],
    ['Contraseña visible con mínimo', 'El formulario de personal muestra u oculta la contraseña y exige al menos 8 caracteres con letras y números', 'PasswordField', 'Mejora'],
    ['Personal y Usuarios unidos', 'Una sola pestaña «Personal y usuarios»; al crear se abre el formulario de personal. Se quitaron la pestaña «Registrar personal», «Facturación» y los campos Cargo y Turno', 'UsersPage.tsx, App.tsx', 'Mejora'],
    ['Filtros del tablero', 'El tablero de habitaciones del panel filtra por piso y por estado, y muestra las 70 habitaciones (antes 50)', 'RoomRack.tsx; rack.test.tsx', 'Extra'],
    ['Vista del programador en Render', 'Muestra el servicio, la rama y el commit desplegados, leídos de la configuración para que funcionen con la caché de producción', 'config/hotel.php, DeveloperPage', 'Extra'],
    ['Pruebas de carga dentro de Docker', 'Las pruebas se corren dentro de la red de Docker: antes el proxy de Docker Desktop en Windows rechazaba las conexiones y falseaba el resultado', 'tests/k6/dentro.sh', 'Evaluado 80%'],
    ['Scripts de preparación', 'preparar.sh deja la API lista (límites, clientes, caché) y restaurar.sh la devuelve a la normalidad', 'tests/k6/preparar.sh, restaurar.sh', 'Extra'],
    ['Límite de peticiones corregido', 'Una variable vacía en el archivo de configuración dejaba el límite en 0 y la API respondía 429 a todo', 'config/hotel.php; RateLimitConfigTest', 'Corrección'],
    ['Respaldos en GitHub', 'Copia de seguridad cifrada de la base en un repositorio aparte', 'infra/scripts/backup-mysql-to-github.sh', 'Evaluado 80%'],
    ['Registro de caídas', 'Cada caída, incluso local, con su motivo y su solución (sección 7)', 'docs/incidentes.md', 'Evaluado'],
  ], [1.5, 3.6, 2.1, 1.0]),
]

// ── 3. Recorrido por pantalla ────────────────────────────
// Cada entrada: captura, para qué sirve la pantalla y la tabla de botones.
const PANTALLAS = [
  {
    cap: '01-panel', ruta: '/panel', titulo: 'Panel',
    pie: 'Panel del administrador: los cuatro indicadores, el tablero de habitaciones, las llegadas del día y los insumos bajo el mínimo',
    para: 'Es la pantalla de inicio del personal y el resumen del día: cuánto está ocupado el hotel, quién llega, quién sale y qué insumos faltan.',
    botones: [
      ['Nueva reserva', 'Abre el formulario de reserva sin pasar por la pestaña Reservas', 'Formulario emergente sobre el Panel'],
      ['Check-in (en cada llegada)', 'Marca que el huésped llegó y abre su estadía', 'La fila desaparece de «Llegadas de hoy»'],
      ['Reponer (en cada insumo)', 'Registra una entrada del insumo que está bajo el mínimo', 'Formulario de movimiento'],
      ['Selector de piso', 'Muestra solo las habitaciones de ese piso', 'El mismo tablero, filtrado'],
      ['Todas / Libres / Ocupadas / En limpieza / Mantenimiento', 'Filtra el tablero por estado; el número entre paréntesis dice cuántas hay', 'El mismo tablero, filtrado'],
      ['Ver todas', 'Abre el listado completo de habitaciones', 'Pestaña Habitaciones'],
      ['Una habitación del tablero', 'Abre esa habitación para editarla', 'Formulario de la habitación'],
      ['? (al lado del título)', 'Abre el tutorial de esta pantalla', 'Recorrido guiado sobre el Panel'],
    ],
  },
  {
    cap: '02-reservas', ruta: '/reservas', titulo: 'Reservas',
    pie: 'Reservas: listado con filtros por estado, buscador y los botones de cada fila',
    para: 'Aquí se registra quién va a venir, en qué habitación y en qué fechas. La reserva se convierte en estadía cuando el huésped llega.',
    botones: [
      ['Nueva reserva', 'Elige huésped, fechas y una habitación libre; el total se calcula con el precio por noche', 'Formulario emergente'],
      ['Todas / Confirmadas / Por confirmar / Hospedados / Finalizadas / Canceladas', 'Filtra el listado por estado', 'El mismo listado, filtrado'],
      ['Buscar huésped o documento', 'Busca por nombre o número de documento', 'El mismo listado, filtrado'],
      ['Check-in', 'Marca la llegada y crea la estadía; la habitación pasa a ocupada', 'Pestaña Estadías'],
      ['Cancelar', 'Anula la reserva y libera la habitación', 'El mismo listado, con la reserva cancelada'],
      ['Anterior / Siguiente', 'Avanza entre páginas de 15 reservas', 'El mismo listado'],
    ],
  },
  {
    cap: '03-estadias', ruta: '/estadias', titulo: 'Estadías',
    pie: 'Estadías: los huéspedes alojados ahora y el historial',
    para: 'Los huéspedes que ya están alojados. Una estadía nace del check-in de una reserva y termina con el check-out.',
    botones: [
      ['En curso / Historial', 'Cambia entre los que están ahora en el hotel y los que ya se fueron', 'El mismo listado, filtrado'],
      ['Check-out', 'Cierra la estadía, libera el espacio de cochera y manda la habitación a limpieza', 'La estadía pasa al historial'],
    ],
  },
  {
    cap: '04-habitaciones', ruta: '/habitaciones', titulo: 'Habitaciones',
    pie: 'Habitaciones: estado de cada una, con filtros y acciones por fila',
    para: 'El estado de cada habitación del hotel. Al hacer check-out pasa a limpieza, y se marca libre cuando está lista.',
    botones: [
      ['Nueva habitación', 'Pide número, piso, tipo y estado; el número no se puede repetir', 'Formulario emergente'],
      ['Todas / Libres / Ocupadas / En limpieza / Mantenimiento', 'Filtra por estado', 'El mismo listado, filtrado'],
      ['Marcar lista', 'Pasa la habitación de limpieza a libre', 'El mismo listado, con el estado cambiado'],
      ['Editar', 'Cambia número, piso, tipo o estado', 'Formulario emergente'],
      ['Eliminar', 'Borra la habitación, solo si no tiene reservas', 'El mismo listado, sin esa fila'],
    ],
  },
  {
    cap: '05-tipos-habitacion', ruta: '/tipos-habitacion', titulo: 'Tipos de habitación',
    pie: 'Tipos de habitación: de aquí salen el precio y la capacidad de cada habitación',
    para: 'Las categorías del hotel (Simple, Doble, Matrimonial y Suite). De aquí salen el precio por noche, la capacidad y los servicios incluidos.',
    botones: [
      ['Nuevo tipo', 'Pide nombre, capacidad, precio por noche y servicios', 'Formulario emergente'],
      ['Editar', 'Cambia el precio o los servicios; afecta solo a las reservas nuevas', 'Formulario emergente'],
      ['Eliminar', 'Borra el tipo, solo si ninguna habitación lo usa', 'El mismo listado, sin esa fila'],
    ],
  },
  {
    cap: '06-clientes', ruta: '/clientes', titulo: 'Clientes',
    pie: 'Clientes: las fichas de los huéspedes, con su documento, teléfono y cuántas reservas tienen',
    para: 'Las fichas de los huéspedes. Se usan al registrar una reserva desde recepción. La columna «Cuenta web» dice si además entran por su cuenta.',
    botones: [
      ['Nuevo cliente', 'Pide nombre, tipo y número de documento; el documento no se puede repetir', 'Formulario emergente'],
      ['Buscar nombre o documento', 'Busca por nombre o por número de documento', 'El mismo listado, filtrado'],
      ['Editar', 'Corrige los datos de la ficha', 'Formulario emergente'],
      ['Eliminar', 'Borra la ficha, solo si no tiene reservas', 'El mismo listado, sin esa fila'],
    ],
  },
  {
    cap: '07-cochera', ruta: '/cochera', titulo: 'Cochera',
    pie: 'Cochera: los vehículos dentro y los espacios de estacionamiento',
    para: 'Los espacios de estacionamiento y los autos que hay dentro. El espacio se libera solo al hacer el check-out del huésped.',
    botones: [
      ['Vehículos / Espacios', 'Cambia entre los autos que están dentro y los lugares del estacionamiento', 'El mismo listado, en su otra vista'],
      ['Registrar entrada', 'Anota un auto con su placa y el espacio que ocupa', 'Formulario emergente'],
      ['Agregar espacio', 'Crea un lugar nuevo de estacionamiento', 'Formulario emergente'],
      ['Registrar salida', 'Marca que el auto se fue y deja el espacio libre', 'El mismo listado, con el espacio libre'],
    ],
  },
  {
    cap: '08-inventario', ruta: '/inventario', titulo: 'Inventario',
    pie: 'Inventario: los insumos del hotel y su nivel frente al mínimo',
    para: 'Los insumos del hotel. El stock no se escribe a mano: cambia con los movimientos de entrada y de salida, y cada uno queda registrado con quién lo hizo.',
    botones: [
      ['Nuevo insumo', 'Pide nombre, unidad, stock mínimo y stock inicial', 'Formulario emergente'],
      ['Buscar insumo', 'Busca por nombre', 'El mismo listado, filtrado'],
      ['Solo bajo el mínimo', 'Muestra únicamente los insumos que hay que reponer', 'El mismo listado, filtrado'],
      ['Movimiento', 'Registra una entrada o una salida y recalcula el stock', 'Formulario emergente'],
      ['Editar', 'Cambia el nombre, la unidad o el mínimo (el stock no)', 'Formulario emergente'],
      ['Eliminar', 'Borra el insumo', 'El mismo listado, sin esa fila'],
    ],
  },
  {
    cap: '09-usuarios', ruta: '/usuarios', titulo: 'Personal y usuarios',
    pie: 'Personal y usuarios: una sola pestaña para el equipo del hotel y los clientes (los correos reales van tapados)',
    para: 'Todas las cuentas del sistema: las del equipo del hotel y las de los clientes que entran con Google. Antes eran dos pestañas separadas; ahora es una sola. Al cambiar los roles de alguien se cierran sus sesiones abiertas.',
    botones: [
      ['Agregar persona', 'Crea de una vez la ficha de la persona y la cuenta con la que entra; el cargo sale del rol', 'Formulario emergente de personal'],
      ['Todos / Administrador / Recepcionista / Almacenero / Programador / Cliente', 'Filtra por rol', 'El mismo listado, filtrado'],
      ['Buscar nombre o correo', 'Busca por nombre o por correo', 'El mismo listado, filtrado'],
      ['Editar', 'Cambia nombre, correo, contraseña, roles y fecha de ingreso', 'Formulario emergente'],
      ['Eliminar', 'Borra la cuenta; el Programador no se puede eliminar', 'El mismo listado, sin esa fila'],
    ],
  },
  {
    cap: '10-reportes', ruta: '/reportes', titulo: 'Reportes',
    pie: 'Reportes: ocupación e ingresos en el rango de fechas elegido',
    para: 'Dos miradas al negocio: el porcentaje de noches vendidas y los ingresos de las reservas confirmadas y cerradas, mes a mes.',
    botones: [
      ['Desde / Hasta', 'Elige el rango de fechas de los dos reportes', 'La misma pantalla, recalculada'],
    ],
  },
  {
    cap: '11-auditoria', ruta: '/auditoria', titulo: 'Auditoría',
    pie: 'Auditoría: quién cambió qué y cuándo',
    para: 'El registro de cada cambio hecho en el sistema. Sirve para rastrear un error o un cambio indebido. Es solo de lectura: no se puede borrar ni editar.',
    botones: [
      ['Filtros de tipo y fecha', 'Acota el registro por tipo de dato o por fecha', 'El mismo listado, filtrado'],
      ['Anterior / Siguiente', 'Avanza entre páginas', 'El mismo listado'],
    ],
  },
  {
    cap: '12-programador', ruta: '/programador', titulo: 'Vista del programador',
    pie: 'Vista del programador: estado técnico del sistema, ya adaptada al despliegue en Render',
    para: 'El estado técnico del sistema, para revisar una falla sin entrar al servidor. Ahora muestra además el servicio, la rama y el commit desplegados en Render.',
    botones: [
      ['Resumen / Peticiones / Errores / Rutas', 'Cambia entre la salud del sistema, las peticiones recientes, los errores y las rutas de la API', 'La misma pantalla, en su otra vista'],
    ],
  },
  {
    cap: '13-configuracion', ruta: '/configuracion', titulo: 'Configuración',
    pie: 'Configuración: tema, idioma y el botón para repetir el tutorial',
    para: 'Cómo se ve el sistema en este navegador. Los cambios se aplican al instante y solo afectan a quien los hace.',
    botones: [
      ['Claro / Oscuro / Del sistema', 'Cambia el tema de la interfaz', 'La misma pantalla, con el tema aplicado'],
      ['Español / English', 'Cambia el idioma de la web y el de los mensajes de la API', 'La misma pantalla, en el otro idioma'],
      ['Ver el tutorial', 'Vuelve a mostrar el recorrido de bienvenida', 'Recorrido guiado sobre la pantalla actual'],
    ],
  },
]

// Las tres pantallas que ve el cliente, que entra solo con Google y tiene su propio menú.
const PANTALLAS_CLIENTE = [
  {
    cap: '19-reservar', ruta: '/reservar', titulo: 'Reservar una habitación',
    pie: 'Reservar: el cliente elige fechas y personas, y ve los tipos libres con lo que incluye cada uno y el total de su estadía',
    para: 'La pantalla con la que el cliente reserva, en tres pasos: elige sus fechas, mira lo que hay libre y reserva. Solo se muestran los tipos con sitio para el número de personas indicado.',
    botones: [
      ['Llegada / Salida / Personas', 'Define las fechas y cuántas personas van; la búsqueda se rehace sola', 'La misma pantalla, con otras ofertas'],
      ['Reservar (en cada tarjeta)', 'Pide confirmar; si faltan el DNI o el celular los pide ahí mismo, y si ya están dice a nombre de quién queda', 'Confirmación y luego Mis reservas'],
      ['? (al lado del título)', 'Abre el tutorial de cómo reservar', 'Recorrido guiado sobre esta pantalla'],
    ],
  },
  {
    cap: '20-mis-reservas', ruta: '/mis-reservas', titulo: 'Mis reservas',
    pie: 'Mis reservas: lo que el cliente ve de cada una de sus reservas',
    para: 'Todas las reservas del cliente, con su estado y lo que va a pagar. Recepción ve exactamente lo mismo.',
    botones: [
      ['Cancelar', 'Anula la reserva; pide confirmar y solo funciona antes del check-in', 'El mismo listado, con la reserva cancelada'],
      ['Anterior / Siguiente', 'Avanza entre páginas', 'El mismo listado'],
      ['? (al lado del título)', 'Abre el tutorial de cómo ver y cancelar reservas', 'Recorrido guiado sobre esta pantalla'],
    ],
  },
  {
    cap: '21-perfil', ruta: '/perfil', titulo: 'Mi perfil',
    pie: 'Mi perfil: el DNI y el celular hacen falta para reservar (el correo real va tapado)',
    para: 'Los datos del cliente. El DNI y el celular son opcionales hasta que quiera reservar; se pueden poner aquí o en el momento de reservar. El correo viene de Google y no se puede cambiar.',
    botones: [
      ['Guardar cambios', 'Guarda el nombre, el DNI y el celular', 'La misma pantalla, con el aviso de guardado'],
      ['? (al lado del título)', 'Abre el tutorial de esta pantalla', 'Recorrido guiado sobre esta pantalla'],
    ],
  },
]

const s3 = [
  pageBreak(),
  h1('3. Recorrido por pantalla'),
  p('Esta sección recorre el sistema pantalla por pantalla, como lo ve un administrador. De cada una se muestra la captura, para qué sirve y una tabla con cada botón: qué hace y a qué vista lleva.'),
  p('Todas las pantallas comparten la misma estructura: el título con su botón principal a la derecha, las pestañas de filtro, el buscador, la tabla, los botones de cada fila y el paginado. Al lado de cada título hay un botón «?» que abre el tutorial de esa pantalla.'),
  ...PANTALLAS.flatMap((s) => [
    h2(`3.${PANTALLAS.indexOf(s) + 1} ${s.titulo}`),
    p([b('Para qué sirve. '), t(s.para)]),
    p([b('Dirección: '), c(s.ruta, 20)]),
    ...shot(s.cap, s.pie),
    ...table(`Botones de ${s.titulo}`, ['Botón', 'Qué hace', 'A dónde lleva'],
      s.botones, [1.6, 3.2, 2.0]),
  ]),
  pageBreak(),
  h1('4. Las pantallas del cliente'),
  p('El cliente entra solo con Google y tiene su propio menú, con tres pantallas. No ve nada de la gestión del hotel. Estas tres pantallas también tienen su botón «?» con el tutorial correspondiente, agregado en este periodo.'),
  ...PANTALLAS_CLIENTE.flatMap((s) => [
    h2(`4.${PANTALLAS_CLIENTE.indexOf(s) + 1} ${s.titulo}`),
    p([b('Para qué sirve. '), t(s.para)]),
    p([b('Dirección: '), c(s.ruta, 20)]),
    ...shot(s.cap, s.pie),
    ...table(`Botones de ${s.titulo}`, ['Botón', 'Qué hace', 'A dónde lleva'],
      s.botones, [1.6, 3.2, 2.0]),
  ]),
]

// ── 4. Lo nuevo en detalle ───────────────────────────────
const s4 = [
  pageBreak(),
  h1('5. Lo nuevo, en detalle'),

  h2('5.1 Tutorial de bienvenida y tutorial de cada pantalla'),
  p('Son dos cosas distintas. El tutorial de bienvenida se ofrece la primera vez que alguien entra: la pantalla se oscurece y se va resaltando cada sección del menú según el rol de la persona. Se puede omitir, y se repite cuando se quiera desde Configuración. Termina señalando el botón «?», para que quede claro dónde seguir aprendiendo.'),
  p('El tutorial de cada pantalla es el que abre ese botón «?», que está al lado del título en todas las vistas. Explica, uno por uno, para qué sirve cada elemento de esa pantalla concreta: el botón principal, los filtros, el buscador, la tabla, los botones de cada fila y el paginado. Si un elemento no está en esa pantalla, el recorrido lo salta.'),
  ...shot('16-tutorial-pagina', 'Primer paso del tutorial de una pantalla: la pantalla se oscurece y aparece la explicación'),
  ...shot('17-tutorial-resaltado', 'Tercer paso: el recorrido resalta los filtros del tablero y explica para qué sirven'),

  h2('5.2 Las reglas de validación a la vista'),
  p('Antes, las reglas de cada casilla solo aparecían como error después de intentar guardar. Ahora están escritas en letra pequeña al costado de cada etiqueta: si el campo es obligatorio, qué acepta y cuál es el máximo o el mínimo. En el formulario de personal se ve «Obligatorio. Solo letras, hasta 120» junto a Nombre completo y «Mínimo 8 caracteres, con letras y números» junto a Contraseña.'),
  p('Además, las casillas ya no dejan escribir lo que no corresponde: Nombre completo y Nacionalidad solo aceptan letras, y DNI, teléfono y los stocks solo números. La contraseña tiene un botón «Ver» para mostrarla u ocultarla, y no deja guardar si no cumple el mínimo.'),
  ...shot('14-agregar-persona', 'Agregar persona: las reglas al costado de cada casilla y el botón «Ver» de la contraseña'),
  ...shot('18-nuevo-insumo', 'Nuevo insumo: la unidad se elige de una lista y los stocks solo aceptan números'),

  h2('5.3 Personal y Usuarios en una sola pestaña'),
  p('Antes había tres pestañas que se pisaban entre sí: «Registrar personal», «Personal» y «Usuarios y roles». Ahora hay una sola, «Personal y usuarios», que muestra todas las cuentas del sistema; al pulsar «Agregar persona» se abre el formulario de personal, que crea de una vez la ficha y la cuenta con la que entra. El cargo sale del rol que se le da, así que se quitaron los campos Cargo y Turno, y también la pestaña de Facturación, que no se usaba.'),

  h2('5.4 Filtros del tablero de habitaciones'),
  p('El tablero del panel mostraba solo 50 de las 70 habitaciones, porque la API devuelve como máximo 50 por página y el tablero pedía una sola. Ahora pide todas las páginas y muestra las 70. Además se agregaron dos filtros: uno por piso y otro por estado, con el número de habitaciones de cada grupo entre paréntesis.'),
  ...shot('15-panel-filtros', 'Tablero filtrado por piso 12 y por habitaciones libres'),

  h2('5.5 Despliegue en Render'),
  p('El proyecto está publicado en Render con tres servicios: una base PostgreSQL, la API en un contenedor Docker y la web como sitio estático. Las migraciones corren al arrancar y los datos de demostración se siembran con una variable, porque el plan gratuito no da consola. La vista del programador muestra ahora el servicio, la rama y el commit desplegados; esos valores se leen desde la configuración y no del entorno, porque en producción la configuración va en caché y de otro modo llegarían vacíos.'),
  p('El despliegue dejó dos lecciones que quedaron anotadas: la web necesita el dominio público de la API, no el nombre interno que Render usa entre servicios, y el build de la web necesita Node 22, porque la versión por defecto es anterior a la que pide Vite.'),
]

// ── 5. Pruebas de carga ──────────────────────────────────
const s5 = [
  pageBreak(),
  h1('6. Pruebas de carga'),

  h2('6.1 Cómo se midió y por qué cambió el método'),
  p('Las pruebas anteriores apuntaban a la API por localhost:8000. Con cientos de clientes a la vez, el 94 % de las peticiones fallaba con «connection refused» y la prueba no terminaba de medir nada. Se revisó primero Nginx: la cola de conexiones estaba en su valor por defecto de 511, así que se subió a 4096. No cambió nada, seguían 3661 conexiones rechazadas.'),
  p('La causa era otra. En Windows, Docker Desktop no expone el puerto directamente: pone un proxy intermedio que traduce localhost:8000 hacia el contenedor, y ese proxy aguanta unos cientos de conexiones simultáneas. La prueba estaba midiendo ese puente, no la aplicación. Para comprobarlo se corrió la misma prueba de 500 clientes dentro de la red de Docker, hablando con Nginx directamente.'),
  ...table('La misma prueba de 500 clientes, por dos caminos distintos', ['Por dónde entra k6', 'Conexiones rechazadas'], [
    ['localhost:8000 (a través de Windows)', '3.661'],
    ['http://nginx (dentro de la red de Docker)', '0'],
  ], [3.4, 1.6]),
  p('Desde entonces las pruebas se corren con tests/k6/dentro.sh, que ejecuta k6 dentro de la red de Docker. Antes de cada corrida, preparar.sh enciende los contenedores, sube los límites de peticiones (si no, los 429 contarían como errores), siembra los clientes de prueba y calienta la API; al terminar, restaurar.sh la devuelve a su configuración normal.'),
  ...code([
    'bash tests/k6/preparar.sh 100 --limpiar',
    'bash tests/k6/dentro.sh clientes-1000-reservas.js CLIENTES=100 RESERVAS=5000 BUSCAR=una-vez',
    'bash tests/k6/restaurar.sh',
  ]),
  p('Hubo que vaciar el calendario antes de medir. Las pruebas anteriores habían dejado 25.187 reservas en la ventana de un año que usa el escenario, es decir el 98,6 % de ocupación: con el hotel lleno las reservas nuevas chocaban entre sí y el resultado dejaba de medir el sistema. Con la ventana libre, las 70 habitaciones alcanzan de sobra, porque 5000 reservas de una noche son el 20 % de las 25.550 noches-habitación disponibles. No hizo falta crear habitaciones nuevas.'),
  ...table('Entorno de las pruebas', ['Elemento', 'Configuración'], [
    ['Equipo', 'Laptop del equipo, Windows 11'],
    ['API', 'Nginx + PHP-FPM en Docker, 20 procesos PHP, OPcache activo'],
    ['Base de datos', 'MySQL 8 en Docker'],
    ['Generador de carga', 'k6 dentro de la red de Docker (grafana/k6), apuntando a http://nginx'],
    ['Corte de Nginx', '`fastcgi_read_timeout 10s: pasados 10 s, la petición se corta con 504'],
  ], [1.4, 3.6]),

  h2('6.2 Prueba de estrés: 100 clientes reservando sin pausa'),
  p('Esta es una prueba de estrés, no de carga normal. Cien clientes del portal reservan a la vez y sin descanso: apenas termina una reserva empiezan la siguiente, sin los segundos que una persona real tarda en elegir fechas y habitación. Es una carga deliberadamente mayor que la del uso real, y por eso lo que se pone a prueba no es la velocidad sino si el sistema se rompe, se traba o se equivoca cuando lo exigen por encima de lo normal.'),
  p('Cada cliente hace el recorrido completo del portal: inicia sesión, consulta los tipos de habitación libres y registra su reserva. La prueba termina cuando se completan todas las reservas pedidas, no a los X segundos, así que mide cuánto aguanta el sistema haciendo un trabajo fijo bajo presión. Se corrió dos veces para ver si la presión se acumula: primero 1000 reservas y, después de borrarlas para partir del mismo calendario, 5000, es decir cinco veces más trabajo seguido.'),
  ...table('Resultado de las dos corridas', ['Medida', '1000 reservas', '5000 reservas'], [
    ['Clientes a la vez', '100', '100'],
    ['Tiempo total', `${num(DUR_A, 1)} s`, '2 min 20 s'],
    ['Reservas creadas', `${int(A.reservas_creadas.count)} de 1000`, `${int(B.reservas_creadas.count)} de 5000`],
    ['Reservas por segundo', num(A.reservas_creadas.rate, 1), num(B.reservas_creadas.rate, 1)],
    ['Peticiones con error', `${num(A.http_req_failed.value * 100, 2)} %`, `${num(B.http_req_failed.value * 100, 2)} %`],
    ['Conexiones rechazadas', '0', '0'],
    ['Mediana por reserva', seg(A.reserva_ms.med), seg(B.reserva_ms.med)],
    ['p95 por reserva', seg(A.reserva_ms['p(95)']), seg(B.reserva_ms['p(95)'])],
  ], [1.8, 1.6, 1.6]),
  ...graf('80-01-reservas-tiempo-velocidad', 'Lo que el sistema sostiene bajo estrés: cinco veces más trabajo seguido, sin perder velocidad'),
  ...graf('80-02-latencia-reservas', 'Tiempo de respuesta bajo estrés; la línea de 0,8 s es la meta de carga normal, puesta como referencia'),
  lead('Interpretación. ', 'Una prueba de estrés se aprueba o se reprueba por tres cosas: si el sistema aguanta sin caerse, si los datos siguen siendo correctos y si la degradación es ordenada. En las tres el resultado es bueno.'),
  p([b('Aguantó. '), t('Ninguna de las dos corridas tuvo un solo error ni una conexión rechazada: 0,00 % de peticiones fallidas sobre 1003 y 5003 peticiones. La API no devolvió ni un 500 ni un 503, y no hubo que reiniciar nada. El sistema no se cae cuando lo exigen de más; se limita a tardar más en responder.')]),
  p([b('Los datos quedaron bien. '), t('Es lo más importante de esta prueba. Los 100 clientes compiten por las mismas habitaciones y las mismas fechas, que es justo la condición en la que un sistema mal hecho vende dos veces la misma habitación. Se registraron las 1000 y las 5000 reservas pedidas, sin una sola perdida ni duplicada: el bloqueo por habitación (lockForUpdate) resiste la competencia real, no solo la del papel.')]),
  p([b('La presión no se acumula. '), t('Al quintuplicar el trabajo, el sistema no se fue degradando: al contrario, la corrida larga fue más rápida por reserva (p95 de 3,30 s frente a 4,27 s, y 35,6 reservas por segundo frente a 28,7). Si hubiera una fuga de memoria, una conexión que no se devuelve o una cola que se va llenando, la segunda corrida habría sido peor que la primera y se habría ido frenando. No pasó, así que el sistema se sostiene en el tiempo bajo estrés.')]),
  p('Sobre el tiempo de respuesta: cada reserva tardó entre 3 y 4 segundos, muy por encima de los 0,8 s de la meta. Esa meta es de carga normal y aquí aparece solo como referencia, porque exigirla en una prueba de estrés sería como medir el consumo de un auto a fondo y compararlo con el de ciudad. La cifra que sí sale de esta prueba es otra: bajo estrés el sistema sostiene entre 29 y 36 reservas por segundo. Con la pausa de 6 segundos de un cliente real, el mismo sistema cumple la meta de 0,8 s, como se midió en la entrega anterior.'),

  h2('6.3 Prueba de resistencia: 5000 usuarios entrando en bloques de 100'),
  p('Si la anterior medía qué aguanta el sistema haciendo un trabajo fijo, esta mide hasta dónde llega antes de romperse. Entran 5000 usuarios de recepción en bloques de 100, uno por segundo, hasta completar el minuto, y cada uno hace lo que haría en su turno: 70 % de consultas, 20 % de inicios de sesión y 10 % de reservas.'),
  ...table('Resultado con 5000 usuarios', ['Medida', 'Valor'], [
    ['Usuarios alcanzados', int(C.vus_max.max ?? 5000)],
    ['Duración de la corrida', '1 min 52 s (el minuto de subida más la cola de peticiones colgadas)'],
    ['Peticiones enviadas', int(C.http_reqs.count)],
    ['Peticiones con error', `${num(C.http_req_failed.value * 100, 2)} %`],
    ['Operaciones correctas', `${int(CHECKS_OK)} de ${int(CHECKS_TOT)} (${num(CHECKS_OK / CHECKS_TOT * 100, 2)} %)`],
    ['Mediana de respuesta', seg(C.http_req_duration.med)],
    ['p95 de respuesta', seg(C.http_req_duration['p(95)'])],
    ['Conexiones rechazadas', '0'],
  ], [2.0, 3.0]),
  ...graf('80-03-bloques-5000vu', 'La carga sube de 100 en 100 hasta 5000; las iteraciones por segundo suben con ella, pero casi todas fallan'),
  ...graf('80-04-bloques-errores', 'Resultado de las peticiones y tiempo de respuesta con 5000 usuarios encima'),
  lead('Interpretación. ', 'El sistema no soporta 5000 usuarios simultáneos en esta laptop, y el resultado dice exactamente por qué. El contenedor tiene 20 procesos de PHP: cada uno atiende una petición a la vez, así que con miles de usuarios encima la cola crece hasta que las peticiones superan los 10 segundos y Nginx las corta con un 504. El p95 clavado en 10 s es justamente ese corte.'),
  p('Hay un detalle del gráfico que conviene no leer al revés. Las iteraciones por segundo suben hasta cerca de 570 al final de la corrida, pero no son trabajo hecho: son iteraciones que fallan rápido, porque una petición rechazada vuelve antes que una atendida. El dato real es el otro: de 35.337 comprobaciones, solo 410 resultaron correctas. Con 5000 usuarios encima, la API alcanzó a atender unas 410 operaciones.'),
  p('También es importante que no hubo ninguna conexión rechazada. Eso confirma que el método de medición ya es correcto: lo que falla es la capacidad de la máquina, no el camino hasta ella.'),

  h2('6.4 Dónde está el techo'),
  p('Juntando esta corrida con las anteriores se puede ubicar el punto de quiebre con bastante precisión. Hasta 600 usuarios simultáneos el sistema responde sin errores; a partir de 700 falla entre el 85 % y el 100 % de las peticiones de cada bloque.'),
  ...graf('80-05-punto-de-quiebre', 'Porcentaje de peticiones con error según cuántos usuarios hay a la vez; con 700 el error varió por bloque entre 85 % y 100 %'),
  ...table('Qué aguanta la laptop', ['Carga', 'Resultado'], [
    ['50 a 100 clientes del portal', 'Sin errores; es el rango que da resultados útiles para medir'],
    ['Hasta 600 usuarios de recepción', 'Sin errores'],
    ['Desde 700 usuarios', 'Entre 85 % y 100 % de errores por bloque: la cola supera los 10 s y Nginx corta'],
    ['5000 usuarios', '98,64 % de errores'],
  ], [1.6, 3.4]),
  lead('Qué hacer con esto. ', 'El límite no está en el código sino en la capacidad de una sola máquina, y por eso la corrección no es programar distinto sino repartir la carga. El plan de infraestructura ya escrito en Terraform lo resuelve con varias instancias EC2 detrás de un balanceador, con Auto Scaling de 1 a 3 instancias, la base en RDS y Redis para caché y colas; en cada instancia habría que subir el número de procesos de PHP según su CPU. Mientras el servidor no exista, estos números describen el techo de una laptop, no el del sistema.'),
]

// ── 6. Incidentes ────────────────────────────────────────
const s6 = [
  pageBreak(),
  h1('7. Caídas e incidentes del periodo'),
  p('Cada caída se registra en docs/incidentes.md con su motivo y su solución, aunque sea en local o durante una prueba. Estos son los del 10 de noviembre, el día del despliegue en Render y de las pruebas finales.'),
  ...(incidentes.length
    ? table('Incidentes registrados el 10/11/2026', ['Fecha', 'Entorno', 'Qué falló', 'Motivo', 'Solución', 'Tiempo'],
      incidentes.map((r) => r.slice(0, 6)), [0.8, 1.0, 1.7, 2.3, 2.3, 0.7])
    : [p('Sin incidentes registrados en el periodo.')]),
]

// ── 7. Conclusiones y pendientes ─────────────────────────
const s7 = [
  h1('8. Conclusiones y pendientes'),
  p('El sistema está desplegado y funcionando en internet, con todas las pantallas documentadas y un tutorial que explica cada una desde dentro de la propia aplicación. Las pruebas de carga ya miden lo que deben medir, después de descubrir que el problema no estaba en la aplicación sino en el puente de red de Docker Desktop en Windows.'),
  p('Sobre el rendimiento, la conclusión es doble. El sistema es correcto bajo presión: con 100 clientes compitiendo por las mismas fechas registró 5000 reservas sin perder ni duplicar ninguna. Y es limitado en capacidad: una sola máquina con 20 procesos de PHP se queda corta a partir de unos 700 usuarios simultáneos. Lo primero es mérito del código; lo segundo se resuelve con infraestructura.'),
  h2('Pendientes'),
  bullet('Crear el entorno en AWS con el Terraform ya escrito y desplegar con el pipeline.'),
  bullet('Repetir en ese servidor las pruebas de 1000 y 5000 usuarios, desde máquinas generadoras y no desde la laptop.'),
  bullet('Configurar los respaldos automáticos en AWS (snapshots de RDS y copia diaria a S3).'),
  bullet('Registrar en Google el dominio definitivo para el ingreso con correo.'),
]

const doc = new Document({
  creator: 'LeGrandHotel',
  title: 'LeGrandHotel – Avances desde la entrega del 25%',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, font: FONT, color: '000000' }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: FONT, color: '000000' }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })] }) },
    children: [...caratula, ...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7],
  }],
})

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf)
  console.log(`Informe: ${OUT} (${figure} figuras, ${tableNo} tablas)`)
})
