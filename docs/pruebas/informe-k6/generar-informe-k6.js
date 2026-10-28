// Genera docs/pruebas/informe-k6/LeGrandHotel_Pruebas_k6.docx: qué se corrió con k6, capturas de cada comando
// con su respuesta y qué significa cada dato. Lee los resultados de salidas/*.json.
//   node docs/pruebas/informe-k6/generar-informe-k6.js <logo_tecsup.jpg>
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, PageBreak, Footer, PageNumber, LevelFormat, BorderStyle, ShadingType, TableOfContents, VerticalAlign,
} = require('docx')

const BASE = 'C:/Proyectos/LeGrandHotel/docs/pruebas/informe-k6'
const LOGO = process.argv[2]
const OUT = path.join(BASE, 'LeGrandHotel_Pruebas_k6.docx')
const SHOTS = path.join(BASE, 'capturas')
const sal = (name) => JSON.parse(fs.readFileSync(path.join(BASE, 'salidas', `${name}.json`), 'utf8')).metrics

const FONT = 'Times New Roman'
const CODE = 'Consolas'
const CM = 567
const PAGE_W = 11906 - 2 * Math.round(2.5 * CM)

// ── helpers ─────────────────────────────────────────────
const t = (text, o = {}) => new TextRun({ text, font: FONT, size: 24, ...o })
const c = (text) => new TextRun({ text, font: CODE, size: 20 })
const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [t(children)], spacing: { after: 120, line: 300 }, ...o })
const center = (children, o = {}) => p(children, { alignment: AlignmentType.CENTER, ...o })
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 240, after: 160 } })
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 200, after: 120 } })
const bullet = (children) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: Array.isArray(children) ? children : [t(children)], spacing: { after: 60, line: 288 } })
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })
const caption = (text) => center([t(text, { italics: true, size: 20 })], { spacing: { after: 200 } })
const gap = () => p('', { spacing: { after: 80 } })
const codeBlock = (lines) => lines.map((l, i) => new Paragraph({
  children: [c(l)], spacing: { after: i === lines.length - 1 ? 160 : 0, line: 260 },
  shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' }, indent: { left: 200 },
}))

let figure = 0
function img(file, label, widthCm = 15) {
  const data = fs.readFileSync(file)
  const w = data.readUInt32BE(16)
  const h = data.readUInt32BE(20)
  let pxW = Math.round(widthCm * 37.8)
  // Que la imagen no pase de ~22 cm de alto para que entre en la página con su título.
  const maxH = Math.round(21.5 * 37.8)
  if (pxW * h / w > maxH) pxW = Math.round(maxH * w / h)
  figure += 1
  return [
    center([new ImageRun({ type: 'png', data, transformation: { width: pxW, height: Math.round(pxW * h / w) } })], { spacing: { after: 60 }, keepNext: true }),
    caption(`Figura ${figure}. ${label}`),
  ]
}
const shot = (name, label, widthCm) => img(path.join(SHOTS, `${name}.png`), label, widthCm)
const chart = (name, label) => img(path.join(BASE, 'graficos', `${name}.png`), label, 14.5)

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
    children: [new Paragraph({ children: [String(text).startsWith('`') ? c(String(text).slice(1)) : t(String(text), { size: 20, bold: !!head })], spacing: { after: 0 } })],
  })
  return new Table({
    width: { size: scaled.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: scaled,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((hh, i) => cell(hh, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, i, false)) })),
    ],
  })
}

// ── datos de las corridas ────────────────────────────────
const ms = (v) => `${Math.round(v).toLocaleString('es-PE')} ms`
const pct = (v) => `${(v * 100).toFixed(2)} %`
const smoke = sal('1-smoke')
const ESCALONES = [5, 10, 25, 50].map((v) => {
  const m = sal(`3-escalon-${v}vu`)
  const d = m.http_req_duration
  return {
    vus: v, reqs: m.http_reqs.count, rps: m.http_reqs.rate, avg: d.avg, p50: d.med, p90: d['p(90)'], p95: d['p(95)'], max: d.max,
    failed: m.http_req_failed.value, checks: m.checks.passes, checksFail: m.checks.fails,
    lectura: m['http_req_duration{tipo:lectura}']['p(95)'], reserva: m.reserva_creada_ms ? m.reserva_creada_ms['p(95)'] : null,
    iters: m.iterations.count, meta: d['p(95)'] < 500,
  }
})
const e5 = ESCALONES[0]
const e50 = ESCALONES[3]

