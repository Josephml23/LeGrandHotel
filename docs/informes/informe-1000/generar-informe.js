// Genera docs/informes/informe-1000/LeGrandHotel_Pruebas_1000.docx: prueba k6 de 1000 usuarios en 1 minuto,
// prueba de aguante con 1000 usuarios y avances del proyecto desde la entrega del 25%.
//   node docs/informes/informe-1000/generar-informe.js <logo_tecsup.jpg>
// Los números salen de docs/pruebas/datos/ (k6 y los scripts bloques.py y aguante.py).
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, PageBreak, Footer, PageNumber, LevelFormat, BorderStyle, ShadingType, TableOfContents, VerticalAlign,
} = require('docx')

const ROOT = 'C:/Proyectos/LeGrandHotel'
const BASE = path.join(ROOT, 'docs/informes/informe-1000')
const CAPS = path.join(BASE, 'capturas')
const DATA = path.join(ROOT, 'docs/pruebas/datos')
const GRAF = path.join(ROOT, 'docs/pruebas/graficos')
const LOGO = process.argv[2]
const OUT = path.join(BASE, 'LeGrandHotel_Pruebas_1000.docx')

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

// ── datos reales ─────────────────────────────────────────
const json = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'))
const num = (v, d = 1) => Number(v).toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d })
const int = (v) => Math.round(v).toLocaleString('es-PE')
const sec = (ms) => `${num(ms / 1000, 2)} s`

const run1 = json('local-bloques-1000vu-5s.json').metrics
const blocks1 = json('local-bloques-1000vu-5s-bloques.json')
const run2 = json('local-aguante-1000vu.json').metrics
const tramos = json('local-aguante-1000vu-tramos.json')
// /health cada 5 s tras la prueba: [código, segundos]; el tiempo real suma la espera de cada intento + 5 s.
const recovery = [...new Set(fs.readFileSync(path.join(DATA, 'local-aguante-1000vu.txt'), 'utf8').split('\n')
  .filter((l) => /^\s+\+\d+s /.test(l)).map((l) => l.trim()))].map((l) => l.split(/\s+/).slice(1))
  .map(([code, secs]) => ({ code, secs: parseFloat(secs) }))
const firstOk = recovery.findIndex((r) => r.code === '200')
const recoverySeconds = recovery.slice(0, Math.max(0, firstOk)).reduce((a, r) => a + r.secs + 5, 0)
const totals = (m) => ({
  reqs: m.http_reqs.count, rps: m.http_reqs.rate, p95: m.http_req_duration['p(95)'], med: m.http_req_duration.med,
  failed: m.http_req_failed.value * 100, iterations: m.iterations.count,
})
const T1 = totals(run1)
const T2 = totals(run2)
const lastOk = [...blocks1].reverse().find((r) => r.errors <= 1)
const firstBad = blocks1.find((r) => r.errors > 1)
const R = tramos.resumen
const sustainedBad = tramos.tramos.filter((r) => r.usuarios >= 1000 && r.errores_pct > 1).length
const atMax = tramos.tramos.filter((r) => r.usuarios >= 1000)

const incidentes = fs.readFileSync(path.join(ROOT, 'docs/incidentes.md'), 'utf8').split('\n')
  .filter((l) => /^\| 2026-1[01]-(2[8-9]|3\d|\d\d)/.test(l) && !/^\| 2026-10-2[67]/.test(l))
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
  cov('Pruebas de carga con 1000 usuarios', { bold: true, size: 32 }, 120),
  cov('y avances desde la entrega del 25%'),
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

// ── 1. Introducción ──────────────────────────────────────
const s1 = [
  p([t('Índice', { bold: true, size: 30 })], { spacing: { after: 160 } }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),
  h1('1. Objetivo del documento'),
  p('Este documento presenta tres cosas: (1) la prueba de carga con k6 de 1000 usuarios que llegan en 1 minuto, en bloques de 100; (2) una prueba de aguante que mide cuánto tiempo resiste el sistema con esos 1000 usuarios conectados; y (3) lo que se agregó al proyecto desde la entrega del 25%.'),
  p('Siguiendo la indicación del curso, se separa lo que se evalúa en la entrega del 80% de lo que se agregó como extra. Las pruebas se hicieron en la laptop del equipo porque el servidor en AWS aún no está creado; por eso sus resultados muestran el límite de una sola máquina y no el del sistema desplegado.'),
]

