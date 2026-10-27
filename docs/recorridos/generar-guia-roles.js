// Genera docs/recorridos/LeGrandHotel_Recorridos_por_rol.docx: qué puede hacer cada rol en cada pestaña,
// con el resultado de la prueba de recorridos (docs/recorridos/resultados.json) y sus capturas.
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, PageBreak, Footer, PageNumber, LevelFormat, BorderStyle, ShadingType, TableOfContents, VerticalAlign,
} = require('docx')

const ROOT = 'C:/Proyectos/LeGrandHotel'
const LOGO = process.argv[2]
const OUT = path.join(ROOT, 'docs/recorridos/LeGrandHotel_Recorridos_por_rol.docx')
const SHOTS = path.join(ROOT, 'docs/recorridos/capturas')
const results = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/recorridos/resultados.json'), 'utf8'))

const FONT = 'Times New Roman'
const CM = 567
const PAGE_W = 11906 - 2 * Math.round(2.5 * CM)

// ── helpers ─────────────────────────────────────────────
const t = (text, o = {}) => new TextRun({ text, font: FONT, size: 24, ...o })
const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [t(children)], spacing: { after: 120, line: 300 }, ...o })
const center = (children, o = {}) => p(children, { alignment: AlignmentType.CENTER, ...o })
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 240, after: 160 } })
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 200, after: 120 } })
const bullet = (children) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: Array.isArray(children) ? children : [t(children)], spacing: { after: 60, line: 288 } })
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })
const caption = (text) => center([t(text, { italics: true, size: 20 })], { spacing: { after: 200 } })
const gap = () => p('', { spacing: { after: 80 } })

let figure = 0
function shot(name, label, widthCm = 15) {
  const data = fs.readFileSync(path.join(SHOTS, `${name}.png`))
  const w = data.readUInt32BE(16)
  const h = data.readUInt32BE(20)
  const pxW = Math.round(widthCm * 37.8)
  figure += 1
  return [
    center([new ImageRun({ type: 'png', data, transformation: { width: pxW, height: Math.round(pxW * h / w) } })], { spacing: { after: 60 }, keepNext: true }),
    caption(`Figura ${figure}. ${label}`),
  ]
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
    children: [new Paragraph({ alignment: text === '✓' || text === '—' ? AlignmentType.CENTER : AlignmentType.LEFT, children: [t(String(text), { size: 20, bold: !!head })], spacing: { after: 0 } })],
  })
  return new Table({
    width: { size: scaled.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: scaled,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((hh, i) => cell(hh, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
    ],
  })
}

// ── carátula (modelo de la skill caratula-tecsup) ─────────
const cov = (text, o = {}, spacingAfter = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 360, after: spacingAfter }, children: [t(text, o)] })
const caratula = [
  cov('INSTITUTO TECNOLÓGICO SUPERIOR TECSUP', { bold: true }),
  cov('DISEÑO Y DESARROLLO DE SOFTWARE', {}, 240),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(LOGO), transformation: { width: 189, height: 113 } })] }),
  cov('CURSO: DESARROLLO DE SOLUCIONES EN LA NUBE', { bold: true }),
  cov('PROYECTO:', { bold: true }),
  cov('LeGrandHotel – Sistema web de gestión de hospedaje', { bold: true }, 240),
  cov('RECORRIDOS POR ROL Y PRUEBA DE LA PÁGINA', { bold: true }),
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

// ── datos ─────────────────────────────────────────────────
const ok = results.filter((r) => r.ok).length
const byRole = (role) => results.filter((r) => r.role === role)
const stepsTable = (role) => table(
  ['Paso', 'Acción probada', 'Resultado en pantalla', 'Estado'],
  byRole(role).map((r) => [r.id, r.action, r.detail, r.ok ? 'Pasa' : 'Falla']),
  [0.9, 4.2, 5.2, 1.3],
)

const ROLES = ['Administrador', 'Recepcionista', 'Almacenero', 'Programador', 'Cliente']
const Y = '✓'
const N = '—'
// Pestaña: [Admin, Recepción, Almacén, Programador, Cliente]
const MATRIX = [
  ['Panel', Y, Y, Y, N, N],
  ['Reservas', Y, Y, N, N, N],
  ['Estadías', Y, Y, N, N, N],
  ['Habitaciones', Y, Y, N, N, N],
  ['Tipos de habitación', 'edita', 'solo ver', N, N, N],
  ['Clientes', Y, Y, N, N, N],
  ['Cochera', Y, Y, N, N, N],
  ['Inventario', Y, N, Y, N, N],
  ['Personal', Y, N, N, N, N],
  ['Registrar personal', '4 roles', N, N, '3 roles', N],
  ['Usuarios y roles', Y, N, N, N, N],
  ['Reportes', Y, N, N, N, N],
  ['Auditoría', Y, N, N, N, N],
  ['Facturación (en construcción)', Y, N, N, N, N],
  ['Vista del programador', Y, N, N, Y, N],
  ['Completar registro (DNI y teléfono)', N, N, N, N, Y],
  ['Reservar', N, N, N, N, Y],
  ['Mis reservas', N, N, N, N, Y],
]

