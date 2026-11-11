import { t } from './i18n'

/** Un paso del tutorial de una pantalla. Sin `target`, la burbuja va al centro. */
export interface PasoPagina {
  target?: string
  title: string
  text: string
}

/*
 * Las pantallas comparten la misma estructura, así que los pasos apuntan a ella en vez de
 * marcar cada archivo: el título con su botón principal, las pestañas de filtro, la barra de
 * búsqueda, la tabla, los botones de cada fila y el paginado. <Tour> salta los pasos cuyo
 * elemento no está en la pantalla, así que sobra con describir lo que sí existe.
 */
const TITULO = '.title-row .actions'
const FILTROS = '.tabs'
const BUSCAR = '.toolbar'
const TABLA = 'table.data'
const FILA = 'td.row-actions'
const PAGINAS = '.pagination'

const intro = (title: string, text: string): PasoPagina => ({ title, text })

/** Tutorial de cada pestaña: qué se puede hacer y qué hace cada botón. */
export const TUTORIALES: Record<string, () => PasoPagina[]> = {
  '/panel': () => [
    intro(t('Panel'), t('El resumen del día: cuánto está ocupado el hotel, quién llega y quién sale, y qué insumos faltan.')),
    { target: '.kpis', title: t('Los cuatro números'), text: t('Ocupación de ahora, habitaciones libres, llegadas de hoy e ingresos del mes.') },
    { target: '.rack-filters', title: t('Filtros del tablero'), text: t('Muestra un solo piso, o solo las libres, ocupadas, en limpieza o en mantenimiento. El número entre paréntesis dice cuántas hay.') },
    { target: '.rack', title: t('Tablero de habitaciones'), text: t('Cada recuadro es una habitación: azul si está ocupada, ámbar en limpieza y rayada en mantenimiento. Haz clic en una para editarla.') },
    { target: TITULO, title: t('Nueva reserva'), text: t('Abre el formulario de reserva sin pasar por la pestaña Reservas.') },
  ],

  '/reservas': () => [
    intro(t('Reservas'), t('Aquí registras quién va a venir, en qué habitación y en qué fechas. La reserva se convierte en estadía cuando el huésped llega.')),
    { target: TITULO, title: t('Nueva reserva'), text: t('Eliges al huésped, las fechas y una habitación libre. El total se calcula solo con el precio por noche.') },
    { target: FILTROS, title: t('Filtros por estado'), text: t('Por confirmar, confirmadas, en curso, finalizadas o canceladas.') },
    { target: BUSCAR, title: t('Buscar'), text: t('Por nombre o número de documento del huésped.') },
    { target: FILA, title: t('Botones de cada reserva'), text: t('«Check-in» marca la llegada y abre la estadía. «Cancelar» la anula y libera la habitación. «Eliminar» la borra del todo.') },
    { target: PAGINAS, title: t('Páginas'), text: t('El listado trae 15 por página; aquí avanzas.') },
  ],

  '/estadias': () => [
    intro(t('Estadías'), t('Los huéspedes que ya están alojados. Una estadía nace del check-in de una reserva.')),
    { target: FILTROS, title: t('En curso e Historial'), text: t('«En curso» son los que están ahora en el hotel; «Historial», los que ya se fueron.') },
    { target: FILA, title: t('Check-out'), text: t('Cierra la estadía, libera el espacio de cochera y manda la habitación a limpieza.') },
    { target: TABLA, title: t('La tabla'), text: t('Habitación, huésped, fecha de entrada y de salida, y el total a cobrar.') },
  ],

  '/habitaciones': () => [
    intro(t('Habitaciones'), t('El estado de cada habitación del hotel. Al hacer check-out pasa a limpieza; márcala libre cuando esté lista.')),
    { target: TITULO, title: t('Nueva habitación'), text: t('Número, piso, tipo y estado. El número no se puede repetir.') },
    { target: FILTROS, title: t('Filtros por estado'), text: t('Todas, libres, ocupadas, en limpieza o en mantenimiento.') },
    { target: FILA, title: t('Botones de cada habitación'), text: t('«Marcar lista» pasa de limpieza a libre. «Editar» cambia sus datos. «Eliminar» la borra si no tiene reservas.') },
  ],

  '/tipos-habitacion': () => [
    intro(t('Tipos de habitación'), t('Las categorías del hotel: Simple, Doble, Matrimonial y Suite. De aquí salen el precio y la capacidad de cada habitación.')),
    { target: TITULO, title: t('Nuevo tipo'), text: t('Nombre, capacidad, precio por noche y los servicios que incluye.') },
    { target: FILA, title: t('Editar y eliminar'), text: t('«Editar» cambia el precio o los servicios y afecta a las reservas nuevas. «Eliminar» solo funciona si ninguna habitación usa ese tipo.') },
  ],

  '/clientes': () => [
    intro(t('Clientes'), t('Las fichas de los huéspedes. Se usan al registrar una reserva desde recepción.')),
    { target: TITULO, title: t('Nuevo cliente'), text: t('Nombre, tipo y número de documento. El documento no se puede repetir.') },
    { target: BUSCAR, title: t('Buscar'), text: t('Por nombre o por número de documento.') },
    { target: FILA, title: t('Editar y eliminar'), text: t('«Editar» corrige los datos. «Eliminar» borra la ficha si no tiene reservas.') },
  ],

  '/cochera': () => [
    intro(t('Cochera'), t('Los espacios de estacionamiento y los autos que hay dentro.')),
    { target: FILTROS, title: t('Vehículos y Espacios'), text: t('«Vehículos» muestra los autos dentro; «Espacios», los lugares y si están libres u ocupados.') },
    { target: TITULO, title: t('Registrar entrada y Agregar espacio'), text: t('«Registrar entrada» anota un auto con su placa y el espacio que ocupa. «Agregar espacio» crea un lugar nuevo.') },
    { target: FILA, title: t('Registrar salida'), text: t('Marca que el auto se fue y deja el espacio libre.') },
  ],

  '/inventario': () => [
    intro(t('Inventario'), t('Los insumos del hotel. El stock no se escribe a mano: cambia con los movimientos de entrada y salida.')),
    { target: TITULO, title: t('Nuevo insumo'), text: t('Nombre, unidad y stock mínimo. El stock inicial solo se pone al crearlo.') },
    { target: FILA, title: t('Movimiento, Editar y Eliminar'), text: t('«Movimiento» registra una entrada o una salida y recalcula el stock. «Editar» cambia el nombre, la unidad o el mínimo. «Eliminar» borra el insumo.') },
    { target: TABLA, title: t('Bajo el mínimo'), text: t('Los insumos que quedaron por debajo de su mínimo se marcan para reponer, y también salen en el Panel.') },
  ],

  '/usuarios': () => [
    intro(t('Personal y usuarios'), t('Todas las cuentas del sistema: las del equipo del hotel y las de los clientes que entran con Google.')),
    { target: TITULO, title: t('Agregar persona'), text: t('Crea de una vez la ficha de la persona y la cuenta con la que entra. Su cargo sale del rol que le das.') },
    { target: FILTROS, title: t('Filtros por rol'), text: t('Muestra solo administradores, recepcionistas, almaceneros, programador o clientes.') },
    { target: BUSCAR, title: t('Buscar'), text: t('Por nombre o por correo.') },
    { target: FILA, title: t('Editar y eliminar'), text: t('«Editar» cambia el nombre, el correo, la contraseña, los roles y la fecha de ingreso. «Eliminar» borra la cuenta.') },
    { target: TABLA, title: t('Los roles'), text: t('Una cuenta puede tener varios roles. El de Programador no se da ni se quita desde aquí: hay uno solo.') },
  ],

  '/reportes': () => [
    intro(t('Reportes'), t('Dos miradas al negocio: cuánto se ocupó el hotel y cuánto se facturó.')),
    { target: BUSCAR, title: t('El rango de fechas'), text: t('Elige desde cuándo y hasta cuándo quieres ver los números.') },
    { target: 'main', title: t('Ocupación e ingresos'), text: t('La ocupación es el porcentaje de noches vendidas; los ingresos suman las reservas confirmadas y cerradas, mes a mes.') },
  ],

  '/auditoria': () => [
    intro(t('Auditoría'), t('El registro de quién cambió qué y cuándo. Sirve para rastrear un error o un cambio indebido.')),
    { target: BUSCAR, title: t('Filtros'), text: t('Puedes acotar por tipo de registro o por fecha.') },
    { target: TABLA, title: t('Cada línea'), text: t('Dice la acción, el registro afectado, quién la hizo y a qué hora. Es solo de lectura: no se puede borrar ni editar.') },
  ],

  '/programador': () => [
    intro(t('Vista del programador'), t('El estado técnico del sistema. Sirve para revisar una falla sin entrar al servidor.')),
    { target: FILTROS, title: t('Las pestañas'), text: t('Resumen de salud, peticiones recientes, errores y rutas de la API.') },
    { target: 'main', title: t('Para qué sirve'), text: t('Si algo falla, aquí ves el código del incidente que devolvió la API y puedes buscarlo en los registros.') },
  ],

  // ── Pantallas del cliente ─────────────────────────────
  '/reservar': () => [
    intro(t('Reservar una habitación'), t('En tres pasos: eliges tus fechas, miras lo que hay libre y reservas.')),
    { target: '.search-bar', title: t('1. Tus fechas'), text: t('Pon la llegada, la salida y cuántas personas van. Solo se muestran los tipos con sitio para ese número.') },
    { target: '.offers', title: t('2. Lo que hay libre'), text: t('Cada tarjeta es un tipo de habitación: lo que incluye, cuántas quedan y el total por todas las noches.') },
    { target: '.offer .btn-primary', title: t('3. Reservar'), text: t('Te pedimos confirmar. Si te falta el DNI o el celular, te los pide ahí mismo; si ya los tienes, te dice a nombre de quién queda.') },
    { target: '[data-tour="/mis-reservas"]', title: t('Y después'), text: t('Tu reserva queda en «Mis reservas». Recepción hace el check-in cuando llegas.') },
  ],

  '/mis-reservas': () => [
    intro(t('Mis reservas'), t('Todas tus reservas, con su estado y lo que vas a pagar. Recepción ve lo mismo que tú.')),
    { target: TABLA, title: t('Lo que ves de cada una'), text: t('La habitación, las fechas, cuántas noches y el total. El estado dice si está por confirmar, confirmada, en curso o finalizada.') },
    { target: FILA, title: t('Cancelar'), text: t('Puedes cancelar mientras la estadía no haya empezado; te pide confirmar antes. Una vez que hiciste el check-in ya no se puede.') },
    { target: PAGINAS, title: t('Páginas'), text: t('Si tienes muchas, aquí avanzas entre ellas.') },
  ],

  '/perfil': () => [
    intro(t('Mi perfil'), t('Tus datos. El DNI y el celular son necesarios para reservar; puedes ponerlos aquí o al momento de reservar.')),
    { target: 'form', title: t('Lo que puedes cambiar'), text: t('El nombre, el DNI y el celular. El correo viene de Google y no se puede cambiar.') },
  ],

  '/configuracion': () => [
    intro(t('Configuración'), t('Cómo se ve el sistema en este navegador. Los cambios se aplican al instante y solo te afectan a ti.')),
    { target: '.settings', title: t('Tema, idioma y tutorial'), text: t('Cambia entre claro y oscuro, entre español e inglés, y vuelve a ver el tutorial general cuando quieras.') },
  ],
}

/** Pasos del tutorial de una ruta, o null si esa pantalla no tiene. */
export const tutorialDe = (ruta: string): PasoPagina[] | null => TUTORIALES[ruta]?.() ?? null