// ── 2. Entorno ───────────────────────────────────────────
const s2 = [
  h1('2. Entorno y escenario de prueba'),
  ...table('Entorno de las pruebas', ['Elemento', 'Configuración'], [
    ['Equipo', 'Laptop del equipo: 20 hilos de CPU y 15,6 GB de RAM (Windows 11). k6 corre en la misma laptop.'],
    ['API', 'Docker: Nginx 1.27 + PHP-FPM (20 procesos) + OPcache + caché de Laravel (config, rutas y eventos)'],
    ['Base de datos y caché', 'MySQL 8.4 y Redis 7 en Docker'],
    ['Herramienta', 'k6 2.2 con el escenario tests/k6/reservas.js (recepción)'],
    ['Rate limits', 'Elevados solo durante la prueba para que los 429 no cuenten como errores; se restauraron al terminar'],
    ['Tiempo máximo por petición', '10 s en Nginx y PHP (lo que dure más se corta con 503/504)'],
  ], [2.2, 6]),
  p('Escenario: cada usuario virtual es un recepcionista. En cada iteración: 70% consulta (habitaciones disponibles, reservas y tipos), 20% inicia sesión y 10% crea una reserva; luego espera entre 1 y 2 segundos. Metas del 80%: p95 menor a 800 ms y menos de 1% de errores.'),
]

// ── 3. Prueba 1 ──────────────────────────────────────────
const s3 = [
  h1('3. Prueba 1: 1000 usuarios en 1 minuto'),
  p('Los usuarios suben de 100 en 100 cada 5 segundos (1 s subiendo y 4 s sostenido por bloque) hasta llegar a 1000 en 1 minuto; luego bajan en 10 s.'),
  ...code(['bash tests/k6/correr-bloques.sh 1000 5', 'python docs/pruebas/bloques.py 1000:5']),
  ...table('Resultado total de la prueba 1', ['Peticiones', 'Pet./s', 'Mediana', 'p95', 'Errores', 'Meta'], [
    [int(T1.reqs), num(T1.rps), sec(T1.med), sec(T1.p95), `${num(T1.failed)} %`, 'p95 < 0,8 s y < 1 %'],
  ], [1.3, 1, 1.1, 1, 1, 1.8]),
  ...table('Prueba 1 por bloque de 100 usuarios (5 s cada uno)', ['Usuarios', 'Peticiones', 'Pet./s', 'p95', 'Errores'],
    blocks1.map((r) => [r.vus, r.reqs, num(r.rps), `${num(r.p95, 2)} s`, `${num(r.errors)} %`]), [1, 1.2, 1, 1, 1]),
  ...img(path.join(GRAF, 'bloques-1000vu-5s.png'), 'Prueba 1: p95 y errores en cada bloque de 100 usuarios', 15.5),
  h2('Interpretación'),
  p(`Hasta ${lastOk.vus} usuarios no hubo errores, pero la meta de tiempo no se cumple desde el primer bloque: el p95 sube de ${num(blocks1[0].p95, 1)} s a ${num(lastOk.p95, 1)} s porque la laptop no atiende más de unas 45 peticiones por segundo y el resto espera en cola. Con ${firstBad.vus} usuarios las peticiones esperan más de 10 s y Nginx las corta: ese es el punto de quiebre local. Desde ahí las «peticiones por segundo» suben porque los cortes responden rápido, no porque se atienda a más gente.`),
]