// ── carátula (skill caratula-tecsup) ─────────────────────
const cov = (text, o = {}, spacingAfter = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 360, after: spacingAfter }, children: [t(text, o)] })
const caratula = [
  cov('INSTITUTO TECNOLÓGICO SUPERIOR TECSUP', { bold: true }),
  cov('DISEÑO Y DESARROLLO DE SOFTWARE', {}, 240),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(LOGO), transformation: { width: 189, height: 113 } })] }),
  cov('CURSO: DESARROLLO DE SOLUCIONES EN LA NUBE', { bold: true }),
  cov('PROYECTO:', { bold: true }),
  cov('LeGrandHotel – Sistema web de gestión de hospedaje', { bold: true }, 240),
  cov('INFORME DE PRUEBAS DE CARGA CON K6', { bold: true }),
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

  h1('1. Qué es k6 y para qué lo usamos'),
  p('k6 es una herramienta de Grafana para pruebas de carga. Se escribe un guion (script) en JavaScript que dice qué peticiones hacer a la API; k6 lo ejecuta con muchos «usuarios virtuales» (VU) a la vez, mide cuánto tarda cada respuesta y al final muestra un resumen. Un usuario virtual es un programa que repite el guion una y otra vez como si fuera una persona usando el sistema.'),
  p('Con k6 respondemos tres preguntas sobre LeGrandHotel:'),
  bullet([t('¿Funciona? ', { bold: true }), t('Prueba de humo (smoke): pocos usuarios, solo para ver que la API, la base de datos y la caché responden bien.')]),
  bullet([t('¿Se protege? ', { bold: true }), t('Prueba del límite de login: después de 5 intentos por minuto la API debe responder 429.')]),
  bullet([t('¿Cuánto aguanta? ', { bold: true }), t('Pruebas por escalones: el mismo trabajo de recepción con 5, 10, 25 y 50 usuarios a la vez, para ver cómo cambia el tiempo de respuesta.')]),
  p('Cada guion tiene «umbrales» (thresholds): metas que, si no se cumplen, hacen que k6 marque la corrida como fallida (✗) y termine con código de salida 99. Así la prueba se aprueba o se reprueba sola, sin interpretar a ojo.'),

  h1('2. Dónde se hicieron las pruebas'),
  p('Todas las corridas de este informe se hicieron el 27 de octubre de 2026 en la laptop del equipo, contra la API corriendo en la misma máquina. No se usó AWS (la sección 3.3 del informe principal sigue pendiente).'),
  table(['Dato', 'Valor'], [
    ['Equipo', 'Laptop del equipo · Windows 11 Pro'],
    ['Herramienta', 'k6 v2.2.0 (instalado con winget)'],
    ['API', 'Laravel 12 sobre el servidor integrado de PHP 8.2 (php -S): atiende una petición a la vez'],
    ['Base de datos', 'SQLite con los datos masivos: 70 habitaciones, 1000 huéspedes y 5000 reservas'],
    ['Usuarios de prueba', '50 recepcionistas k6-0 … k6-49 (LoadTestUsersSeeder)'],
    ['Dirección', 'http://[::1]:8000/api/v1 (se usa [::1] porque el servidor de PHP escucha en IPv6)'],
    ['Límites', 'En el puerto 8000 los límites de peticiones están altos para que los 429 no cuenten como error; en el 8001 se dejó el límite real de login (5 por minuto) para la prueba del 429'],
  ], [3, 8]),
  gap(),
  p([t('Importante: ', { bold: true }), t('el servidor integrado de PHP es solo para desarrollo. Los números de este informe muestran cómo se comporta en la laptop, no la capacidad final del hotel, que se medirá en AWS con Nginx y PHP-FPM.')]),

  h1('3. Preparación'),
  p('Antes de correr k6 se comprueba que k6 esté instalado y que la API esté sana. El primer comando muestra la versión de k6; el segundo llama a /health, que responde si la aplicación, la base de datos y la caché están bien y cuánto tardó cada una.'),
  ...shot('t0-version', 'Comando k6 version y su respuesta.'),
  ...shot('t0-health', 'Comprobación de salud de la API: status «ok» en app, base de datos y caché.'),
  table(['Campo de la respuesta', 'Qué significa'], [
    ['success: true', 'Formato único de respuesta de la API: la petición salió bien'],
    ['status: "ok"', 'Estado general de la API'],
    ['checks.database', 'La API pudo consultar la base de datos; latency_ms es cuánto tardó en milisegundos'],
    ['checks.cache', 'La API pudo escribir y leer en la caché'],
    ['version / time', 'Versión desplegada y hora del servidor'],
  ], [3.5, 7.5]),
  gap(),
  p('Los comandos para levantar la API con estos datos están en el anexo A.'),

  h1('4. El código de las pruebas'),
  p('Los guiones están en la carpeta tests/k6 del repositorio. Estas son las partes que se ejecutaron y qué hace cada una.'),
  h2('4.1 Configuración compartida (lib/config.js)'),
  ...shot('c5-config-js', 'tests/k6/lib/config.js: dirección de la API, inicio de sesión de los usuarios de prueba y verificación de respuestas.'),
  table(['Parte del código', 'Qué hace'], [
    ['BASE_URL', 'Dirección de la API. Se cambia con -e BASE_URL=... al correr k6'],
    ['createUsers(count)', 'Inicia sesión con los recepcionistas de prueba y guarda sus tokens; si alguno falla, detiene la prueba con un mensaje claro'],
    ['auth(token)', 'Arma las cabeceras con el token (Authorization: Bearer ...) para las rutas protegidas'],
    ['ok(res, name)', 'Un check: comprueba que la respuesta sea 2xx y lo cuenta en el resumen'],
  ], [3.2, 7.8]),
  h2('4.2 Prueba de humo (smoke.js)'),
  ...shot('c1-smoke-js', 'tests/k6/smoke.js.'),
  table(['Parte del código', 'Qué hace'], [
    ['vus / duration', 'Cuántos usuarios virtuales y por cuánto tiempo (en esta corrida: 5 VU durante 30 s)'],
    ['thresholds', 'Metas: menos de 1 % de errores, 95 % de respuestas en menos de 800 ms y más de 99 % de checks correctos'],
    ['http.get(.../health)', 'Pide la salud de la API'],
    ['check(...)', 'Verifica que /health dé 200 y que la base de datos y la caché estén «ok»'],
    ['/reservations sin token', 'Comprueba que una ruta protegida responda 401 en JSON (no una página HTML ni un error 500)'],
    ['sleep(1)', 'Espera 1 segundo entre vueltas, como haría una persona'],
  ], [3.2, 7.8]),
  h2('4.3 Límite de login (rate-limit.js)'),
  ...shot('c2-rate-limit-js', 'tests/k6/rate-limit.js.'),
  p('Un solo usuario intenta iniciar sesión 6 veces seguidas con una contraseña incorrecta. Los 5 primeros intentos deben dar 401 (credenciales incorrectas) y el sexto 429 (demasiados intentos), con la cabecera Retry-After que dice cuántos segundos esperar. responseCallback marca 401 y 429 como respuestas esperadas para que no cuenten como errores.'),
  h2('4.4 Escenario de recepción (reservas.js)'),
  ...shot('c3-reservas-perfil', 'tests/k6/reservas.js: perfil «escalon» y opciones.'),
  table(['Parte del código', 'Qué hace'], [
    ['PROFILE=escalon', 'Sube en 10 s hasta VUS usuarios, los mantiene 45 s y baja en 5 s (1 minuto en total)'],
    ['thresholds', 'Metas: p95 < 500 ms y menos de 1 % de errores. Las lecturas, aparte, p95 < 800 ms'],
    ['summaryTrendStats', 'Qué estadísticas mostrar de los tiempos: promedio, mínimo, mediana, p90, p95, p99 y máximo'],
    ['reserva_creada_ms', 'Métrica propia: cuánto tarda crear una reserva'],
  ], [3.2, 7.8]),
  ...shot('c4-reservas-escenario', 'tests/k6/reservas.js: lo que hace cada usuario virtual en cada vuelta.'),
  table(['Parte del código', 'Qué hace'], [
    ['dice < 0.7 → lecturas (70 %)', 'Consulta habitaciones disponibles en un rango de fechas, la lista de reservas y los tipos de habitación'],
    ['dice < 0.9 → login (20 %)', 'Vuelve a iniciar sesión con su usuario'],
    ['resto → crear reserva (10 %)', 'Busca una habitación libre y crea una reserva a nombre de un huésped al azar'],
    ['expectedStatuses(201, 409)', 'Si dos usuarios toman la misma habitación, el segundo recibe 409; es el comportamiento correcto y no cuenta como error'],
    ['tags', 'Etiquetan cada petición (lectura, login, escritura) para medirlas por separado'],
    ['sleep(1 + random)', 'Pausa de 1 a 2 segundos entre vueltas'],
  ], [3.6, 7.4]),

  h1('5. Prueba 1: humo (smoke)'),
  p('Qué se hizo: 5 usuarios virtuales durante 30 segundos pidieron /health y una ruta protegida sin token. Las dos primeras líneas guardan el reporte HTML con gráficos; la tercera corre la prueba y guarda el resumen en JSON.'),
  ...shot('t1-smoke', 'Comando de la prueba de humo y la respuesta de k6.'),
  h2('5.1 Cómo leer la respuesta'),
  table(['Línea de la respuesta', 'Qué significa', 'Resultado'], [
    ['scenarios: 1 scenario, 5 max VUs', 'Se corrió un escenario con hasta 5 usuarios a la vez', '—'],
    ['THRESHOLDS ✓ checks rate>0.99', 'Meta: más del 99 % de verificaciones correctas', `${pct(smoke.checks.value)} ✓`],
    ["THRESHOLDS ✓ http_req_duration p(95)<800", 'Meta: el 95 % de las respuestas en menos de 800 ms', `p95 = ${ms(smoke.http_req_duration['p(95)'])} ✓`],
    ['THRESHOLDS ✓ http_req_failed rate<0.01', 'Meta: menos de 1 % de peticiones fallidas', `${pct(smoke.http_req_failed.value)} ✓`],
    ['checks_succeeded', 'Verificaciones correctas de todas las hechas', `${smoke.checks.passes} de ${smoke.checks.passes + smoke.checks.fails}`],
    ['✓ health 200 · BD ok · caché ok', 'La API, la base de datos y la caché respondieron bien en cada vuelta', 'todas ✓'],
    ['✓ sin token → 401 JSON', 'Una ruta protegida sin token responde 401 con el código UNAUTHENTICATED', '✓'],
    ['http_req_duration avg / med / p(95)', 'Tiempo de respuesta promedio, mediana y percentil 95', `${ms(smoke.http_req_duration.avg)} / ${ms(smoke.http_req_duration.med)} / ${ms(smoke.http_req_duration['p(95)'])}`],
    ['http_reqs', 'Total de peticiones y cuántas por segundo', `${smoke.http_reqs.count} (${smoke.http_reqs.rate.toFixed(1)}/s)`],
    ['iterations', 'Vueltas completas del guion (cada una = 2 peticiones)', `${smoke.iterations.count}`],
  ], [3.8, 4.8, 2.4]),
  gap(),
  p([t('Conclusión: ', { bold: true }), t('la prueba de humo pasa. La API está sana, responde rápido con pocos usuarios y las rutas protegidas no se pueden usar sin iniciar sesión.')]),

  h1('6. Prueba 2: límite de intentos de login'),
  p('Qué se hizo: un usuario intentó iniciar sesión 6 veces con una contraseña incorrecta contra la API del puerto 8001, que tiene el límite real de 5 intentos por minuto.'),
  ...shot('t2-rate-limit', 'Comando de la prueba del límite de login y la respuesta de k6.'),
  table(['Línea de la respuesta', 'Qué significa'], [
    ['Estados recibidos: 401, 401, 401, 401, 401, 429', 'Los 5 primeros intentos dieron 401 (contraseña incorrecta) y el sexto 429 (demasiados intentos)'],
    ['✓ 6.º intento → 429', 'La API bloqueó el sexto intento'],
    ['✓ trae Retry-After', 'La respuesta dice cuántos segundos hay que esperar para volver a intentar'],
    ['✓ formato JSON único', 'El error viene con el formato de la API (error.code = TOO_MANY_REQUESTS), no como página HTML'],
    ['http_req_failed 0.00 %', 'Los 401 y 429 eran esperados, así que no cuentan como fallos'],
    ['report generation was skipped', 'Aviso normal: la prueba duró 3 s y no hubo datos suficientes para el reporte HTML'],
  ], [4.2, 6.8]),
  gap(),
  p([t('Conclusión: ', { bold: true }), t('el login está protegido contra ataques de fuerza bruta: nadie puede probar contraseñas sin límite.')]),

  h1('7. Pruebas 3 a 6: carga por escalones'),
  p('Qué se hizo: el escenario de recepción (70 % lecturas, 20 % login, 10 % crear reserva) se corrió cuatro veces, cada vez con más usuarios a la vez: 5, 10, 25 y 50. Cada corrida dura 1 minuto. Antes de empezar, la función setup() inicia sesión con un recepcionista de prueba por cada usuario virtual.'),
  h2('7.1 Escalón de 5 usuarios'),
  ...shot('t3-escalon-5vu', 'Escalón de 5 usuarios: comando y respuesta.'),
  table(['Línea de la respuesta', 'Qué significa', 'Resultado'], [
    ['Run [100%] setup()', 'Terminó la preparación: inicio de sesión de los usuarios y lectura de huéspedes', '—'],
    ["✗ http_req_duration 'p(95)<500'", 'Meta de p95 menor a 500 ms. La ✗ indica que no se cumplió', `p95 = ${ms(e5.p95)} ✗`],
    ['{tipo:lectura} p(95)<800', 'Meta aparte para las consultas (habitaciones, reservas, tipos)', `p95 = ${ms(e5.lectura)} ${e5.lectura < 800 ? '✓' : '✗'}`],
    ['✓ http_req_failed rate<0.01', 'Ninguna petición falló', `${pct(e5.failed)} ✓`],
    ['✓ disponibles · reservas · tipos · login: 2xx', 'Cada tipo de petición respondió bien', `${e5.checks} de ${e5.checks + e5.checksFail}`],
    ['reserva_creada_ms', 'Cuánto tardó crear una reserva (p95)', e5.reserva ? ms(e5.reserva) : '—'],
    ['iteration_duration', 'Cuánto tardó una vuelta completa, incluida la pausa de 1–2 s', '—'],
    ['vus min / max', 'Usuarios activos: subió de 0 a 5 y bajó al final', '0 → 5'],
    ['data_received / data_sent', 'Datos que bajaron de la API y que se enviaron', '—'],
    ['level=error thresholds ... crossed', 'k6 avisa que no se cumplió una meta y sale con código 99 (prueba reprobada)', '—'],
  ], [3.8, 4.8, 2.4]),
  gap(),
  p(`Con solo 5 usuarios ya no se cumple la meta de 500 ms: el p95 fue de ${ms(e5.p95)}. No hubo errores: todas las peticiones respondieron bien, pero algunas tardaron más de lo deseado. La explicación está en la sección 7.3.`),
  h2('7.2 Escalones de 10, 25 y 50 usuarios'),
  ...shot('t3-escalon-10vu', 'Escalón de 10 usuarios.'),
  ...shot('t3-escalon-25vu', 'Escalón de 25 usuarios.'),
  ...shot('t3-escalon-50vu', 'Escalón de 50 usuarios.'),
  h2('7.3 Comparación de los cuatro escalones'),
  table(['Usuarios', 'Peticiones', 'Pet./s', 'Mediana (p50)', 'p95', 'Máximo', 'Errores', 'Meta p95 < 500 ms'],
    ESCALONES.map((e) => [e.vus, e.reqs, e.rps.toFixed(1), ms(e.p50), ms(e.p95), ms(e.max), pct(e.failed), e.meta ? '✓ cumple' : '✗ no cumple']),
    [1.2, 1.4, 1.1, 1.7, 1.5, 1.5, 1.2, 1.8]),
  gap(),
  ...chart('01-latencia', 'Mediana y p95 del tiempo de respuesta según los usuarios a la vez.'),
  ...chart('02-peticiones-por-segundo', 'Peticiones por segundo que atendió la API en cada escalón.'),
  p([t('Qué muestran los resultados: ', { bold: true })]),
  bullet(`Las peticiones por segundo casi no suben al aumentar los usuarios (de ${ESCALONES[0].rps.toFixed(1)} a ${e50.rps.toFixed(1)}): la API llegó a su techo.`),
  bullet(`El tiempo de respuesta sí sube mucho: el p95 pasa de ${ms(e5.p95)} con 5 usuarios a ${ms(e50.p95)} con 50. Las peticiones que no se pueden atender hacen cola.`),
  bullet(`No hubo errores en ningún escalón (${pct(e50.failed)} con 50 usuarios): la API responde lento, pero no se cae ni pierde datos.`),
  p([t('Por qué pasa: ', { bold: true }), t('el servidor integrado de PHP (php -S) atiende una sola petición a la vez. Si llegan 50 juntas, 49 esperan su turno. Por eso las peticiones por segundo se quedan fijas y el tiempo crece con la cantidad de usuarios. No es un problema del código de LeGrandHotel, sino del servidor de desarrollo.')]),
  p([t('Cómo se corrige: ', { bold: true }), t('en AWS la API corre con Nginx y PHP-FPM (varios procesos atendiendo a la vez), OPcache, MySQL en RDS y Redis para la caché. Allí se repetirán estas mismas pruebas con 50 → 100 usuarios (entrega del 25 %) y 1000 a 5000 usuarios (entrega del 80 %).')]),

  h1('8. Reporte HTML con gráficos'),
  p('Además del resumen en la terminal, cada corrida generó un reporte HTML (variables K6_WEB_DASHBOARD y K6_WEB_DASHBOARD_EXPORT). Se abre con doble clic en el navegador y muestra cómo cambiaron los usuarios, las peticiones por segundo y los tiempos durante el minuto de prueba.'),
  ...shot('d1-dashboard-50vu', 'Reporte HTML del escalón de 50 usuarios (salidas/3-escalon-50vu.html).'),
  table(['Gráfico del reporte', 'Qué muestra'], [
    ['Request Rate', 'Peticiones por segundo durante la prueba'],
    ['Request Duration', 'Tiempo de respuesta en cada momento (p95 y mediana)'],
    ['Request Failed', 'Peticiones fallidas por segundo (en todas las corridas fue 0)'],
    ['VUs', 'Usuarios virtuales activos: la subida, la meseta y la bajada del escalón'],
  ], [3.5, 7.5]),

  h1('9. Glosario: qué significa cada dato de k6'),
  table(['Dato', 'Qué significa', 'Cómo leerlo'], [
    ['VU (usuario virtual)', 'Un programa que repite el guion como una persona', 'Más VU = más carga a la vez'],
    ['iterations', 'Vueltas completas del guion', 'Cuánto trabajo se hizo'],
    ['iteration_duration', 'Cuánto tarda una vuelta, incluida la pausa', 'Sube si la API se pone lenta'],
    ['http_reqs', 'Total de peticiones y peticiones por segundo', 'Capacidad: cuánto atiende la API'],
    ['http_req_duration', 'Tiempo desde que se envía la petición hasta que llega toda la respuesta', 'El dato principal de velocidad'],
    ['avg', 'Promedio de los tiempos', 'Se distorsiona con valores extremos'],
    ['min / max', 'La respuesta más rápida y la más lenta', 'El máximo muestra el peor caso'],
    ['med (p50)', 'Mediana: la mitad de las respuestas tardó menos que esto', 'La experiencia típica'],
    ['p(90) / p(95) / p(99)', 'El 90 %, 95 % o 99 % de las respuestas tardó menos que esto', 'p95 es la meta habitual: casi todos los usuarios'],
    ['http_req_failed', 'Porcentaje de peticiones con error (4xx/5xx no esperados o sin respuesta)', 'Debe ser 0 % o casi'],
    ['expected_response:true', 'Los tiempos solo de las respuestas correctas', 'Evita que errores rápidos mejoren el promedio'],
    ['checks', 'Verificaciones del guion (código 200, JSON correcto…)', '✓ pasó · ✗ falló'],
    ['thresholds', 'Metas de la prueba', '✓ cumplida · ✗ no cumplida (código de salida 99)'],
    ['{tipo:lectura}', 'Métrica filtrada por etiqueta: solo las lecturas', 'Compara tipos de petición'],
    ['reserva_creada_ms', 'Métrica propia del proyecto: tiempo de crear una reserva', 'La operación más pesada'],
    ['vus / vus_max', 'Usuarios activos en el momento y el máximo reservado', 'Confirma la carga aplicada'],
    ['data_received / data_sent', 'Datos recibidos de la API y enviados a ella', 'Tamaño del tráfico'],
    ['setup()', 'Preparación que corre una vez antes de la prueba', 'Aquí: login de los usuarios de prueba'],
  ], [3, 4.8, 3.2]),

  h1('10. Conclusiones'),
  table(['Prueba', 'Resultado', 'Qué nos dice'], [
    ['1. Humo (5 VU, 30 s)', `✓ pasa · p95 ${ms(smoke.http_req_duration['p(95)'])} · 0 % errores`, 'La API, la base de datos y la caché funcionan; las rutas protegidas exigen sesión'],
    ['2. Límite de login', '✓ pasa · 429 en el 6.º intento', 'El login está protegido contra fuerza bruta'],
    ...ESCALONES.map((e) => [`${e.vus === 5 ? 3 : e.vus === 10 ? 4 : e.vus === 25 ? 5 : 6}. Escalón ${e.vus} VU`, `${e.meta ? '✓' : '✗'} p95 ${ms(e.p95)} · ${pct(e.failed)} errores`, e.vus === 50 ? 'Sin errores, pero el servidor de desarrollo hace cola' : 'Sin errores; tiempo de respuesta mayor a la meta']),
  ], [3, 3.8, 4.2]),
  gap(),
  bullet('La API es correcta y estable: en las 6 corridas no hubo ninguna petición fallida ni errores 500.'),
  bullet('La seguridad funciona bajo prueba: 401 sin token y 429 al pasar el límite de login, siempre en el formato JSON de la API.'),
  bullet('La velocidad no cumple la meta en la laptop porque el servidor de desarrollo de PHP atiende una petición a la vez. La corrección (PHP-FPM, OPcache, RDS y Redis) se aplicará al desplegar en AWS, donde se repetirán las pruebas con 100 y luego 1000 a 5000 usuarios.'),

  pageBreak(),
  h1('Anexo A. Cómo repetir las pruebas'),
  p('1. Levantar la API con los datos de prueba (PowerShell, desde la carpeta del proyecto):'),
  ...codeBlock([
    'cd api',
    'php artisan migrate',
    'php artisan db:seed --class=MassiveDataSeeder      # solo si la base está vacía',
    '$env:K6_USERS="50"; php artisan db:seed --class=LoadTestUsersSeeder',
    '$env:RATE_LIMIT_API="100000"; $env:RATE_LIMIT_LOGIN="100000"',
    'php -S localhost:8000 -t public public/index.php',
  ]),
  p('2. En otra ventana, desde la carpeta del proyecto, correr cada prueba (PowerShell):'),
  ...codeBlock([
    'k6 run -e BASE_URL=http://[::1]:8000/api/v1 -e VUS=5 -e DURATION=30s tests/k6/smoke.js',
    'k6 run -e BASE_URL=http://[::1]:8001/api/v1 tests/k6/rate-limit.js',
    'k6 run -e BASE_URL=http://[::1]:8000/api/v1 -e PROFILE=escalon -e VUS=50 -e USERS=50 tests/k6/reservas.js',
  ]),
  p('Para el límite de login se levanta una segunda API en el puerto 8001 con el límite real (RATE_LIMIT_LOGIN=5). Para guardar el reporte HTML, antes de k6 run:'),
  ...codeBlock([
    '$env:K6_WEB_DASHBOARD="true"',
    '$env:K6_WEB_DASHBOARD_EXPORT="docs/pruebas/informe-k6/salidas/3-escalon-50vu.html"',
  ]),
  p('En cmd las variables se escriben con set y comillas, por ejemplo: set "K6_WEB_DASHBOARD=true". Todas las corridas de este informe se pueden repetir de una vez con docs/pruebas/informe-k6/correr.sh (Git Bash).'),
  h1('Anexo B. Archivos'),
  table(['Archivo', 'Contenido'], [
    ['`tests/k6/*.js', 'Guiones de las pruebas'],
    ['`docs/pruebas/informe-k6/salidas/*.txt', 'Salida completa de la terminal de cada corrida'],
    ['`docs/pruebas/informe-k6/salidas/*.json', 'Resumen de cada corrida en JSON (fuente de las tablas)'],
    ['`docs/pruebas/informe-k6/salidas/*.html', 'Reporte con gráficos de cada corrida'],
    ['`docs/pruebas/informe-k6/graficos.py', 'Genera los gráficos de la sección 7.3'],
  ], [5.5, 5.5]),
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
  title: 'LeGrandHotel – Pruebas de carga con k6',
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

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('OK', OUT, `${figure} figuras`) })
