// Genera docs/pruebas/informe-k6/LeGrandHotel_Tutorial_k6.docx: los pasos para correr k6 de principio a fin,
// con el comando de PowerShell y de cmd, qué se debe ver y por qué se hace cada paso.
//   node docs/pruebas/informe-k6/generar-tutorial-k6.js <logo_tecsup.jpg>
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  HeadingLevel, PageBreak, Footer, PageNumber, LevelFormat, BorderStyle, ShadingType, TableOfContents, VerticalAlign,
} = require('docx')

const BASE = 'C:/Proyectos/LeGrandHotel/docs/pruebas/informe-k6'
const LOGO = process.argv[2]
const OUT = path.join(BASE, 'LeGrandHotel_Tutorial_k6.docx')
const SHOTS = path.join(BASE, 'capturas')

const FONT = 'Times New Roman'
const CODE = 'Consolas'
const CM = 567
const PAGE_W = 11906 - 2 * Math.round(2.5 * CM)

// ── helpers ─────────────────────────────────────────────
const t = (text, o = {}) => new TextRun({ text, font: FONT, size: 24, ...o })
const b = (text) => t(text, { bold: true })
const c = (text) => new TextRun({ text, font: CODE, size: 19 })
const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [t(children)], spacing: { after: 120, line: 300 }, ...o })
const center = (children, o = {}) => p(children, { alignment: AlignmentType.CENTER, ...o })
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 240, after: 160 } })
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: FONT })], spacing: { before: 200, after: 120 } })
const bullet = (children) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: Array.isArray(children) ? children : [t(children)], spacing: { after: 60, line: 288 } })
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })
const caption = (text) => center([t(text, { italics: true, size: 20 })], { spacing: { after: 200 } })

/** Bloque de comandos con una etiqueta (PowerShell / cmd). */
function cmd(label, lines) {
  return [
    new Paragraph({ keepNext: true, spacing: { before: 60, after: 0 }, children: [t(label, { bold: true, size: 20, color: '444444' })] }),
    ...lines.map((l, i) => new Paragraph({
      keepNext: i < lines.length - 1, keepLines: true,
      children: [c(l)], spacing: { after: i === lines.length - 1 ? 140 : 0, line: 250 },
      shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' }, indent: { left: 200 },
    })),
  ]
}
const ps = (...lines) => cmd('PowerShell', lines)
const cm = (...lines) => cmd('cmd', lines)
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
const gap = () => p('', { spacing: { after: 80 } })

// ── carátula (skill caratula-tecsup) ─────────────────────
const cov = (text, o = {}, spacingAfter = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 360, after: spacingAfter }, children: [t(text, o)] })
const caratula = [
  cov('INSTITUTO TECNOLÓGICO SUPERIOR TECSUP', { bold: true }),
  cov('DISEÑO Y DESARROLLO DE SOFTWARE', {}, 240),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(LOGO), transformation: { width: 189, height: 113 } })] }),
  cov('CURSO: DESARROLLO DE SOLUCIONES EN LA NUBE', { bold: true }),
  cov('PROYECTO:', { bold: true }),
  cov('LeGrandHotel – Sistema web de gestión de hospedaje', { bold: true }, 240),
  cov('TUTORIAL: PRUEBAS DE CARGA CON K6 PASO A PASO', { bold: true }),
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

const API = 'http://127.0.0.1:8000/api/v1'