// ── 4. Prueba 2 (aguante) ────────────────────────────────
const firstAtMax = atMax[0]
const s4 = [
  h1('4. Prueba 2: cuánto tiempo aguanta los 1000 usuarios'),
  p('Los 1000 usuarios llegan en 1 minuto (bloques de 100) y se mantienen conectados 3 minutos más. Se mide cuánto tiempo responde sin errores, cómo se comporta con los 1000 sostenidos y si la API se recupera sola al terminar.'),
  ...code(['bash tests/k6/correr-aguante.sh 1000', 'python docs/pruebas/aguante.py 1000']),
  ...table('Resultado total de la prueba 2', ['Peticiones', 'Pet./s', 'Mediana', 'p95', 'Errores', 'Duración'], [
    [int(T2.reqs), num(T2.rps), sec(T2.med), sec(T2.p95), `${num(T2.failed)} %`, '1 min de subida + 3 min sostenidos'],
  ], [1.2, 1, 1.1, 1, 1, 2]),
  ...table('Prueba 2 en tramos de 10 segundos', ['Desde (s)', 'Usuarios', 'Peticiones', 'Pet./s', 'p95', 'Errores'],
    tramos.tramos.map((r) => [r.desde, r.usuarios, r.peticiones, num(r.pet_s), `${num(r.p95_s, 2)} s`, `${num(r.errores_pct)} %`]), [1, 1, 1.1, 1, 1, 1]),
  ...img(path.join(GRAF, 'aguante-1000vu.png'), 'Prueba 2: usuarios activos, p95 y errores cada 10 segundos', 15.5),
  h2('Cuánto aguantó'),
  bullet([b('Sin ningún error: '), t(R.primer_error_s === null ? 'toda la prueba.' : `los primeros ${num(R.primer_error_s, 0)} segundos.`)]),
  bullet([b('Errores por encima del 1%: '), t(R.primer_tramo_con_mas_de_1pct === null ? 'no ocurrieron.' : `desde el segundo ${R.primer_tramo_con_mas_de_1pct}, con unos ${R.usuarios_en_ese_momento} usuarios conectados.`)]),
  bullet([b('Con los 1000 usuarios sostenidos: '), t(firstAtMax ? `${sustainedBad} de ${atMax.length} tramos de 10 s superaron el 1% de errores.` : 'no se llegó a sostener 1000 usuarios.')]),
  bullet([b('Recuperación: '), t(firstOk >= 0 ? `al terminar la prueba, /health respondió 503 en ${firstOk} intentos (cada uno esperó 10 s) y volvió a 200 unos ${Math.round(recoverySeconds)} s después; desde ahí respondió en menos de 0,2 s.` : 'no se recuperó en el minuto medido.')]),
  h2('Interpretación'),
  p(`El sistema aguanta unos ${num(R.primer_error_s, 0)} segundos sin errores mientras los usuarios van llegando; el problema aparece al pasar de unos 500 a 700 usuarios. Con los 1000 sostenidos no se recupera: todos los tramos tienen 100% de errores aunque la laptop sigue atendiendo unas 45 peticiones por segundo.`),
  p(`La razón es la cola: las peticiones que no se pueden atender en el momento esperan en orden de llegada. Cuando la cola ya supera los 10 s, cada petición llega al frente después de su tiempo límite y Nginx la corta, así que el trabajo se hace para respuestas que nadie recibe. La API no se cae (no se reinicia ni pierde datos): al terminar la prueba vacía la cola y unos ${Math.round(recoverySeconds)} s después vuelve a responder en menos de 0,2 s.`),
  p('Corrección propuesta además de más capacidad: limitar la cola (load shedding). Si Nginx y PHP-FPM aceptan solo las peticiones que pueden atender a tiempo y responden al resto de inmediato con 503 y Retry-After (pantalla que la aplicación ya maneja), los usuarios atendidos reciben respuesta en pocos segundos en lugar de que todos esperen y fallen.'),
]

// ── 5. Qué hacer ─────────────────────────────────────────
const s5 = [
  h1('5. Cuello de botella y cómo soportar 1000 y 5000 usuarios'),
  p('Con el ritmo del escenario (una acción cada 1 a 2 segundos por usuario), 1000 usuarios necesitan unas 1500 peticiones por segundo y 5000 unas 7500; la laptop atiende unas 45. Las causas encontradas y las mejoras propuestas son:'),
  ...table('Mejoras propuestas por nivel', ['Nivel', 'Qué se hace', 'Efecto esperado'], [
    ['1. Ajustes locales', 'Caché y rate limiter en Redis; caché corta de tipos y disponibilidad; menos escrituras de Sanctum por petición; bcrypt costo 10; k6 desde otro equipo', '2 a 4 veces más (por medir)'],
    ['1b. Limitar la cola', 'Nginx (limit_conn) y PHP-FPM (listen.backlog) aceptan solo lo que pueden atender a tiempo; el exceso recibe 503 con Retry-After al instante', 'Los atendidos responden a tiempo en vez de fallar todos'],
    ['2. Laravel en memoria', 'Laravel Octane (FrankenPHP o Swoole): el framework no se recarga en cada petición', '3 a 5 veces por CPU'],
    ['3. Servidor en AWS', 'Balanceador con Auto Scaling, RDS con réplica de lectura, ElastiCache y k6 desde EC2 generadoras (Terraform ya preparado)', 'Escala con el número de instancias'],
  ], [1.4, 4, 1.6]),
  p('La prueba del 80% en el servidor se hará con el mismo script (PROFILE=bloques VUS=1000 y VUS=5000) cuando se cree la infraestructura en AWS, y se compararán los resultados con los de este documento.'),
]