// ── contenido ─────────────────────────────────────────────
const body = [
  p([t('Índice', { bold: true, size: 30 })], { spacing: { after: 160 } }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),

  h1('1. Qué se hizo'),
  p('Se recorrió la página completa con cada uno de los cinco roles, pestaña por pestaña, haciendo las tareas reales de cada uno: registrar un huésped, reservar, hacer check-in y check-out, mover inventario, crear tipos y habitaciones, registrar personal, cambiar roles, revisar el diagnóstico y reservar como cliente. También se comprobó que cada rol no pueda entrar a lo que no le corresponde.'),
  p('La prueba la hizo un navegador automático (Playwright) sobre la página y la API corriendo en el equipo local. En cada paso escribe en los formularios, pulsa los botones, lee el mensaje que muestra la página y toma una captura. La entrada con Google del cliente se simuló con una sesión de prueba, porque Google no deja automatizar su inicio de sesión; todo lo que sigue después (completar datos, reservar, cancelar) se hizo igual que un cliente real.'),
  table(['Dato', 'Valor'], [
    ['Roles recorridos', 'Administrador, Recepcionista, Almacenero, Programador y Cliente'],
    ['Pasos probados', `${results.length}`],
    ['Resultado', `${ok} de ${results.length} pasos pasan`],
    ['Herramienta', 'Playwright (navegador Chromium) contra la API local y la web en http://localhost:5173'],
    ['Datos de prueba', 'Se crearon con la marca «E2E» y se borraron al terminar; la base quedó solo con los datos de demostración'],
  ], [3, 8]),
  gap(),
  p('Antes de la corrida final se encontraron tres incoherencias y se corrigieron (sección 8). La prueba se repitió completa después de corregirlas.'),

  h1('2. Qué puede hacer cada rol (resumen)'),
  p('Cada rol ve en el menú solo sus pestañas. Si alguien escribe a mano la dirección de una pestaña ajena, la página muestra la pantalla 403 «No tienes acceso a esta sección», y la API responde 403 aunque se intente llamar directamente.'),
  table(['Pestaña', ...ROLES], MATRIX, [3.4, 1.6, 1.6, 1.5, 1.6, 1.3]),
  gap(),
  table(['Rol', 'Cómo entra', 'A dónde llega'], [
    ['Administrador', 'Correo y contraseña', 'Panel'],
    ['Recepcionista', 'Correo y contraseña', 'Panel'],
    ['Almacenero', 'Correo y contraseña', 'Panel'],
    ['Programador', 'Correo y contraseña', 'Vista del programador'],
    ['Cliente', 'Solo con Google', 'Completar registro la primera vez; después, Reservar'],
  ], [2.6, 3.4, 5]),

  h1('3. Administrador'),
  p('Es el responsable del sistema: ve y usa todas las pestañas del personal, define precios y tipos de habitación, gestiona al personal y sus cuentas, y revisa reportes y auditoría.'),
  h2('3.1 Pestañas y lo que puede hacer'),
  table(['Pestaña', 'Qué puede hacer'], [
    ['Panel', 'Ocupación, llegadas y salidas del día, ingresos del mes, tablero de habitaciones e insumos bajo el mínimo'],
    ['Reservas, Estadías, Habitaciones, Clientes, Cochera', 'Todo lo que hace Recepción (sección 4)'],
    ['Tipos de habitación', 'Crear, editar y eliminar tipos: precio por noche, capacidad, descripción y lo que incluye (servicios que ve el cliente)'],
    ['Inventario', 'Todo lo que hace el Almacenero (sección 5)'],
    ['Personal', 'Agregar, editar y eliminar personas del personal con su cargo, turno, fecha de ingreso y cuenta'],
    ['Registrar personal', 'Crear cuentas de Recepción, Almacén, Administración y Programador'],
    ['Usuarios y roles', 'Buscar y filtrar cuentas por rol, cambiar nombre, correo, contraseña y roles. Las cuentas de cliente no reciben roles del personal'],
    ['Reportes', 'Ocupación de un rango de fechas e ingresos de los últimos 6 meses'],
    ['Auditoría', 'Quién creó, editó o eliminó cada registro y cuándo'],
    ['Facturación', 'Módulo en construcción (pantalla «En construcción»)'],
    ['Vista del programador', 'El mismo diagnóstico que ve el Programador'],
  ], [3.4, 8]),
  h2('3.2 Recorrido probado'),
  stepsTable('Administrador'),
  gap(),
  ...shot('21-administrador-menu', 'Menú del Administrador con todos los módulos.'),
  ...shot('22-administrador-tipos-de-habitacion', 'Tipos de habitación: el tipo nuevo con lo que incluye.'),
  ...shot('26-administrador-usuarios-y-roles', 'Usuarios y roles: la cuenta nueva con el rol agregado.'),
  ...shot('27-administrador-usuarios-y-roles', 'Una cuenta de cliente: no tiene contraseña ni casillas de rol.'),

  h1('4. Recepcionista'),
  p('Atiende a los huéspedes: los registra, reserva por ellos, hace el check-in y el check-out, controla la cochera y el estado de las habitaciones.'),
  h2('4.1 Pestañas y lo que puede hacer'),
  table(['Pestaña', 'Qué puede hacer'], [
    ['Panel', 'Resumen del día: llegadas con botón de check-in, salidas, habitaciones libres y en limpieza'],
    ['Reservas', 'Crear reservas (busca al huésped, elige fechas y habitación libre), check-in, cancelar y filtrar por estado'],
    ['Estadías', 'Huéspedes dentro del hotel y su historial; check-out (la habitación pasa a limpieza y se libera su cochera)'],
    ['Habitaciones', 'Ver por estado, crear y editar habitaciones y marcarlas «lista» después de la limpieza'],
    ['Tipos de habitación', 'Solo consultar precios y lo que incluye cada tipo'],
    ['Clientes', 'Registrar, buscar por nombre o documento, editar y eliminar huéspedes sin reservas; ve si tienen cuenta web'],
    ['Cochera', 'Registrar la entrada de un vehículo (con o sin estadía), su salida y administrar los espacios'],
    ['Sin acceso', 'Inventario, Personal, Usuarios, Reportes, Auditoría y Vista del programador (pantalla 403)'],
  ], [3.4, 8]),
  h2('4.2 Recorrido probado'),
  stepsTable('Recepcionista'),
  gap(),
  ...shot('03-recepcionista-panel', 'Panel de Recepción.'),
  ...shot('06-recepcionista-reservas', 'Check-in registrado: la habitación quedó ocupada.'),
  ...shot('09-recepcionista-estadias', 'Check-out: la habitación pasó a limpieza.'),
  ...shot('12-recepcionista-acceso-denegado', 'Recepción intentando abrir Inventario: pantalla 403.'),

  h1('5. Almacenero'),
  p('Controla los insumos del hotel (toallas, amenities, lencería): registra lo que entra y lo que sale y repone lo que está bajo el mínimo.'),
  h2('5.1 Pestañas y lo que puede hacer'),
  table(['Pestaña', 'Qué puede hacer'], [
    ['Panel', 'Resumen con los insumos bajo el mínimo'],
    ['Inventario', 'Crear, editar y eliminar insumos; registrar entradas y salidas con motivo; filtrar los que están bajo el mínimo. No puede sacar más de lo que hay'],
    ['Sin acceso', 'Todo lo de Recepción y Administración (pantalla 403)'],
  ], [3.4, 8]),
  h2('5.2 Recorrido probado'),
  stepsTable('Almacenero'),
  gap(),
  ...shot('17-almacenero-inventario', 'Inventario: salida registrada (el insumo pasó de 20 a 12).'),
  ...shot('18-almacenero-inventario', 'La página impide sacar más stock del que hay.'),

  h1('6. Programador'),
  p('Da soporte técnico: revisa el estado del sistema sin entrar al servidor y crea cuentas del personal cuando hace falta.'),
  h2('6.1 Pestañas y lo que puede hacer'),
  table(['Pestaña', 'Qué puede hacer'], [
    ['Vista del programador · Resumen', 'Estado de la aplicación, la base de datos y la caché; versión, configuración y latencias p50, p95 y p99'],
    ['Vista del programador · Peticiones', 'Últimas peticiones a la API con su código y duración, filtrables'],
    ['Vista del programador · Errores', 'Errores del servidor, buscables por el código de incidente que ve el usuario en la pantalla 500'],
    ['Vista del programador · Rutas de la API', 'Todas las rutas con su método y el rol que las puede usar'],
    ['Registrar personal', 'Crear cuentas de Recepción, Almacén y Administración. No puede crear Programadores'],
    ['Sin acceso', 'Recepción, Almacén, Usuarios y roles y los demás módulos del Administrador (pantalla 403)'],
  ], [3.4, 8]),
  h2('6.2 Recorrido probado'),
  stepsTable('Programador'),
  gap(),
  ...shot('34-programador-vista-del-programador', 'Vista del programador: pestaña Resumen.'),
  ...shot('38-programador-registrar-personal', 'Registrar personal: el Programador no tiene la opción Programador.'),

  h1('7. Cliente'),
  p('Es el huésped con cuenta propia. Entra solo con Google, completa su DNI y teléfono la primera vez y reserva en línea; no ve nada del panel interno.'),
  h2('7.1 Pestañas y lo que puede hacer'),
  table(['Pestaña', 'Qué puede hacer'], [
    ['Completar registro', 'La primera vez: nombre y correo vienen de Google; escribe su DNI (8 dígitos) y teléfono (9 dígitos)'],
    ['Reservar', 'Elige llegada, salida y personas; ve cada tipo con lo que incluye, cuántas habitaciones quedan libres y el total; confirma y el hotel le asigna la habitación'],
    ['Mis reservas', 'Sus reservas con estado y total; puede cancelar las confirmadas antes del día de llegada'],
    ['Sin acceso', 'Todo el panel del personal (pantalla 403). No tiene contraseña: solo entra con Google'],
  ], [3.4, 8]),
  h2('7.2 Recorrido probado'),
  stepsTable('Cliente'),
  gap(),
  ...shot('42-cliente-completar-registro', 'Cliente: después de completar sus datos ve cada tipo con lo que incluye.'),
  ...shot('44-cliente-reservar', 'Reserva confirmada: el hotel asignó la habitación y aparece en Mis reservas.'),
  ...shot('46-cliente-mis-reservas', 'Mis reservas: la reserva cancelada.'),

  h1('8. Incoherencias encontradas y corregidas'),
  table(['Qué se encontró', 'Por qué era un problema', 'Cómo se corrigió'], [
    ['En «Usuarios y roles» el Administrador podía marcar el rol Cliente y cambiar los roles de una cuenta de cliente', 'Un cliente entra con Google y no tiene contraseña: convertirlo en personal mezclaba los dos tipos de cuenta (y la API lo rechazaba con un error)', 'Las casillas solo muestran roles del personal; una cuenta de cliente muestra un aviso y no se le cambian roles. La API responde 409 CLIENT_ROLES_LOCKED si se intenta'],
    ['El check-in se aceptaba aunque la habitación todavía tuviera otro huésped dentro', 'Podían quedar dos estadías «Hospedado» en la misma habitación', 'El check-in revisa que no haya otra estadía abierta en esa habitación; si la hay responde 409 ROOM_OCCUPIED y pide hacer primero el check-out'],
    ['El Almacenero veía «Panel» dentro del grupo «Recepción» del menú', 'Daba a entender que el Almacenero usaba recepción', 'El Panel quedó en su propio grupo «Inicio»'],
  ], [3.6, 3.8, 4]),
  gap(),
  p([t('Observaciones (no son errores): ', { bold: true })]),
  bullet('El inicio con Google real necesita las credenciales OAuth del hotel (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET); en la prueba se simuló con una sesión de prueba.'),
  bullet('En local, el correo de verificación de las cuentas nuevas no sale a internet: queda en el registro (log) del servidor.'),
  bullet('Los datos masivos de demostración (5000 reservas) se generan al azar y algunas comparten habitación en fechas cruzadas; con la corrección del check-in ya no pueden quedar dos huéspedes a la vez en la misma habitación.'),

  h1('9. Pantallas de error y de estado'),
  p('Todas las respuestas de error de la API tienen su pantalla, con el mismo estilo y una salida clara. Se revisaron las ocho junto con el recorrido.'),
  ...((() => {
    const data = fs.readFileSync(path.join(ROOT, 'docs/diseno/errores.png'))
    const pxW = Math.round(14.5 * 37.8)
    figure += 1
    return [
      center([new ImageRun({ type: 'png', data, transformation: { width: pxW, height: Math.round(pxW * data.readUInt32BE(20) / data.readUInt32BE(16)) } })], { spacing: { after: 60 }, keepNext: true }),
      caption(`Figura ${figure}. Pantallas 401, 403, 404, 429, 500, 503, en construcción y sin conexión.`),
    ]
  })()),

  h1('10. Siguiente paso'),
  p('Con la página revisada y coherente para los cinco roles, el siguiente paso es construir la aplicación móvil para Android e iOS (React Native con Expo), que usará la misma API y los mismos permisos por rol. Antes se presenta el informe de las pruebas de carga con k6.'),
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
  title: 'LeGrandHotel – Recorridos por rol',
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  features: { updateFields: true },
  sections: [section([...caratula, ...body])],
})

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT, `${ok}/${results.length} pasos`) })