// ── contenido ─────────────────────────────────────────────
const body = [
  p([t('Índice', { bold: true, size: 30 })], { spacing: { after: 160 } }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  pageBreak(),

  h1('1. Antes de empezar'),
  p('Este tutorial explica, de principio a fin, cómo hacer las pruebas de carga de LeGrandHotel con k6 en una computadora con Windows, y por qué se hace cada paso. Al terminar tendrás los resultados en la terminal y un reporte HTML con gráficos de cada prueba.'),
  h2('1.1 Qué vamos a probar y por qué'),
  p('Una prueba de carga simula a muchas personas usando el sistema al mismo tiempo. Sirve para saber, antes de que pase con usuarios reales, si la API sigue respondiendo rápido y sin errores cuando hay mucho movimiento (por ejemplo, la recepción llena en temporada alta). k6 lo hace con «usuarios virtuales» (VU): programas que repiten un guion de peticiones como si fueran personas.'),
  table(['Prueba', 'Pregunta que responde', 'Guion'], [
    ['Humo (smoke)', '¿La API, la base de datos y la caché funcionan?', '`tests/k6/smoke.js'],
    ['Límite de login', '¿La API bloquea a quien prueba contraseñas sin parar?', '`tests/k6/rate-limit.js'],
    ['Escalones 5 → 50 VU', '¿Cuánto tarda la API a medida que hay más usuarios a la vez?', '`tests/k6/reservas.js'],
  ], [2.6, 5.4, 3]),
  h2('1.2 El recorrido completo'),
  table(['Paso', 'Qué se hace', 'Por qué'], [
    ['1', 'Instalar k6', 'Es la herramienta que genera la carga'],
    ['2', 'Levantar la base de datos', 'La API necesita sus datos para responder'],
    ['3', 'Cargar datos de prueba', 'Con una base vacía las consultas son instantáneas y la prueba no dice nada real'],
    ['4', 'Crear los usuarios de prueba', 'Los VU inician sesión como recepcionistas, igual que el personal real'],
    ['5', 'Ajustar los límites de peticiones', 'Si no, la API bloquea a k6 con 429 y se mide el bloqueo, no la velocidad'],
    ['6', 'Levantar la API', 'k6 necesita una dirección a la que mandar las peticiones'],
    ['7', 'Comprobar que la API está sana', 'Si algo falla antes de empezar, la prueba no sirve'],
    ['8–10', 'Correr las tres pruebas', 'Cada una responde una pregunta distinta'],
    ['11', 'Leer los resultados', 'Decidir si la prueba pasó y qué hay que mejorar'],
    ['12', 'Limpiar y dejar todo como estaba', 'Las pruebas crean reservas falsas y bajan la protección del login'],
  ], [1, 4.3, 5.7]),
  h2('1.3 Qué necesitas'),
  bullet('Windows 10 u 11 con el proyecto LeGrandHotel descargado (carpeta C:\\Proyectos\\LeGrandHotel).'),
  bullet('PHP 8.2 y Composer, con las dependencias del proyecto instaladas (composer install dentro de api).'),
  bullet('Docker Desktop, para la base de datos MySQL.'),
  bullet('Dos ventanas de terminal: una para la API (queda ocupada mientras está encendida) y otra para k6.'),
  p([b('Nota: '), t('todos los comandos se escriben desde la carpeta del proyecto, salvo que el paso diga otra cosa. Cada paso trae la versión para PowerShell y para cmd (Símbolo del sistema), porque las variables se escriben distinto en cada una.')]),

  h1('2. Paso 1: instalar k6'),
  ...ps('winget install k6 --source winget'),
  p('Cierra la terminal y abre una nueva (para que Windows encuentre el comando k6). Luego:'),
  ...ps('k6 version'),
  por('k6 es un programa aparte del proyecto. winget es el instalador oficial de Windows: descarga k6 de Grafana y lo agrega al PATH, así el comando k6 funciona desde cualquier carpeta. Se abre una terminal nueva porque las ya abiertas no ven el PATH actualizado.'),
  ver('la versión instalada, por ejemplo «k6.exe v2.2.0». En cmd el comando es el mismo.'),
  ...shot('t0-version', 'k6 instalado: el comando k6 version responde.'),

  h1('3. Paso 2: levantar la base de datos'),
  p('Abre Docker Desktop y espera a que diga que está corriendo. Después, desde la carpeta del proyecto:'),
  ...ps('docker compose up -d mysql'),
  por('el proyecto usa MySQL 8 dentro de Docker, así todos tenemos la misma versión sin instalarla en Windows. Se levanta solo el servicio mysql (y no todo el docker compose) porque el contenedor nginx del proyecto usa el puerto 8000, el mismo que usaremos para la API; si los dos están encendidos, k6 habla con el equivocado y recibe 503.'),
  ver('«Container legrandhotel-mysql-1 Started». En cmd el comando es el mismo.'),

  h1('4. Paso 3: crear las tablas y cargar datos de prueba'),
  ...ps('cd api', 'php artisan migrate', 'php artisan db:seed --class=DemoSeeder', 'php artisan db:seed --class=MassiveDataSeeder'),
  por('migrate crea las tablas. DemoSeeder carga los roles, tipos de habitación, habitaciones e insumos de demostración. MassiveDataSeeder agrega 1000 huéspedes y 5000 reservas: una prueba de carga sobre una base casi vacía da tiempos irreales, porque buscar en 10 filas es instantáneo y en miles no.'),
  ver('cada seeder termina con «DONE». Si la base ya tenía estos datos (por ejemplo, ya lo hiciste antes), no vuelvas a correr MassiveDataSeeder: agregaría otras 5000 reservas.'),

  h1('5. Paso 4: crear los usuarios de prueba'),
  ...ps('$env:K6_USERS="50"', 'php artisan db:seed --class=LoadTestUsersSeeder'),
  ...cm('set "K6_USERS=50"', 'php artisan db:seed --class=LoadTestUsersSeeder'),
  por('cada usuario virtual inicia sesión como un recepcionista distinto (k6-0@carga.legrandhotel.test hasta k6-49@…), con su propio token, igual que el personal real. Si todos usaran la misma cuenta la prueba sería menos realista. Se crean 50 porque la prueba más grande usa 50 usuarios a la vez. Son cuentas solo para pruebas: nunca se crean en la base de producción.'),
  ver('«DONE». La variable K6_USERS le dice al seeder cuántas cuentas crear.'),
  p([b('Ojo en cmd: '), t('escribe set "VARIABLE=valor" con las comillas así. Si escribes set VARIABLE=valor && otro-comando, cmd guarda un espacio al final del valor y la variable queda mal.')]),

  h1('6. Paso 5: ajustar los límites de peticiones'),
  p('Abre api\\.env y deja estas tres líneas así:'),
  ...cmd('api\\.env', ['RATE_LIMIT_API=100000', 'RATE_LIMIT_LOGIN=100000', 'RATE_LIMIT_REGISTER=100000']),
  p('Luego limpia la configuración guardada:'),
  ...ps('php artisan config:clear'),
  por('la API protege el login (5 intentos por minuto) y el resto de rutas (60 por minuto) contra abusos. k6 manda cientos de peticiones desde la misma computadora, así que con los límites normales la API lo bloquearía con 429 y estaríamos midiendo el bloqueo, no la velocidad. config:clear asegura que Laravel lea los valores nuevos del .env.'),
  p([b('Importante: '), t('esto es solo para la prueba. En el paso 12 se vuelven a poner los valores normales.')]),

  h1('7. Paso 6: levantar la API'),
  p('En la primera terminal, dentro de la carpeta api:'),
  ...ps('php -S 127.0.0.1:8000 -t public public/index.php'),
  por('k6 necesita una dirección a la que mandar las peticiones. Se usa el servidor integrado de PHP en la dirección 127.0.0.1 (y no «localhost») porque en Windows localhost puede resolverse a la dirección IPv6 (::1) en un programa y a la IPv4 (127.0.0.1) en otro; si el servidor escucha en una y k6 llama a la otra, el 100 % de las peticiones fallan. Escribir 127.0.0.1 en los dos lados evita ese problema. Se usa php -S y no php artisan serve porque artisan serve no pasa las variables de entorno a la API, y en el paso 9 las necesitamos.'),
  ver('«Development Server (http://127.0.0.1:8000) started». Esta terminal queda ocupada: no la cierres mientras dure la prueba. En cmd el comando es el mismo.'),
  p([b('Nota sobre las capturas: '), t('las capturas de este tutorial se tomaron con la API escuchando en la dirección IPv6 [::1]. Con 127.0.0.1 los comandos cambian solo en la dirección y la respuesta de k6 es la misma.')]),

  h1('8. Paso 7: comprobar que la API está sana'),
  p('En la segunda terminal, desde la carpeta del proyecto:'),
  ...ps(`curl.exe -s ${API}/health`),
  por('si la API, la base de datos o la caché fallan antes de empezar, la prueba de carga solo mostraría errores y no sabríamos por qué. /health responde en un segundo si todo está bien. En PowerShell se escribe curl.exe (con .exe) porque «curl» solo es un alias de otro comando.'),
  ver('un JSON con "status":"ok" en app, database y cache.'),
  ...shot('t0-health', 'Respuesta de /health: la API está lista para la prueba.'),

  h1('9. Paso 8: prueba de humo (smoke)'),
  ...ps(`k6 run -e BASE_URL=${API} -e VUS=5 -e DURATION=30s tests/k6/smoke.js`),
  ...cm(`k6 run -e BASE_URL=${API} -e VUS=5 -e DURATION=30s tests/k6/smoke.js`),
  table(['Parte del comando', 'Qué significa'], [
    ['`k6 run', 'Ejecuta un guion de k6'],
    ['`-e BASE_URL=...', 'Le pasa al guion la dirección de la API (-e = variable para el guion)'],
    ['`-e VUS=5', '5 usuarios virtuales a la vez'],
    ['`-e DURATION=30s', 'La prueba dura 30 segundos'],
    ['`tests/k6/smoke.js', 'El guion: pide /health y una ruta protegida sin token'],
  ], [3.5, 7.5]),
  gap(),
  por('es la prueba más pequeña y va siempre primero: confirma que todo funciona con poca carga. Si esta falla, no tiene sentido seguir con las grandes, porque cualquier error vendría de algo roto y no de la carga. Además verifica que una ruta protegida sin sesión responda 401 en JSON (seguridad).'),
  ver('las tres metas con ✓ (THRESHOLDS) y los cuatro checks con ✓. Dura unos 30 segundos.'),
  ...shot('t1-smoke', 'Prueba de humo aprobada: todas las metas y verificaciones con ✓.'),

  h1('10. Paso 9: prueba del límite de login'),
  p('Esta prueba necesita el límite real de login. En una tercera terminal, dentro de la carpeta api, levanta una segunda API en el puerto 8001 con el límite de 5 intentos:'),
  ...ps('$env:RATE_LIMIT_LOGIN="5"', 'php -S 127.0.0.1:8001 -t public public/index.php'),
  ...cm('set "RATE_LIMIT_LOGIN=5"', 'php -S 127.0.0.1:8001 -t public public/index.php'),
  p('Y en la terminal de k6:'),
  ...ps('k6 run -e BASE_URL=http://127.0.0.1:8001/api/v1 tests/k6/rate-limit.js'),
  por('en el paso 5 subimos los límites para las pruebas de velocidad, pero también hay que demostrar que la protección funciona. Se usa una segunda API con la variable RATE_LIMIT_LOGIN=5 (la variable de la terminal tiene prioridad sobre el .env), así no hay que editar el .env ni apagar la primera. El guion intenta entrar 6 veces con una contraseña incorrecta: los 5 primeros deben dar 401 y el sexto 429 «demasiados intentos».'),
  ver('«Estados recibidos: 401, 401, 401, 401, 401, 429» y los tres checks con ✓. Dura unos 3 segundos. Al terminar, cierra esta tercera terminal con Ctrl + C.'),
  ...shot('t2-rate-limit', 'El sexto intento de login recibe 429: la protección funciona.'),

  h1('11. Paso 10: pruebas de carga por escalones'),
  p('Se corre el mismo guion cuatro veces, cada vez con más usuarios: 5, 10, 25 y 50. Primero se activa el reporte HTML y luego se corre la prueba:'),
  ...ps(
    '$env:K6_WEB_DASHBOARD="true"',
    '$env:K6_WEB_DASHBOARD_EXPORT="docs/pruebas/escalon-5vu.html"',
    `k6 run -e BASE_URL=${API} -e PROFILE=escalon -e VUS=5 -e USERS=5 tests/k6/reservas.js`,
  ),
  ...cm(
    'set "K6_WEB_DASHBOARD=true"',
    'set "K6_WEB_DASHBOARD_EXPORT=docs/pruebas/escalon-5vu.html"',
    `k6 run -e BASE_URL=${API} -e PROFILE=escalon -e VUS=5 -e USERS=5 tests/k6/reservas.js`,
  ),
  p('Luego repite las líneas 2 y 3 cambiando el 5 por 10, después por 25 y por último por 50 (en el nombre del archivo, en VUS y en USERS).'),
  table(['Parte del comando', 'Qué significa'], [
    ['`K6_WEB_DASHBOARD=true', 'Activa el reporte con gráficos'],
    ['`K6_WEB_DASHBOARD_EXPORT=...', 'Dónde guardar el reporte HTML al terminar'],
    ['`-e PROFILE=escalon', 'Sube a los usuarios en 10 s, los mantiene 45 s y baja en 5 s'],
    ['`-e VUS=5', 'Cuántos usuarios a la vez'],
    ['`-e USERS=5', 'Cuántas cuentas de recepcionista usar (una por usuario virtual)'],
    ['`tests/k6/reservas.js', 'El trabajo de recepción: 70 % consultas, 20 % login, 10 % crear reservas'],
  ], [3.8, 7.2]),
  gap(),
  por('una sola corrida con muchos usuarios dice si la API aguanta, pero no desde cuándo empieza a ponerse lenta. Subir por escalones muestra la tendencia: si el tiempo de respuesta se mantiene, la API escala; si crece con cada escalón, hay un cuello de botella. El escenario imita el trabajo real de la recepción (sobre todo consultas, algunos inicios de sesión y reservas nuevas) para que el resultado se parezca al uso del hotel. El reporte HTML queda como evidencia y muestra cómo cambió todo segundo a segundo.'),
  ver('cada corrida dura 1 minuto. Las metas son p95 < 500 ms y menos de 1 % de errores. En la laptop la de velocidad sale con ✗ (ver el paso 11) y la de errores con ✓.'),
  ...shot('t3-escalon-50vu', 'Escalón de 50 usuarios: sin errores, pero el tiempo de respuesta supera la meta.'),
  p('Para ver el reporte, abre el archivo docs\\pruebas\\escalon-50vu.html con doble clic:'),
  ...shot('d1-dashboard-50vu', 'Reporte HTML: usuarios, peticiones por segundo y tiempos durante la prueba.', 14),

  h1('12. Paso 11: leer los resultados'),
  p('Al final de cada prueba k6 muestra un resumen. Estos son los datos que hay que mirar, en este orden:'),
  table(['Orden', 'Dónde mirar', 'Qué significa', 'Está bien si…'], [
    ['1', 'THRESHOLDS', 'Las metas de la prueba', 'Todas tienen ✓'],
    ['2', 'http_req_failed', 'Porcentaje de peticiones con error', '0 % o casi'],
    ['3', 'checks_succeeded', 'Verificaciones del guion que pasaron', '100 %'],
    ['4', 'http_req_duration p(95)', 'El 95 % de las respuestas tardó menos que esto', 'Menor a la meta (500 ms)'],
    ['5', 'http_req_duration med', 'La mitad de las respuestas tardó menos que esto (lo típico)', 'Bastante menor que p95'],
    ['6', 'http_reqs', 'Peticiones totales y por segundo', 'Sube cuando suben los usuarios'],
  ], [1, 3.2, 4.3, 2.5]),
  gap(),
  p([b('Por qué se mira p95 y no el promedio: '), t('el promedio esconde a los usuarios que esperan mucho. p95 dice cuánto esperó casi todo el mundo (95 de cada 100), que es lo que sienten las personas en la recepción.')]),
  p([b('Si una meta sale con ✗: '), t('k6 muestra «thresholds ... have been crossed» y termina con código 99. Eso no es un error de k6, es k6 diciendo que la prueba no se aprobó.')]),
  h2('12.1 Qué salió en nuestras pruebas'),
  table(['Usuarios', 'p95', 'Pet./s', 'Errores'], [
    ['5', '610 ms', '4.8', '0 %'], ['10', '1.8 s', '4.9', '0 %'], ['25', '4.6 s', '4.8', '0 %'], ['50', '9.3 s', '4.8', '0 %'],
  ], [2, 3, 3, 3]),
  gap(),
  p('Las peticiones por segundo se quedan fijas en ~4.8 y el tiempo crece con los usuarios: es la señal de un cuello de botella. La causa es el servidor integrado de PHP, que atiende una petición a la vez. No hubo ningún error: la API va lenta, pero no se cae. En AWS, con Nginx y PHP-FPM (varios procesos a la vez), las mismas pruebas deben cumplir la meta. El detalle está en el «Informe de pruebas de carga con k6».'),

  h1('13. Paso 12: limpiar y dejar todo como estaba'),
  p('1. Borra las reservas que crearon los usuarios virtuales. Antes de la primera prueba, la última reserva era la 5000 (puedes confirmarlo con el primer comando antes de empezar):'),
  ...ps(
    'cd api',
    'php artisan tinker --execute="echo App\\Models\\Reservation::max(\'id\');"',
    'php artisan tinker --execute="echo App\\Models\\Reservation::where(\'id\', \'>\', 5000)->delete();"',
  ),
  p('2. Vuelve a poner los límites normales en api\\.env y limpia la configuración:'),
  ...cmd('api\\.env', ['RATE_LIMIT_API=60', 'RATE_LIMIT_LOGIN=5', 'RATE_LIMIT_REGISTER=3']),
  ...ps('php artisan config:clear'),
  p('3. Apaga la API con Ctrl + C en su terminal y, si ya no la usas, la base de datos:'),
  ...ps('docker compose stop mysql'),
  por('la prueba crea reservas falsas a nombre de huéspedes de demostración, que ensucian los reportes de ocupación e ingresos. Y con los límites en 100000 el login queda sin protección contra quien prueba contraseñas: hay que devolverlos a sus valores normales. Los usuarios k6-… pueden quedarse para la siguiente prueba; son solo de la base local.'),

  h1('14. Si algo sale mal'),
  table(['Lo que ves', 'Por qué pasa', 'Qué hacer'], [
    ['«k6 no se reconoce como un comando»', 'La terminal se abrió antes de instalar k6', 'Cierra la terminal y abre una nueva'],
    ['100 % de peticiones fallidas (http_req_failed 100 %)', 'La API escucha en IPv6 y k6 llama por IPv4, o al revés', 'Usa 127.0.0.1 en el comando de la API y en BASE_URL'],
    ['setup: «La API no está sana ... 503»', 'El contenedor nginx de Docker ocupa el puerto 8000', 'docker compose down y luego docker compose up -d mysql'],
    ['«No se pudo iniciar sesión con k6-0@... (401)»', 'Faltan los usuarios de prueba', 'Repite el paso 4'],
    ['«No se pudo iniciar sesión ... (429)»', 'Los límites siguen bajos', 'Repite el paso 5 (incluido config:clear) y reinicia la API'],
    ['«No hay clientes: corre MassiveDataSeeder»', 'La base no tiene huéspedes', 'Repite el paso 3'],
    ['La prueba de login da 401 en los 6 intentos', 'La API del puerto 8001 no tomó el límite de 5', 'Levántala con la variable RATE_LIMIT_LOGIN=5 en esa misma terminal'],
    ['En cmd la variable no funciona', 'set sin comillas guarda espacios de más', 'Escribe set "VARIABLE=valor"'],
    ['«report generation was skipped»', 'La prueba duró muy poco para hacer gráficos', 'Es normal en la prueba de login; no es un error'],
  ], [3.6, 3.6, 3.8]),

  h1('15. Resumen de comandos'),
  p('Todo el recorrido en PowerShell, en orden:'),
  ...ps(
    '# Terminal 1 (preparación y API)',
    'docker compose up -d mysql',
    'cd api',
    'php artisan migrate',
    'php artisan db:seed --class=DemoSeeder',
    'php artisan db:seed --class=MassiveDataSeeder',
    '$env:K6_USERS="50"; php artisan db:seed --class=LoadTestUsersSeeder',
    '# (editar api\\.env: RATE_LIMIT_* = 100000)',
    'php artisan config:clear',
    'php -S 127.0.0.1:8000 -t public public/index.php',
    '',
    '# Terminal 2 (pruebas, desde la carpeta del proyecto)',
    `curl.exe -s ${API}/health`,
    `k6 run -e BASE_URL=${API} -e VUS=5 -e DURATION=30s tests/k6/smoke.js`,
    'k6 run -e BASE_URL=http://127.0.0.1:8001/api/v1 tests/k6/rate-limit.js   # con la API 8001 encendida',
    '$env:K6_WEB_DASHBOARD="true"',
    '$env:K6_WEB_DASHBOARD_EXPORT="docs/pruebas/escalon-50vu.html"',
    `k6 run -e BASE_URL=${API} -e PROFILE=escalon -e VUS=50 -e USERS=50 tests/k6/reservas.js`,
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
  title: 'LeGrandHotel – Tutorial de pruebas con k6',
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