// ── 6. Avances desde el 25% ──────────────────────────────
const s6 = [
  h1('6. Avances desde la entrega del 25%'),
  p('Lista de lo que se agregó o mejoró después del informe del 25% (27/10/2026). La última columna indica si responde a un punto evaluado del 80% o si es un extra, como pide el curso.'),
  ...table('Avances desde la entrega del 25%', ['Avance', 'Qué se hizo', 'Evidencia', 'Tipo'], [
    ['Respaldos (backups)', 'Respaldo de MySQL comprimido y cifrado (AES-256) en un repositorio privado de GitHub; prueba de restauración con las 5 tablas iguales', 'infra/scripts/backup-mysql-to-github.sh y restore-from-github.sh', 'Evaluado 80%'],
    ['Pruebas con 1000 usuarios', 'Pruebas por bloques de 100, de 1 minuto y de aguante, con tabla y gráfico por bloque', 'tests/k6/correr-bloques.sh, correr-aguante.sh; docs/pruebas/', 'Evaluado 80%'],
    ['Rate limit del login', 'Tras una contraseña incorrecta hay que esperar 30 s, y la espera se duplica en cada fallo (hasta 15 min); cuenta regresiva en el login', 'LoginLockout; AuthTest; tests/k6/rate-limit.js', 'Evaluado 80%'],
    ['Ingreso con correo (Google)', 'Revisión de Google OAuth y corrección del regreso al primer dominio del frontend', 'GoogleAuthController; ClientPortalTest', 'Evaluado 80%'],
    ['Múltiples tipos de usuario', 'Un solo Programador (nadie crea otro ni le quita el rol); recorrido probado por rol (47 pasos)', 'docs/recorridos; pruebas de roles', 'Evaluado 80%'],
    ['Perfil del cliente', 'DNI y celular opcionales al registrarse; «Mi perfil» para editarlos; al reservar se piden si faltan o se avisa a nombre de quién queda', 'ProfilePage, BookPage; ClientPortalTest, client.test.tsx', 'Mejora'],
    ['Mejora de rendimiento medida', 'Nginx + PHP-FPM + OPcache + caché de Laravel: 4 veces más peticiones y p95 18 veces menor que con php -S', 'docs/pruebas/README.md', 'Extra (uso de recursos)'],
    ['Pruebas de clientes del portal', 'Escenario k6 de clientes (buscan, ven y crean reservas) y comando k6:limpiar', 'tests/k6/portal.js', 'Extra'],
    ['Modo oscuro e inglés', 'Configuración con tema claro, oscuro o del sistema e idioma español o inglés; la API responde en el idioma elegido', 'SettingsPage, i18n; i18n.test.tsx', 'Extra'],
    ['Tutorial de bienvenida', 'Al primer ingreso se ofrece un recorrido que oscurece la pantalla y resalta cada sección del rol; se repite desde Configuración', 'Tour.tsx; POST /auth/tutorial; tour.test.tsx', 'Extra'],
    ['Filtros del tablero', 'El tablero de habitaciones del panel filtra por piso y estado y muestra las 70 habitaciones (antes 50)', 'RoomRack.tsx; rack.test.tsx', 'Extra'],
    ['Documentación', 'Diagrama de la base generado desde el esquema real; tutoriales de k6 y MySQL Workbench; informe de pruebas k6 con capturas', 'docs/diagramas, docs/pruebas', 'Extra'],
    ['Registro de caídas', 'Cada caída, incluso local, con motivo y solución (sección 7)', 'docs/incidentes.md', 'Evaluado'],
  ], [1.5, 3.4, 2.2, 1.1]),
  ...shot('panel-filtros', 'Tablero de habitaciones con los filtros por piso y estado'),
  ...shot('tutorial-aviso', 'Primer ingreso: se ofrece hacer el tutorial u omitirlo'),
  ...shot('tutorial', 'Tutorial de bienvenida: la pantalla se oscurece y se resalta cada sección'),
  ...shot('configuracion', 'Configuración: tema, idioma y tutorial'),
  ...shot('login-espera', 'Login: cuenta regresiva después de una contraseña incorrecta'),
]

// ── 7. Incidentes ────────────────────────────────────────
const s7 = [
  h1('7. Caídas e incidentes desde el 25%'),
  p('Todas las caídas se registran en docs/incidentes.md con su motivo y solución, aunque sean en local o durante una prueba.'),
  ...table('Incidentes registrados desde el 28/10/2026', ['Fecha', 'Entorno', 'Qué falló', 'Motivo', 'Solución', 'Tiempo'],
    incidentes.map((r) => r.slice(0, 6)), [0.9, 1.1, 1.8, 2.2, 2.2, 0.8]),
]

// ── 8. Pendientes ────────────────────────────────────────
const s8 = [
  h1('8. Pendientes para completar el 80%'),
  bullet('Crear el entorno en AWS (Terraform listo) y desplegar el proyecto con el pipeline deploy.yml.'),
  bullet('Repetir en el servidor las pruebas de 1000 y 5000 usuarios con k6 desde EC2 generadoras.'),
  bullet('Configurar en AWS los respaldos automáticos (snapshots de RDS y backup-mysql-to-s3.sh).'),
  bullet('Guardar las credenciales de Google en el servidor y registrar la URL de regreso del dominio real.'),
]

const doc = new Document({
  creator: 'LeGrandHotel',
  title: 'LeGrandHotel – Pruebas de carga con 1000 usuarios',
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
    children: [...caratula, ...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8],
  }],
})

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf)
  console.log(`Informe: ${OUT}`)
})
