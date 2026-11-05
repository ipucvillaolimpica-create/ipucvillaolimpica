/**
 * Sistema Administrativo y Contable — Iglesia Pentecostal Unida de Colombia
 * Una congregación. Google Apps Script + Google Sheets + PDF en Drive.
 *
 * Primer uso (desde el editor de Apps Script):
 *   1. Ejecutar setup()  → crea la hoja de datos, la carpeta de Drive, el usuario ADMIN y el disparador diario.
 *   2. Implementar → Nueva implementación → Aplicación web (ver README.md para la opción de acceso).
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const APP = {
  NOMBRE: 'Sistema Administrativo y Contable',
  VERSION: '2026.11.05-d',
  LEMA: 'Un Señor, una fe, un bautismo',
  IGLESIA: 'IGLESIA PENTECOSTAL UNIDA DE COLOMBIA',
  WEB_NACIONAL: 'www.ipuc.org.co',
  TZ: 'America/Bogota',
  HORA_REPORTE_DIARIO: 23, // 11 p. m.
};

// Colores institucionales (Manual de Identidad Corporativa IPUC, pág. 14)
const COLORES = {
  AZUL_OSCURO: '#00338D', // Pantone 287C · RGB 0/51/141
  AZUL_CLARO: '#009FDA',  // Pantone Process Cyan C · RGB 0/159/218
  AMARILLO: '#F0AB00',    // Pantone 130C · RGB 240/171/0
};

const HOJAS = {
  CONFIG: 'Config',
  USUARIOS: 'Usuarios',
  MIEMBROS: 'Miembros',
  CATEGORIAS: 'Categorias',
  MOVIMIENTOS: 'Movimientos',
  CIERRES: 'Cierres',
  REPORTES: 'Reportes',
  PRESUPUESTO: 'Presupuesto',
  CONCILIACIONES: 'Conciliaciones',
  SEMANAS: 'Semanas',
  EVENTOS: 'Eventos',
  COMITES: 'Comites',
  AUDITORIA: 'Auditoria',
};

const ENCABEZADOS = {
  Config: ['clave', 'valor', 'descripcion'],
  Usuarios: ['email', 'nombre', 'rol', 'activo', 'creado_por', 'creado_en', 'clave_hash', 'clave_sal', 'cambiar_clave',
    'intentos', 'bloqueado_hasta', 'ultimo_ingreso'],
  Miembros: ['id', 'nombre', 'genero', 'fecha_nacimiento', 'telefono', 'email', 'direccion', 'estado', 'creado_en'],
  Eventos: ['id', 'titulo', 'fecha', 'hora_inicio', 'hora_fin', 'lugar', 'responsable', 'descripcion', 'estado',
    'creado_por', 'creado_en', 'actualizado_por', 'actualizado_en', 'motivo_cancelacion', 'comite', 'origen'],
  Comites: ['comite', 'representante', 'activo'],
  Categorias: ['id', 'tipo', 'nombre', 'activa'],
  Movimientos: ['id', 'numero', 'fecha', 'tipo', 'categoria', 'cuenta', 'cuenta_destino', 'medio_pago', 'referencia',
    'tercero', 'tercero_doc', 'concepto', 'valor', 'estado', 'cierre_id', 'conciliacion_id',
    'registrado_por', 'registrado_en', 'anulado_por', 'anulado_en', 'motivo_anulacion', 'pdf_url'],
  Cierres: ['id', 'fecha', 'saldo_inicial_caja', 'ingresos_caja', 'egresos_caja', 'saldo_esperado_caja', 'efectivo_contado',
    'diferencia', 'saldo_nequi', 'denominaciones', 'observaciones', 'estado', 'cerrado_por', 'verificado_por', 'cerrado_en', 'pdf_url'],
  Reportes: ['fecha', 'tipo', 'nombre', 'url', 'generado_por', 'generado_en'],
  Presupuesto: ['anio', 'tipo', 'categoria', 'valor', 'actualizado_por', 'actualizado_en'],
  Semanas: ['id', 'domingo', 'lunes', 'estado', 'datos', 'total_diezmos', 'aporte_1', 'aporte_2', 'aporte_3', 'neto_diezmos',
    'neto_menos_nequi', 'total_aportes', 'subtotal_ofrendas', 'total_egresos', 'total_ofrendas', 'total_sectores', 'total_general',
    'actualizado_por', 'actualizado_en', 'firmado_por', 'cerrado_por', 'cerrado_en', 'contabilizado', 'pdf_url', 'firma_img'],
  Conciliaciones: ['id', 'fecha', 'saldo_sistema', 'saldo_nequi', 'diferencia', 'movimientos', 'observaciones',
    'registrado_por', 'registrado_en', 'pdf_url'],
  Auditoria: ['fecha', 'usuario', 'accion', 'entidad', 'entidad_id', 'detalle'],
};

// Columnas que se guardan como texto plano (evita conversiones de fecha/zona horaria)
const COLUMNAS_TEXTO = /^(clave_hash|clave_sal|bloqueado_hasta|ultimo_ingreso|representante|fecha|fecha_nacimiento|hora_inicio|hora_fin|anio|domingo|lunes|datos|firma_img|.*_en|tercero_doc|telefono|referencia|numero)$/;

const ROLES = {
  ADMIN: ['dashboard.ver', 'semana.ver', 'semana.editar', 'semana.cerrar', 'semana.reabrir', 'semana.listas', 'movimientos.ver', 'movimientos.crear', 'movimientos.anular',
    'caja.cerrar', 'caja.reabrir', 'nequi.conciliar', 'presupuesto.editar', 'miembros.ver', 'miembros.editar',
    'reportes.ver', 'usuarios.admin', 'config.admin', 'auditoria.ver', 'eventos.ver', 'eventos.crear', 'eventos.gestionar'],
  // El pastor solo consulta el informe semanal y los ingresos (pedido de Jordan, 2026-11-05).
  PASTOR: ['dashboard.ver', 'semana.ver', 'movimientos.ver', 'presupuesto.editar', 'miembros.ver', 'miembros.editar', 'reportes.ver', 'auditoria.ver',
    'eventos.ver', 'eventos.crear', 'eventos.gestionar'],
  TESORERO: ['dashboard.ver', 'semana.ver', 'semana.editar', 'semana.cerrar', 'semana.listas', 'movimientos.ver', 'movimientos.crear', 'movimientos.anular',
    'caja.cerrar', 'nequi.conciliar', 'presupuesto.editar', 'miembros.ver', 'reportes.ver', 'eventos.ver', 'eventos.crear'],
  SECRETARIO: ['dashboard.ver', 'semana.ver', 'semana.editar', 'movimientos.ver', 'miembros.ver', 'miembros.editar', 'eventos.ver', 'eventos.crear', 'eventos.gestionar'],
  CONSULTA: ['dashboard.ver', 'semana.ver', 'semana.editar', 'reportes.ver', 'eventos.ver', 'eventos.crear'],
};

const NOMBRE_ROL = { ADMIN: 'Administrador', PASTOR: 'Pastor', TESORERO: 'Tesorero', SECRETARIO: 'Secretario', CONSULTA: 'Consulta' };

const ROL_DESCRIPCION = {
  ADMIN: 'Control total: usuarios, configuración, categorías, cierre y reapertura de semanas y cierres.',
  PASTOR: 'Consulta todo (informe semanal e ingresos solo en lectura), aprueba el presupuesto y gestiona miembros y eventos.',
  TESORERO: 'Registra ingresos y gastos, cierra la semana, cierra la caja y concilia Nequi.',
  SECRETARIO: 'Gestiona miembros y eventos, y consulta movimientos.',
  CONSULTA: 'Diligencia el informe semanal, agenda eventos y ve el panel y los reportes consolidados.',
};

// Los nombres se pueden cambiar en Configuración → Categorías (el cambio se aplica también al historial).
// Los cultos del informe semanal usan la categoría de ingreso con su mismo nombre.
const CULTOS_POR_DEFECTO = ['Oración', 'Dorcas', 'Caballeros', 'Jóvenes', 'Escuela Dominical', 'Evangelístico', 'Niños Escuela D.', 'Votos', 'Ahorro fiducia'];
const SECTORES_POR_DEFECTO = ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5'];
const CATEGORIAS_INICIALES = [['INGRESO', 'Diezmos']]
  .concat(CULTOS_POR_DEFECTO.map(function (n) { return ['INGRESO', n]; }))
  .concat(SECTORES_POR_DEFECTO.map(function (n) { return ['INGRESO', n]; }))
  .concat([['INGRESO', 'Ofrenda culto general'], ['INGRESO', 'Gavillas'], ['INGRESO', 'Rayos de luz'],
    ['INGRESO', 'Ofrenda especial'], ['INGRESO', 'Pro-templo'], ['INGRESO', 'Otros ingresos'],
  ['EGRESO', 'Seguridad social pastor'], ['EGRESO', 'Servicios públicos'], ['EGRESO', 'Arriendo'],
  ['EGRESO', 'Mantenimiento'], ['EGRESO', 'Aportes al distrito'], ['EGRESO', 'Misiones'], ['EGRESO', 'Ayuda social'],
  ['EGRESO', 'Papelería y aseo'], ['EGRESO', 'Transporte'], ['EGRESO', 'Comisiones Nequi'],
  ['EGRESO', 'Gastos de cultos semanales'], ['EGRESO', 'Otros gastos']]);

// Logo oficial publicado en la página nacional de la IPUC.
const LOGO_OFICIAL_URL = 'https://ipuc.org.co/assets/logo-ipuc-CokGg3u3.webp';

const CONFIG_INICIAL = [
  ['NOMBRE_CONGREGACION', 'Villa Olímpica', 'Nombre de la congregación (segunda línea del membrete)'],
  ['DIRECCION', 'Carrera 62 - Calle 8ª', 'Dirección física (tercera línea del membrete)'],
  ['CIUDAD', '', 'Ciudad (opcional; se muestra "Ciudad - Colombia")'],
  ['TELEFONO', '', 'Teléfono de la congregación'],
  ['EMAIL', 'Ipucvillaolimpica@gmail.com', 'Correo de la congregación (membrete)'],
  ['NIT', '', 'NIT de la iglesia (aparece en recibos)'],
  ['PASTOR', '', 'Nombre del pastor (firma en reportes)'],
  ['TESORERO', '', 'Nombre del tesorero (firma en reportes)'],
  ['VERIFICADOR', '', 'Nombre habitual de quien verifica el conteo de caja (diácono)'],
  ['NEQUI_NUMERO', '', 'Número de la cuenta Nequi de la iglesia'],
  ['SALDO_INICIAL_CAJA', 0, 'Efectivo en caja al iniciar el sistema'],
  ['SALDO_INICIAL_NEQUI', 0, 'Saldo en Nequi al iniciar el sistema'],
  ['FECHA_INICIO', '', 'Fecha de inicio de operación (aaaa-mm-dd)'],
  ['PORC_APORTE_1', 21, 'Informe semanal: % sobre el total de diezmos'],
  ['PORC_APORTE_2', 5, 'Informe semanal: % sobre (total − primer aporte)'],
  ['PORC_APORTE_3', 2, 'Informe semanal: % sobre (total − primer y segundo aporte)'],
  ['CULTOS_SEMANALES', CULTOS_POR_DEFECTO.join(', '), 'Informe semanal: cultos, separados por coma'],
  ['SECTORES', SECTORES_POR_DEFECTO.join(', '), 'Informe semanal: cultos de barrio, separados por coma'],
  ['CONTABILIZAR_SEMANA', 'SI', 'SI = al cerrar la semana, sus ingresos y egresos pasan a la contabilidad'],
  ['NEQUI_DIEZMOS_AL_PASTOR', 'SI', 'SI = los diezmos recibidos por Nequi también son del pastor (se le transfieren); NO = quedan en la cuenta Nequi de la iglesia'],
  ['LOGO_URL', LOGO_OFICIAL_URL, 'Dirección web del logo (por defecto, el logo oficial de ipuc.org.co)'],
  ['LOGO_FILE_ID', '', 'Opcional: ID de un logo PNG o JPG en Google Drive; si se llena, tiene prioridad sobre LOGO_URL'],
  ['COMPARTIR_AUTOMATICO', 'NO', 'SI = al crear un usuario también se le comparte la hoja y la carpeta en Drive (no es necesario: se entra con contraseña)'],
];

// Comités del formato de la congregación. Los representantes se escriben en la hoja Comites (una fila por persona).
const COMITES_POR_DEFECTO = ['Escuela Dominical', 'Misiones', 'Protocolo', 'Obra Social', 'REFAM', 'Música', 'DECOM', 'Caballeros',
  'Logística y Sonido', 'Intercesión', 'Años Dorados', 'Aseo', 'Pro Lote y Actividad', 'Damas Dorcas', 'Jóvenes'];

const MEDIOS_PAGO = ['Efectivo', 'Nequi'];
const NOMBRE_CUENTA = { CAJA: 'Caja (efectivo)', NEQUI: 'Nequi' };
const DENOMINACIONES = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

// ─────────────────────────────────────────────────────────────────────────────
// WEB APP
// ─────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  const t = HtmlService.createTemplateFromFile('Index');
  // ?p=agenda abre el enlace público de eventos para los comités (sin usuario ni contraseña)
  t.modo = e && e.parameter && e.parameter.p === 'agenda' ? 'agenda' : 'app';
  return t.evaluate()
    .setTitle('IPUC · ' + APP.NOMBRE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/** Punto de entrada único desde el cliente: google.script.run.api(accion, datos, token) */
function api(accion, datos, token) {
  try {
    const pub = ACCIONES_PUBLICAS[accion];
    if (pub) return { ok: true, data: pub(datos || {}) };
    const usuario = usuarioDeSesion_(token);
    if (!usuario) throw new Error('SESION_VENCIDA');
    if (usuario.cambiarClave && ['init', 'cambiarClave', 'salir'].indexOf(accion) === -1) {
      throw new Error('Debe cambiar su contraseña temporal antes de continuar.');
    }
    const h = ACCIONES[accion];
    if (!h) throw new Error('Acción no válida: ' + accion);
    if (h.permiso && !puede_(usuario, h.permiso)) throw new Error('Su rol (' + usuario.rol + ') no tiene permiso para esta acción.');
    return { ok: true, data: h.fn(datos || {}, usuario) };
  } catch (e) {
    console.error(accion, e && e.stack);
    return { ok: false, error: e.message || String(e) };
  }
}

/** Acciones que no requieren sesión: ingreso y enlace público de eventos. */
const ACCIONES_PUBLICAS = {
  publico: accionPublico_,
  ingresar: accionIngresar_,
  agendaEntrar: accionAgendaEntrar_,
  agendaEventos: accionAgendaEventos_,
  agendaGuardar: accionAgendaGuardar_,
};

const ACCIONES = {
  init: { fn: accionInit_ },
  cambiarClave: { fn: accionCambiarClave_ },
  salir: { fn: accionSalir_ },
  restablecerClave: { permiso: 'usuarios.admin', fn: accionRestablecerClave_ },
  descargarPdf: { fn: accionDescargarPdf_ },
  importarMiembros: { permiso: 'miembros.editar', fn: accionImportarMiembros_ },
  importarEventos: { permiso: 'eventos.crear', fn: accionImportarEventos_ },
  importarMovimientos: { permiso: 'movimientos.crear', fn: accionImportarMovimientos_ },
  guardarListaSemana: { permiso: 'semana.listas', fn: accionGuardarListaSemana_ },
  dashboard: { permiso: 'dashboard.ver', fn: accionDashboard_ },
  obtenerSemana: { permiso: 'semana.ver', fn: accionObtenerSemana_ },
  listarSemanas: { permiso: 'semana.ver', fn: accionListarSemanas_ },
  guardarSemana: { permiso: 'semana.editar', fn: accionGuardarSemana_ },
  cerrarSemana: { permiso: 'semana.cerrar', fn: accionCerrarSemana_ },
  reabrirSemana: { permiso: 'semana.reabrir', fn: accionReabrirSemana_ },
  pdfSemana: { permiso: 'semana.ver', fn: accionPdfSemana_ },
  pdfLiquidacion: { permiso: 'semana.ver', fn: accionPdfLiquidacion_ },
  listarMovimientos: { permiso: 'movimientos.ver', fn: accionListarMovimientos_ },
  crearMovimiento: { permiso: 'movimientos.crear', fn: accionCrearMovimiento_ },
  anularMovimiento: { permiso: 'movimientos.anular', fn: accionAnularMovimiento_ },
  pdfMovimiento: { permiso: 'movimientos.ver', fn: accionPdfMovimiento_ },
  previaCierre: { permiso: 'caja.cerrar', fn: accionPreviaCierre_ },
  cerrarCaja: { permiso: 'caja.cerrar', fn: accionCerrarCaja_ },
  reabrirCaja: { permiso: 'caja.reabrir', fn: accionReabrirCaja_ },
  listarCierres: { permiso: 'movimientos.ver', fn: accionListarCierres_ },
  previaConciliacion: { permiso: 'nequi.conciliar', fn: accionPreviaConciliacion_ },
  conciliarNequi: { permiso: 'nequi.conciliar', fn: accionConciliarNequi_ },
  listarConciliaciones: { permiso: 'movimientos.ver', fn: accionListarConciliaciones_ },
  obtenerPresupuesto: { permiso: 'reportes.ver', fn: accionObtenerPresupuesto_ },
  guardarPresupuesto: { permiso: 'presupuesto.editar', fn: accionGuardarPresupuesto_ },
  listarMiembros: { permiso: 'miembros.ver', fn: accionListarMiembros_ },
  guardarMiembro: { permiso: 'miembros.editar', fn: accionGuardarMiembro_ },
  pdfMiembros: { permiso: 'miembros.ver', fn: accionPdfMiembros_ },
  listarEventos: { permiso: 'eventos.ver', fn: accionListarEventos_ },
  guardarEvento: { permiso: 'eventos.crear', fn: accionGuardarEvento_ },
  cancelarEvento: { permiso: 'eventos.crear', fn: accionCancelarEvento_ },
  resumenPeriodo: { permiso: 'reportes.ver', fn: accionResumenPeriodo_ },
  pdfPeriodo: { permiso: 'reportes.ver', fn: accionPdfPeriodo_ },
  pdfDiario: { permiso: 'reportes.ver', fn: accionPdfDiario_ },
  listarReportes: { permiso: 'reportes.ver', fn: accionListarReportes_ },
  listarUsuarios: { permiso: 'usuarios.admin', fn: accionListarUsuarios_ },
  guardarUsuario: { permiso: 'usuarios.admin', fn: accionGuardarUsuario_ },
  guardarConfig: { permiso: 'config.admin', fn: accionGuardarConfig_ },
  guardarCategoria: { permiso: 'config.admin', fn: accionGuardarCategoria_ },
  listarAuditoria: { permiso: 'auditoria.ver', fn: accionListarAuditoria_ },
};

// ─────────────────────────────────────────────────────────────────────────────
// INSTALACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/** Ejecutar una vez desde el editor. Es idempotente: puede volver a ejecutarse sin borrar datos. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  if (props.getProperty('SPREADSHEET_ID')) {
    ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('IPUC · Sistema Contable · Datos');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  ss.setSpreadsheetTimeZone(APP.TZ);

  Object.keys(ENCABEZADOS).forEach(function (nombre) { asegurarHoja_(ss, nombre); });
  const vacia = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (vacia && ss.getSheets().length > 1 && vacia.getLastRow() === 0) ss.deleteSheet(vacia);

  // Configuración inicial
  const conf = leerTabla_(HOJAS.CONFIG);
  // Reemplaza los valores de ejemplo de versiones anteriores por los datos reales
  const ejemplo = { NOMBRE_CONGREGACION: ['Congregación Central'], DIRECCION: ['Calle 00 # 00-00'], CIUDAD: ['Ciudad'] };
  conf.forEach(function (r) {
    if (ejemplo[r.clave] && ejemplo[r.clave].indexOf(String(r.valor)) !== -1) {
      const nuevo = CONFIG_INICIAL.filter(function (c) { return c[0] === r.clave; })[0];
      actualizarFila_(HOJAS.CONFIG, r._fila, { valor: nuevo[1] });
    }
    // La primera versión apuntaba al logo general en Drive; ahora se usa el logo incluido de Villa Olímpica.
    if (r.clave === 'LOGO_FILE_ID' && LOGOS_ANTIGUOS.indexOf(String(r.valor).trim()) !== -1) actualizarFila_(HOJAS.CONFIG, r._fila, { valor: '' });
  });
  CONFIG_INICIAL.forEach(function (c) {
    if (!conf.some(function (r) { return r.clave === c[0]; })) {
      agregarFila_(HOJAS.CONFIG, { clave: c[0], valor: c[0] === 'FECHA_INICIO' ? hoy_() : c[1], descripcion: c[2] });
    }
  });

  // Categorías
  if (leerTabla_(HOJAS.CATEGORIAS).length === 0) {
    CATEGORIAS_INICIALES.forEach(function (c, i) {
      agregarFila_(HOJAS.CATEGORIAS, { id: 'CAT-' + pad_(i + 1, 3), tipo: c[0], nombre: c[1], activa: 'SI' });
    });
  }

  // Usuario administrador (quien ejecuta setup)
  const yo = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (yo && !filaUsuario_(yo)) {
    agregarFila_(HOJAS.USUARIOS, { email: yo, nombre: 'Administrador', rol: 'ADMIN', activo: 'SI', creado_por: yo, creado_en: ahora_() });
  }
  // Contraseña temporal para el administrador si aún no tiene una (se muestra en el registro de ejecución)
  const filaYo = yo && filaUsuario_(yo);
  if (filaYo && !filaYo.clave_hash) {
    const temporal = asignarClaveTemporal_(filaYo);
    Logger.log('INGRESO DEL ADMINISTRADOR → usuario: ' + yo + ' · contraseña temporal: ' + temporal + ' (el sistema pedirá cambiarla)');
  }

  // Carpeta de Drive para los PDF
  if (!props.getProperty('FOLDER_ID')) {
    const carpeta = DriveApp.createFolder('IPUC · Sistema Contable · Reportes PDF');
    props.setProperty('FOLDER_ID', carpeta.getId());
  }

  // Comités (los representantes se agregan en la hoja)
  if (leerTabla_(HOJAS.COMITES).length === 0) {
    COMITES_POR_DEFECTO.forEach(function (c) { agregarFila_(HOJAS.COMITES, { comite: c, representante: '', activo: 'SI' }); });
  }

  // Desde la versión con contraseña la app se ejecuta como el dueño; ya no hace falta compartir la hoja.
  if (!props.getProperty('MIGRADO_CLAVES')) {
    const comp = leerTabla_(HOJAS.CONFIG).filter(function (c) { return c.clave === 'COMPARTIR_AUTOMATICO'; })[0];
    if (comp) actualizarFila_(HOJAS.CONFIG, comp._fila, { valor: 'NO' });
    props.setProperty('MIGRADO_CLAVES', 'SI');
  }

  instalarDisparadorDiario();
  limpiarCache_();
  Logger.log('Listo. Hoja: ' + ss.getUrl() + ' · Carpeta: ' + carpetaRaiz_().getUrl());
}

const LOGOS_ANTIGUOS = ['1F61pH_8SwPU3JsnyUdL7OOwHuMnI5wh8'];

function normalizarNombre_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function instalarDisparadorDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'reporteDiarioAutomatico') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('reporteDiarioAutomatico').timeBased().everyDays(1)
    .atHour(APP.HORA_REPORTE_DIARIO).inTimezone(APP.TZ).create();
}

function asegurarHoja_(ss, nombre) {
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  const enc = ENCABEZADOS[nombre];
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, enc.length).setValues([enc]);
  } else {
    // Agrega columnas nuevas si el esquema creció
    const actuales = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    enc.forEach(function (c) {
      if (actuales.indexOf(c) === -1) sh.getRange(1, sh.getLastColumn() + 1).setValue(c);
    });
  }
  const finales = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getRange(1, 1, 1, finales.length)
    .setBackground(COLORES.AZUL_OSCURO).setFontColor('#FFFFFF').setFontWeight('bold').setFontFamily('Calibri');
  sh.setFrozenRows(1);
  finales.forEach(function (c, i) {
    if (COLUMNAS_TEXTO.test(c)) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    if (c === 'valor' || /^(saldo|ingresos|egresos|efectivo|diferencia|total_|aporte_|neto_|subtotal_)/.test(c)) {
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('$#,##0');
    }
  });
  return sh;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCESO A DATOS
// ─────────────────────────────────────────────────────────────────────────────

let _ss = null;
const _memo = {};

function ss_() {
  if (_ss) return _ss;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  _ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!_ss) throw new Error('El sistema no está instalado. Ejecute setup() desde el editor.');
  return _ss;
}

function hoja_(nombre) {
  const sh = ss_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja "' + nombre + '". Ejecute setup().');
  return sh;
}

/** Devuelve la hoja como arreglo de objetos {encabezado: valor, _fila: n}. Fechas → texto. */
function leerTabla_(nombre) {
  if (_memo[nombre]) return _memo[nombre];
  const sh = hoja_(nombre);
  const datos = sh.getDataRange().getValues();
  const enc = datos.shift() || [];
  const filas = datos.map(function (r, i) {
    const o = { _fila: i + 2 };
    enc.forEach(function (c, j) {
      let v = r[j];
      if (v instanceof Date) v = Utilities.formatDate(v, APP.TZ, /_en$/.test(c) ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
      o[c] = v;
    });
    return o;
  }).filter(function (o) { return enc.some(function (c) { return o[c] !== '' && o[c] !== null; }); });
  _memo[nombre] = filas;
  return filas;
}

function agregarFila_(nombre, obj) {
  const sh = hoja_(nombre);
  const enc = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(enc.map(function (c) { return obj[c] === undefined ? '' : obj[c]; }));
  delete _memo[nombre];
}

function actualizarFila_(nombre, fila, cambios) {
  const sh = hoja_(nombre);
  const enc = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  Object.keys(cambios).forEach(function (c) {
    const j = enc.indexOf(c);
    if (j >= 0) sh.getRange(fila, j + 1).setValue(cambios[c]);
  });
  delete _memo[nombre];
}

function limpiar_(o) {
  const r = {};
  Object.keys(o).forEach(function (k) { if (k !== '_fila') r[k] = o[k]; });
  return r;
}

function cfg_(clave) {
  const r = leerTabla_(HOJAS.CONFIG).filter(function (c) { return c.clave === clave; })[0];
  return r ? r.valor : '';
}

function configPublica_() {
  const o = {};
  leerTabla_(HOJAS.CONFIG).forEach(function (c) { if (!/^SEQ_/.test(c.clave)) o[c.clave] = c.valor; });
  return o;
}

/** Consecutivo con bloqueo: RI-000001, CE-000001, ... */
function siguienteNumero_(prefijo) {
  const clave = 'SEQ_' + prefijo;
  const fila = leerTabla_(HOJAS.CONFIG).filter(function (c) { return c.clave === clave; })[0];
  const n = (fila ? Number(fila.valor) || 0 : 0) + 1;
  if (fila) actualizarFila_(HOJAS.CONFIG, fila._fila, { valor: n });
  else agregarFila_(HOJAS.CONFIG, { clave: clave, valor: n, descripcion: 'Consecutivo ' + prefijo + ' (no editar)' });
  return prefijo + '-' + pad_(n, 6);
}

let _bloqueado = false;
/** Ejecuta fn con el candado del script (reentrante dentro de la misma ejecución). */
function conBloqueo_(fn) {
  if (_bloqueado) return fn();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  _bloqueado = true;
  try { return fn(); } finally { _bloqueado = false; lock.releaseLock(); }
}

function auditar_(usuario, accion, entidad, id, detalle) {
  agregarFila_(HOJAS.AUDITORIA, {
    fecha: ahora_(), usuario: usuario ? usuario.email : 'sistema', accion: accion,
    entidad: entidad, entidad_id: id || '', detalle: typeof detalle === 'string' ? detalle : JSON.stringify(detalle || ''),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// USUARIOS Y PERMISOS
// ─────────────────────────────────────────────────────────────────────────────

function filaUsuario_(email) {
  email = String(email || '').toLowerCase().trim();
  if (!email) return null;
  return leerTabla_(HOJAS.USUARIOS).filter(function (r) { return String(r.email).toLowerCase().trim() === email; })[0] || null;
}

function buscarUsuario_(email) {
  const u = filaUsuario_(email);
  if (!u || u.activo !== 'SI') return null;
  return { email: String(u.email).toLowerCase().trim(), nombre: u.nombre, rol: u.rol, permisos: ROLES[u.rol] || [], cambiarClave: u.cambiar_clave === 'SI' };
}

// ── Ingreso con usuario y contraseña ──
// Las contraseñas se guardan con sal y hash SHA-256 repetido (nunca en texto plano).
// La sesión es un código aleatorio guardado 6 horas en CacheService; se renueva con cada uso.
const SESION_SEG = 21600;

function hashClave_(clave, sal) {
  let h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '|' + clave, Utilities.Charset.UTF_8);
  for (let i = 0; i < 1000; i++) h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h);
  return h.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function codigoAleatorio_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
}

function claveAleatoria_() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const hex = codigoAleatorio_();
  let r = '';
  for (let i = 0; i < 10; i++) r += letras.charAt(parseInt(hex.substr(i * 6, 6), 16) % letras.length);
  return r;
}

/** Asigna una contraseña temporal (el usuario debe cambiarla al entrar) y la devuelve. */
function asignarClaveTemporal_(fila) {
  const temporal = claveAleatoria_();
  const sal = codigoAleatorio_().slice(0, 32);
  actualizarFila_(HOJAS.USUARIOS, fila._fila, { clave_sal: sal, clave_hash: hashClave_(temporal, sal), cambiar_clave: 'SI', intentos: 0, bloqueado_hasta: '' });
  return temporal;
}

function usuarioDeSesion_(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return null;
  const cache = CacheService.getScriptCache();
  const email = cache.get('SES_' + token);
  if (!email) return null;
  const u = buscarUsuario_(email);
  if (!u) { cache.remove('SES_' + token); return null; }
  cache.put('SES_' + token, email, SESION_SEG);
  u.token = token;
  return u;
}

function accionIngresar_(d) {
  const email = String(d.usuario || '').toLowerCase().trim();
  const clave = String(d.clave || '');
  return conBloqueo_(function () {
    const u = filaUsuario_(email);
    const ahora = ahora_();
    if (!u || u.activo !== 'SI' || !u.clave_hash) throw new Error('Usuario o contraseña incorrectos.');
    if (u.bloqueado_hasta && String(u.bloqueado_hasta) > ahora) {
      throw new Error('Por seguridad, el usuario quedó bloqueado por varios intentos fallidos. Intente de nuevo después de las ' + String(u.bloqueado_hasta).slice(11, 16) + '.');
    }
    if (hashClave_(clave, String(u.clave_sal)) !== String(u.clave_hash)) {
      const n = (Number(u.intentos) || 0) + 1;
      const cambios = { intentos: n >= 5 ? 0 : n };
      if (n >= 5) cambios.bloqueado_hasta = Utilities.formatDate(new Date(Date.now() + 15 * 60000), APP.TZ, 'yyyy-MM-dd HH:mm:ss');
      actualizarFila_(HOJAS.USUARIOS, u._fila, cambios);
      auditar_(null, 'INGRESO_FALLIDO', 'Usuario', email, n >= 5 ? 'Bloqueado 15 minutos' : 'Intento ' + n);
      throw new Error('Usuario o contraseña incorrectos.');
    }
    actualizarFila_(HOJAS.USUARIOS, u._fila, { intentos: 0, bloqueado_hasta: '', ultimo_ingreso: ahora });
    const token = codigoAleatorio_();
    CacheService.getScriptCache().put('SES_' + token, email, SESION_SEG);
    auditar_({ email: email }, 'INGRESO', 'Usuario', email, '');
    return { token: token };
  });
}

function accionCambiarClave_(d, usuario) {
  const nueva = String(d.nueva || '');
  if (nueva.length < 8) throw new Error('La contraseña nueva debe tener al menos 8 caracteres.');
  if (nueva !== String(d.confirmar || '')) throw new Error('La confirmación no coincide con la contraseña nueva.');
  return conBloqueo_(function () {
    const u = filaUsuario_(usuario.email);
    if (hashClave_(String(d.actual || ''), String(u.clave_sal)) !== String(u.clave_hash)) throw new Error('La contraseña actual no es correcta.');
    if (nueva === String(d.actual)) throw new Error('La contraseña nueva debe ser distinta de la actual.');
    const sal = codigoAleatorio_().slice(0, 32);
    actualizarFila_(HOJAS.USUARIOS, u._fila, { clave_sal: sal, clave_hash: hashClave_(nueva, sal), cambiar_clave: 'NO' });
    auditar_(usuario, 'CAMBIAR_CLAVE', 'Usuario', usuario.email, '');
    return true;
  });
}

function accionSalir_(d, usuario) {
  CacheService.getScriptCache().remove('SES_' + usuario.token);
  return true;
}

function accionRestablecerClave_(d, usuario) {
  return conBloqueo_(function () {
    const u = filaUsuario_(d.email);
    if (!u) throw new Error('Usuario no encontrado.');
    const temporal = asignarClaveTemporal_(u);
    auditar_(usuario, 'RESTABLECER_CLAVE', 'Usuario', u.email, '');
    return { claveTemporal: temporal, email: String(u.email).toLowerCase() };
  });
}


function puede_(usuario, permiso) {
  return usuario.permisos.indexOf(permiso) !== -1;
}

function accionInit_(d, usuario) {
  return {
    autorizado: true,
    usuario: { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, permisos: usuario.permisos },
    cambiarClave: usuario.cambiarClave,
    lema: APP.LEMA,
    urlAgenda: urlApp_() + '?p=agenda',
    urlHoja: puede_(usuario, 'config.admin') ? ss_().getUrl() : '',
    config: configPublica_(),
    categorias: leerTabla_(HOJAS.CATEGORIAS).filter(function (c) { return c.activa === 'SI' || puede_(usuario, 'config.admin'); }).map(limpiar_),
    totalMiembros: puede_(usuario, 'miembros.ver')
      ? leerTabla_(HOJAS.MIEMBROS).filter(function (m) { return m.estado === 'Activo'; }).length
      : 0,
    roles: Object.keys(ROLES).map(function (r) { return { rol: r, descripcion: ROL_DESCRIPCION[r] }; }),
    medios: MEDIOS_PAGO,
    cuentas: NOMBRE_CUENTA,
    denominaciones: DENOMINACIONES,
    hoy: hoy_(),
    logo: logoWeb_(),
    logoRespaldo: LOGO_VILLA_OLIMPICA,
    version: APP.VERSION,
    colores: COLORES,
    iglesia: APP.IGLESIA,
    web: APP.WEB_NACIONAL,
  };
}

function accionListarUsuarios_() {
  return leerTabla_(HOJAS.USUARIOS).map(function (u) {
    return { email: u.email, nombre: u.nombre, rol: u.rol, activo: u.activo, ultimo_ingreso: u.ultimo_ingreso,
      tieneClave: !!u.clave_hash, cambiarClave: u.cambiar_clave === 'SI' };
  });
}

function accionGuardarUsuario_(d, usuario) {
  const email = String(d.email || '').toLowerCase().trim();
  if (!/^[a-z0-9._@+-]{3,}$/.test(email)) throw new Error('Usuario inválido: use su correo o un nombre de usuario sin espacios.');
  if (!ROLES[d.rol]) throw new Error('Rol inválido.');
  const activo = d.activo === 'NO' ? 'NO' : 'SI';
  if (email === usuario.email && (d.rol !== 'ADMIN' || activo === 'NO')) {
    throw new Error('No puede quitarse a sí mismo el rol de administrador.');
  }
  return conBloqueo_(function () {
    const existente = filaUsuario_(email);
    let temporal = '';
    if (existente) {
      actualizarFila_(HOJAS.USUARIOS, existente._fila, { nombre: d.nombre || existente.nombre, rol: d.rol, activo: activo });
    } else {
      agregarFila_(HOJAS.USUARIOS, { email: email, nombre: d.nombre || '', rol: d.rol, activo: activo, creado_por: usuario.email, creado_en: ahora_() });
      temporal = asignarClaveTemporal_(filaUsuario_(email));
    }
    sincronizarAcceso_(email, activo === 'SI');
    auditar_(usuario, existente ? 'EDITAR' : 'CREAR', 'Usuario', email, { rol: d.rol, activo: activo });
    return { usuarios: accionListarUsuarios_(), claveTemporal: temporal, email: email };
  });
}

/** Comparte (o retira) la hoja de datos y la carpeta de PDF con el usuario. */
function sincronizarAcceso_(email, dar) {
  if (String(cfg_('COMPARTIR_AUTOMATICO')).toUpperCase() !== 'SI') return;
  const dueno = ss_().getOwner() && ss_().getOwner().getEmail();
  if (email === dueno) return;
  try {
    const archivo = DriveApp.getFileById(ss_().getId());
    const carpeta = carpetaRaiz_();
    if (dar) { archivo.addEditor(email); carpeta.addEditor(email); }
    else { archivo.removeEditor(email); carpeta.removeEditor(email); }
  } catch (e) {
    console.warn('No se pudo sincronizar acceso de ' + email + ': ' + e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIEMBROS (directorio: nombre, teléfono, correo y dirección opcionales)
// ─────────────────────────────────────────────────────────────────────────────

const GENERO_ALIAS = { m: 'Masculino', h: 'Masculino', masculino: 'Masculino', hombre: 'Masculino', hermano: 'Masculino',
  f: 'Femenino', femenino: 'Femenino', mujer: 'Femenino', hermana: 'Femenino' };

function generoNormal_(g) { return GENERO_ALIAS[normalizarNombre_(g)] || ''; }

/** Fecha escrita de cualquier forma (2001-05-13, 13/05/2001, número de Excel) → aaaa-mm-dd, o '' si no se entiende. */
function fechaNormal_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, APP.TZ, 'yyyy-MM-dd');
  let f = '';
  const t = String(v == null ? '' : v).trim();
  if (/^\d{5}$/.test(t)) {
    f = Utilities.formatDate(new Date(Date.UTC(1899, 11, 30) + Number(t) * 86400000), 'UTC', 'yyyy-MM-dd');
  } else if (/^\d{4}-\d{1,2}-\d{1,2}/.test(t)) {
    const p = t.slice(0, 10).split('-');
    f = p[0] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[2]).slice(-2);
  } else {
    const m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (m) {
      let y = Number(m[3]);
      if (y < 100) y += y > Number(hoy_().slice(2, 4)) ? 1900 : 2000;
      f = y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    }
  }
  const p = f.split('-').map(Number);
  if (!f || p[1] < 1 || p[1] > 12 || p[2] < 1 || p[2] > 31 || f > hoy_() || p[0] < 1900) return '';
  return f;
}

/** Lee la hoja Miembros. Acepta filas escritas a mano en la hoja: les asigna id y ordena género, fecha y estado. */
function accionListarMiembros_() {
  const necesita = leerTabla_(HOJAS.MIEMBROS).some(function (m) {
    return String(m.nombre).trim() && (!m.id || !m.estado || (m.genero && GENEROS.indexOf(m.genero) === -1 && generoNormal_(m.genero)) ||
      (m.fecha_nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(String(m.fecha_nacimiento))));
  });
  if (necesita) {
    conBloqueo_(function () {
      const sh = hoja_(HOJAS.MIEMBROS);
      const datos = sh.getDataRange().getValues();
      const enc = datos[0];
      const col = function (c) { return enc.indexOf(c); };
      const fila = leerTabla_(HOJAS.CONFIG).filter(function (c) { return c.clave === 'SEQ_MB'; })[0];
      let n = fila ? Number(fila.valor) || 0 : 0;
      const n0 = n;
      for (let i = 1; i < datos.length; i++) {
        const r = datos[i];
        if (!String(r[col('nombre')]).trim()) continue;
        if (!r[col('id')]) r[col('id')] = 'MB-' + pad_(++n, 6);
        if (!r[col('estado')]) r[col('estado')] = 'Activo';
        if (col('creado_en') >= 0 && !r[col('creado_en')]) r[col('creado_en')] = ahora_();
        const g = r[col('genero')];
        if (g && GENEROS.indexOf(g) === -1 && generoNormal_(g)) r[col('genero')] = generoNormal_(g);
        const fn = r[col('fecha_nacimiento')];
        if (fn !== '' && fn != null) r[col('fecha_nacimiento')] = fechaNormal_(fn);
      }
      sh.getRange(1, 1, datos.length, enc.length).setValues(datos);
      delete _memo[HOJAS.MIEMBROS];
      if (n !== n0) {
        if (fila) actualizarFila_(HOJAS.CONFIG, fila._fila, { valor: n });
        else agregarFila_(HOJAS.CONFIG, { clave: 'SEQ_MB', valor: n, descripcion: 'Consecutivo MB (no editar)' });
      }
    });
  }
  return leerTabla_(HOJAS.MIEMBROS).filter(function (m) { return String(m.nombre).trim(); }).map(function (m) {
    const o = limpiar_(m);
    o.nombre = String(o.nombre).trim();
    if (GENEROS.indexOf(o.genero) === -1) o.genero = generoNormal_(o.genero);
    return o;
  }).sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); });
}

/** Agrega miembros pegados desde Excel: [nombre, sexo, fecha de nacimiento, teléfono]. No repite nombres. */
function accionImportarMiembros_(d, usuario) {
  const filas = Array.isArray(d.filas) ? d.filas.slice(0, 3000) : [];
  return conBloqueo_(function () {
    const existentes = {};
    leerTabla_(HOJAS.MIEMBROS).forEach(function (m) { existentes[normalizarNombre_(m.nombre)] = true; });
    const nuevos = [], errores = [];
    let repetidos = 0;
    filas.forEach(function (f) {
      const nombre = String(f[0] || '').replace(/\s+/g, ' ').trim();
      if (!nombre || /^nombres?\b/i.test(nombre)) return;
      const k = normalizarNombre_(nombre);
      if (existentes[k]) { repetidos++; return; }
      const genero = generoNormal_(f[1]);
      if (!genero) { errores.push(nombre + ': no se reconoce el sexo "' + String(f[1] || '') + '" (use M o F)'); return; }
      existentes[k] = true;
      const m = { nombre: nombre, genero: genero, fecha_nacimiento: fechaNormal_(f[2]), telefono: String(f[3] || '').trim() };
      // Columnas opcionales del Excel exportado: correo, dirección y estado.
      if (f[4]) m.email = String(f[4]).trim();
      if (f[5]) m.direccion = String(f[5]).trim();
      if (/^inactiv/i.test(String(f[6] || '').trim())) m.estado = 'Inactivo';
      nuevos.push(m);
    });
    if (nuevos.length) {
      const sh = hoja_(HOJAS.MIEMBROS);
      const enc = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      const fila = leerTabla_(HOJAS.CONFIG).filter(function (c) { return c.clave === 'SEQ_MB'; })[0];
      let n = fila ? Number(fila.valor) || 0 : 0;
      const ahora = ahora_();
      const valores = nuevos.map(function (m) {
        m.id = 'MB-' + pad_(++n, 6); m.estado = m.estado || 'Activo'; m.creado_en = ahora;
        return enc.map(function (c) { return m[c] === undefined ? '' : m[c]; });
      });
      sh.getRange(sh.getLastRow() + 1, 1, valores.length, enc.length).setNumberFormat('@').setValues(valores);
      delete _memo[HOJAS.MIEMBROS];
      if (fila) actualizarFila_(HOJAS.CONFIG, fila._fila, { valor: n });
      else agregarFila_(HOJAS.CONFIG, { clave: 'SEQ_MB', valor: n, descripcion: 'Consecutivo MB (no editar)' });
      auditar_(usuario, 'IMPORTAR', 'Miembro', '', nuevos.length + ' miembros');
    }
    return { agregados: nuevos.length, repetidos: repetidos, errores: errores, miembros: accionListarMiembros_() };
  });
}

/** Cambia la lista de cultos o de sectores del informe semanal. Al renombrar, la categoría de ingreso y las semanas abiertas siguen el nombre nuevo. */
function accionGuardarListaSemana_(d, usuario) {
  const clave = ['SECTORES', 'CULTOS_SEMANALES'].indexOf(d.clave) !== -1 ? d.clave : '';
  if (!clave) throw new Error('Lista inválida.');
  const items = (Array.isArray(d.items) ? d.items : []).map(function (x) {
    return { anterior: String(x.anterior || '').trim(), nombre: String(x.nombre || '').replace(/[,\s]+/g, ' ').trim() };
  }).filter(function (x) { return x.nombre; });
  if (!items.length) throw new Error('La lista no puede quedar vacía.');
  const vistos = {};
  items.forEach(function (x) {
    const k = normalizarNombre_(x.nombre);
    if (vistos[k]) throw new Error('El nombre "' + x.nombre + '" está repetido.');
    vistos[k] = true;
  });
  return conBloqueo_(function () {
    const fila = leerTabla_(HOJAS.CONFIG).filter(function (c) { return c.clave === clave; })[0];
    const valor = items.map(function (x) { return x.nombre; }).join(', ');
    if (fila) actualizarFila_(HOJAS.CONFIG, fila._fila, { valor: valor });
    items.forEach(function (x) {
      if (!x.anterior || x.anterior === x.nombre) return;
      const cats = leerTabla_(HOJAS.CATEGORIAS);
      const c = cats.filter(function (y) { return y.tipo === 'INGRESO' && y.nombre === x.anterior; })[0];
      const ya = cats.some(function (y) { return y.tipo === 'INGRESO' && normalizarNombre_(y.nombre) === normalizarNombre_(x.nombre); });
      if (c && !ya) accionGuardarCategoria_({ id: c.id, tipo: 'INGRESO', nombre: x.nombre, activa: c.activa }, usuario);
    });
    // Semanas abiertas: se conservan los valores digitados y se aplican los nombres nuevos
    const campo = clave === 'SECTORES' ? 'sectores' : 'cultos';
    const vacia = function (nombre) {
      return campo === 'sectores' ? { nombre: nombre, fecha: '', ofrenda: 0 } : { nombre: nombre, promedio: '', realizado: false, fecha: '', ofrenda: 0 };
    };
    const tieneDatos = function (r) { return Number(r.ofrenda) || r.fecha || r.promedio || r.realizado; };
    leerTabla_(HOJAS.SEMANAS).filter(function (w) { return w.estado !== 'CERRADA'; }).forEach(function (w) {
      let datos;
      try { datos = JSON.parse(w.datos); } catch (e) { return; }
      const viejas = (datos[campo] || []).slice();
      const usadas = [];
      const nuevas = items.map(function (x) {
        const i = viejas.findIndex(function (r, j) { return usadas.indexOf(j) === -1 && r.nombre && (r.nombre === (x.anterior || x.nombre)); });
        if (i === -1) return vacia(x.nombre);
        usadas.push(i);
        const r = viejas[i]; r.nombre = x.nombre; return r;
      });
      viejas.forEach(function (r, j) { if (usadas.indexOf(j) === -1 && (!r.nombre || tieneDatos(r))) nuevas.push(r); });
      datos[campo] = nuevas;
      actualizarFila_(HOJAS.SEMANAS, w._fila, { datos: JSON.stringify(datos) });
    });
    auditar_(usuario, 'EDITAR', 'Config', clave, valor);
    limpiarCache_();
    return configPublica_();
  });
}


function accionGuardarMiembro_(d, usuario) {
  const nombre = String(d.nombre || '').trim();
  if (!nombre) throw new Error('El nombre es obligatorio.');
  const nac = String(d.fecha_nacimiento || '').trim();
  if (nac && (!/^\d{4}-\d{2}-\d{2}$/.test(nac) || nac > hoy_())) throw new Error('Fecha de nacimiento inválida.');
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email).trim())) throw new Error('Correo inválido.');
  if (GENEROS.indexOf(d.genero) === -1) throw new Error('Seleccione el género.');
  return conBloqueo_(function () {
    const datos = {
      nombre: nombre, genero: d.genero, fecha_nacimiento: nac, telefono: String(d.telefono || '').trim(), email: String(d.email || '').trim(),
      direccion: String(d.direccion || '').trim(), estado: d.estado === 'Inactivo' ? 'Inactivo' : 'Activo',
    };
    let id = d.id;
    const repetido = leerTabla_(HOJAS.MIEMBROS).filter(function (m) { return m.id !== id && normalizarNombre_(m.nombre) === normalizarNombre_(nombre); })[0];
    if (repetido) throw new Error('Ya existe un miembro con el nombre ' + repetido.nombre + '.');
    if (id) {
      const ex = leerTabla_(HOJAS.MIEMBROS).filter(function (m) { return m.id === id; })[0];
      if (!ex) throw new Error('Miembro no encontrado.');
      actualizarFila_(HOJAS.MIEMBROS, ex._fila, datos);
    } else {
      id = siguienteNumero_('MB');
      datos.id = id;
      datos.creado_en = ahora_();
      agregarFila_(HOJAS.MIEMBROS, datos);
    }
    auditar_(usuario, d.id ? 'EDITAR' : 'CREAR', 'Miembro', id, nombre);
    return accionListarMiembros_();
  });
}

const GENEROS = ['Masculino', 'Femenino'];

/** PDF del listado de hermanos agrupado por género. genero: '' (todos), 'Masculino' o 'Femenino'. */
function accionPdfMiembros_(d, usuario) {
  const genero = d.genero || '';
  if (genero && GENEROS.indexOf(genero) === -1) throw new Error('Género inválido.');
  const soloActivos = d.estado !== 'Todos';
  const todos = accionListarMiembros_().filter(function (m) { return !soloActivos || m.estado === 'Activo'; });
  const grupos = [['Masculino', 'Hermanos'], ['Femenino', 'Hermanas'], ['', 'Sin género registrado']];
  const cuenta = function (g) { return todos.filter(function (m) { return (m.genero || '') === g; }).length; };
  let cuerpo = '<div class="cajas"><div class="caja"><small>Total</small><b>' + todos.length + '</b></div>' +
    '<div class="caja"><small>Hermanos</small><b>' + cuenta('Masculino') + '</b></div>' +
    '<div class="caja"><small>Hermanas</small><b>' + cuenta('Femenino') + '</b></div></div>';
  grupos.forEach(function (g) {
    if (genero && g[0] !== genero) return;
    const lista = todos.filter(function (m) { return (m.genero || '') === g[0]; });
    if (!lista.length && !g[0]) return;
    cuerpo += subtitulo_(g[1] + ' (' + lista.length + ')') +
      (lista.length ? '<table><tr><th>N.º</th><th>Nombre</th><th>Edad</th><th>Teléfono</th><th>Correo</th><th>Dirección</th><th>Estado</th></tr>' +
        lista.map(function (m, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc_(m.nombre) + '</td><td>' + esc_(edad_(m.fecha_nacimiento)) + '</td><td>' + esc_(m.telefono) + '</td><td>' + esc_(m.email) +
            '</td><td>' + esc_(m.direccion) + '</td><td>' + esc_(m.estado) + '</td></tr>';
        }).join('') + '</table>' : '<p style="color:#5b6475">Ninguno.</p>');
  });
  const titulo = genero === 'Masculino' ? 'Listado de hermanos' : genero === 'Femenino' ? 'Listado de hermanas' : 'Listado de hermanos por género';
  const pdf = guardarPdf_(plantillaPdf_(titulo, (soloActivos ? 'Miembros activos' : 'Todos los miembros') + ' al ' + fechaLarga_(hoy_()), cuerpo, usuario),
    'Reportes de miembros', titulo + ' ' + hoy_());
  registrarReporte_(hoy_(), 'Miembros por género', pdf, usuario);
  return pdf;
}

/** Edad en años cumplidos a hoy ('' si no hay fecha). */
function edad_(nac) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(nac || ''))) return '';
  const h = hoy_().split('-').map(Number), n = String(nac).split('-').map(Number);
  return h[0] - n[0] - ((h[1] < n[1] || (h[1] === n[1] && h[2] < n[2])) ? 1 : 0);
}

function miembrosResumen_() {
  const activos = leerTabla_(HOJAS.MIEMBROS).filter(function (m) { return m.estado === 'Activo'; });
  return {
    total: activos.length,
    hermanos: activos.filter(function (m) { return m.genero === 'Masculino'; }).length,
    hermanas: activos.filter(function (m) { return m.genero === 'Femenino'; }).length,
  };
}

/** Miembros activos que cumplen años en el mes de la fecha dada, ordenados por día. */
function cumpleanosDelMes_(hoy) {
  const mes = hoy.slice(5, 7);
  return leerTabla_(HOJAS.MIEMBROS)
    .filter(function (m) { return m.estado === 'Activo' && String(m.fecha_nacimiento).slice(5, 7) === mes; })
    .map(function (m) { return { nombre: m.nombre, dia: Number(String(m.fecha_nacimiento).slice(8, 10)), cumple: Number(hoy.slice(0, 4)) - Number(String(m.fecha_nacimiento).slice(0, 4)) }; })
    .sort(function (a, b) { return a.dia - b.dia; });
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTOS (agenda general de la congregación, sin cruces de horario)
// Todos los roles ven y agendan. Quien creó el evento lo puede editar o cancelar;
// ADMIN, PASTOR y SECRETARIO pueden editar o cancelar cualquiera.
// ─────────────────────────────────────────────────────────────────────────────

function eventosActivos_() {
  return leerTabla_(HOJAS.EVENTOS).filter(function (e) { return e.estado !== 'Cancelado'; }).map(limpiar_)
    .sort(function (a, b) { return (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio); });
}

function accionListarEventos_(d) {
  const desde = d.desde || '0000-00-00', hasta = d.hasta || '9999-99-99';
  return leerTabla_(HOJAS.EVENTOS).map(limpiar_)
    .filter(function (e) { return e.fecha >= desde && e.fecha <= hasta && (d.incluirCancelados || e.estado !== 'Cancelado'); })
    .sort(function (a, b) { return (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio); });
}

function horaValida_(h) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h || '')); }

function puedeEditarEvento_(usuario, e) {
  return puede_(usuario, 'eventos.gestionar') || String(e.creado_por).toLowerCase() === usuario.email;
}

/** Devuelve el evento activo que se cruza con [inicio, fin) en esa fecha, o null. */
function cruceEvento_(fecha, inicio, fin, excluirId) {
  return leerTabla_(HOJAS.EVENTOS).filter(function (e) {
    return e.estado !== 'Cancelado' && e.id !== excluirId && e.fecha === fecha &&
      String(e.hora_inicio) < fin && inicio < String(e.hora_fin);
  })[0] || null;
}

function accionGuardarEvento_(d, usuario) {
  const titulo = String(d.titulo || '').trim();
  const fecha = String(d.fecha || '');
  const inicio = String(d.hora_inicio || ''), fin = String(d.hora_fin || '');
  if (!titulo) throw new Error('Escriba el nombre del evento.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha inválida.');
  if (!horaValida_(inicio) || !horaValida_(fin)) throw new Error('Hora inválida.');
  if (fin <= inicio) throw new Error('La hora de terminación debe ser posterior a la de inicio.');
  return conBloqueo_(function () {
    let ex = null;
    if (d.id) {
      ex = leerTabla_(HOJAS.EVENTOS).filter(function (e) { return e.id === d.id; })[0];
      if (!ex) throw new Error('Evento no encontrado.');
      if (ex.estado === 'Cancelado') throw new Error('El evento está cancelado.');
      if (!puedeEditarEvento_(usuario, ex)) throw new Error('Solo quien creó el evento o un administrador, pastor o secretario puede modificarlo.');
    } else if (fecha < hoy_()) {
      throw new Error('No se pueden agendar eventos en fechas pasadas.');
    }
    const cruce = cruceEvento_(fecha, inicio, fin, ex ? ex.id : '');
    if (cruce) {
      throw new Error('Ese horario se cruza con "' + cruce.titulo + '" (' + fechaLarga_(fecha) + ', ' + cruce.hora_inicio + ' a ' + cruce.hora_fin + '). Elija otra hora o fecha.');
    }
    const datos = {
      titulo: titulo, fecha: fecha, hora_inicio: inicio, hora_fin: fin, comite: String(d.comite || (ex && ex.comite) || '').trim(),
      lugar: String(d.lugar || '').trim(), responsable: String(d.responsable || '').trim(), descripcion: String(d.descripcion || '').trim(),
      actualizado_por: usuario.email, actualizado_en: ahora_(),
    };
    let id;
    if (ex) {
      id = ex.id;
      actualizarFila_(HOJAS.EVENTOS, ex._fila, datos);
    } else {
      id = siguienteNumero_('EV');
      datos.id = id; datos.estado = 'Programado'; datos.creado_por = usuario.publico ? usuario.nombre : usuario.email; datos.creado_en = ahora_();
      datos.origen = usuario.publico ? 'ENLACE' : 'SISTEMA';
      agregarFila_(HOJAS.EVENTOS, datos);
    }
    auditar_(usuario, ex ? 'EDITAR' : 'CREAR', 'Evento', id, titulo + ' · ' + fecha + ' ' + inicio + '-' + fin);
    return { id: id };
  });
}

// ── Enlace público de eventos (?p=agenda): el representante de un comité escribe su nombre y elige su comité ──
// Si en la hoja Comites hay representantes escritos para ese comité, el nombre debe coincidir con uno de ellos.

function comitesActivos_() {
  const vistos = {};
  return leerTabla_(HOJAS.COMITES).filter(function (r) {
    const c = String(r.comite || '').trim();
    if (!c || r.activo === 'NO' || vistos[c]) return false;
    vistos[c] = true;
    return true;
  }).map(function (r) { return String(r.comite).trim(); });
}

function accionPublico_() {
  return {
    logo: logoWeb_(), logoRespaldo: LOGO_VILLA_OLIMPICA, congregacion: cfg_('NOMBRE_CONGREGACION'), direccion: cfg_('DIRECCION'),
    email: cfg_('EMAIL'), iglesia: APP.IGLESIA, web: APP.WEB_NACIONAL, lema: APP.LEMA, version: APP.VERSION, hoy: hoy_(), url: urlApp_(),
    comites: comitesActivos_(),
  };
}

function accionAgendaEntrar_(d) {
  const nombre = String(d.nombre || '').replace(/\s+/g, ' ').trim();
  const comite = String(d.comite || '').trim();
  if (nombre.length < 3) throw new Error('Escriba su nombre completo.');
  const filas = leerTabla_(HOJAS.COMITES).filter(function (r) { return r.activo !== 'NO' && String(r.comite).trim() === comite; });
  if (!filas.length) throw new Error('Seleccione su comité de la lista.');
  const reps = filas.map(function (r) { return String(r.representante || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  let oficial = nombre;
  if (reps.length) {
    oficial = reps.filter(function (x) { return normalizarNombre_(x) === normalizarNombre_(nombre); })[0];
    if (!oficial) throw new Error('Su nombre no aparece como representante del comité ' + comite + '. Pida al administrador que lo agregue en la hoja Comites.');
  }
  const token = codigoAleatorio_();
  CacheService.getScriptCache().put('AG_' + token, JSON.stringify({ nombre: oficial, comite: comite }), SESION_SEG);
  return { token: token, nombre: oficial, comite: comite };
}

function sesionAgenda_(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw new Error('SESION_VENCIDA');
  const cache = CacheService.getScriptCache();
  const v = cache.get('AG_' + token);
  if (!v) throw new Error('SESION_VENCIDA');
  cache.put('AG_' + token, v, SESION_SEG);
  return JSON.parse(v);
}

function eventoPublico_(e) {
  return { titulo: e.titulo, fecha: e.fecha, hora_inicio: e.hora_inicio, hora_fin: e.hora_fin, lugar: e.lugar, comite: e.comite || '' };
}

function eventosDe_(s) {
  return leerTabla_(HOJAS.EVENTOS).filter(function (e) {
    return e.origen === 'ENLACE' && String(e.comite) === s.comite && normalizarNombre_(e.creado_por) === normalizarNombre_(s.nombre);
  });
}

function accionAgendaEventos_(d) {
  const s = sesionAgenda_(d.token);
  const hoy = hoy_();
  return {
    nombre: s.nombre, comite: s.comite,
    eventos: eventosActivos_().filter(function (e) { return e.fecha >= hoy; }).map(eventoPublico_),
    mios: eventosDe_(s).map(function (e) {
      const o = eventoPublico_(e); o.estado = e.estado; o.motivo = e.motivo_cancelacion || ''; o.descripcion = e.descripcion; return o;
    }).sort(function (a, b) { return (b.fecha + b.hora_inicio).localeCompare(a.fecha + a.hora_inicio); }),
  };
}

function accionAgendaGuardar_(d) {
  const s = sesionAgenda_(d.token);
  const pendientes = eventosDe_(s).filter(function (e) { return e.estado !== 'Cancelado' && e.fecha >= hoy_(); }).length;
  if (pendientes >= 20) throw new Error('Ya tiene 20 eventos próximos agendados. Para más, comuníquese con la secretaría.');
  accionGuardarEvento_({
    titulo: d.titulo, fecha: d.fecha, hora_inicio: d.hora_inicio, hora_fin: d.hora_fin, lugar: d.lugar,
    responsable: s.nombre, descripcion: d.descripcion, comite: s.comite,
  }, { publico: true, nombre: s.nombre, email: 'enlace: ' + s.nombre + ' (' + s.comite + ')', permisos: [] });
  return accionAgendaEventos_(d);
}

/** Importa eventos desde Excel. Cada fila pasa por las mismas reglas (sin cruces, sin fechas pasadas). */
function accionImportarEventos_(d, usuario) {
  const filas = Array.isArray(d.filas) ? d.filas.slice(0, 500) : [];
  if (!filas.length) throw new Error('El archivo no trae eventos.');
  const errores = [];
  let agregados = 0;
  filas.forEach(function (f, i) {
    try {
      accionGuardarEvento_({ titulo: f.titulo, fecha: f.fecha, hora_inicio: f.hora_inicio, hora_fin: f.hora_fin,
        lugar: f.lugar, responsable: f.responsable, descripcion: f.descripcion }, usuario);
      agregados++;
    } catch (e) {
      errores.push('Fila ' + (f.fila || i + 2) + ' (' + (f.titulo || 'sin nombre') + '): ' + e.message);
    }
  });
  return { agregados: agregados, errores: errores };
}

function accionCancelarEvento_(d, usuario) {
  const motivo = String(d.motivo || '').trim();
  if (!motivo) throw new Error('Indique el motivo de la cancelación.');
  return conBloqueo_(function () {
    const ex = leerTabla_(HOJAS.EVENTOS).filter(function (e) { return e.id === d.id; })[0];
    if (!ex) throw new Error('Evento no encontrado.');
    if (!puedeEditarEvento_(usuario, ex)) throw new Error('Solo quien creó el evento o un administrador, pastor o secretario puede cancelarlo.');
    actualizarFila_(HOJAS.EVENTOS, ex._fila, { estado: 'Cancelado', motivo_cancelacion: motivo, actualizado_por: usuario.email, actualizado_en: ahora_() });
    auditar_(usuario, 'CANCELAR', 'Evento', ex.id, ex.titulo + ' · ' + motivo);
    return { id: ex.id };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MOVIMIENTOS (INGRESOS, EGRESOS, TRASLADOS CAJA ↔ NEQUI)
// Los diezmos y ofrendas se registran como valor total, sin nombre del aportante.
// ─────────────────────────────────────────────────────────────────────────────

function movimientosActivos_() {
  return leerTabla_(HOJAS.MOVIMIENTOS).filter(function (m) { return m.estado === 'ACTIVO'; });
}

function cuentaPorMedio_(medio) {
  return medio === 'Nequi' ? 'NEQUI' : 'CAJA';
}

function accionListarMovimientos_(d) {
  const desde = d.desde || '0000-00-00';
  const hasta = d.hasta || '9999-99-99';
  let filas = leerTabla_(HOJAS.MOVIMIENTOS).filter(function (m) {
    return m.fecha >= desde && m.fecha <= hasta &&
      (!d.tipo || m.tipo === d.tipo) &&
      (!d.categoria || m.categoria === d.categoria) &&
      (!d.cuenta || m.cuenta === d.cuenta || m.cuenta_destino === d.cuenta) &&
      (d.incluirAnulados || m.estado === 'ACTIVO');
  });
  filas.sort(function (a, b) { return (b.fecha + b.registrado_en).localeCompare(a.fecha + a.registrado_en); });
  if (d.limite) filas = filas.slice(0, d.limite);
  return filas.map(limpiar_);
}

function accionCrearMovimiento_(d, usuario) {
  const tipo = String(d.tipo || '').toUpperCase();
  if (['INGRESO', 'EGRESO', 'TRASLADO'].indexOf(tipo) === -1) throw new Error('Tipo de movimiento inválido.');
  const valor = Math.round(Number(d.valor));
  if (!(valor > 0)) throw new Error('El valor debe ser mayor que cero.');
  const fecha = String(d.fecha || hoy_());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha inválida.');
  if (fecha > hoy_()) throw new Error('No se permiten movimientos con fecha futura.');
  if (!String(d.concepto || '').trim() && tipo === 'EGRESO') throw new Error('El concepto es obligatorio.');

  return conBloqueo_(function () {
    if (diaCerrado_(fecha)) throw new Error('La caja del ' + fecha + ' ya está cerrada. Un administrador debe reabrirla.');

    const mov = {
      id: Utilities.getUuid(), fecha: fecha, tipo: tipo, estado: 'ACTIVO', valor: valor,
      concepto: String(d.concepto || '').trim(), referencia: String(d.referencia || '').trim(),
      registrado_por: usuario.email, registrado_en: ahora_(),
    };

    if (tipo === 'TRASLADO') {
      if (['CAJA', 'NEQUI'].indexOf(d.cuenta) === -1) throw new Error('Cuenta de origen inválida.');
      mov.cuenta = d.cuenta;
      mov.cuenta_destino = d.cuenta === 'CAJA' ? 'NEQUI' : 'CAJA';
      mov.categoria = d.cuenta === 'CAJA' ? 'Depósito a Nequi' : 'Retiro de Nequi';
      mov.medio_pago = d.cuenta === 'CAJA' ? 'Depósito' : 'Retiro';
      mov.concepto = mov.concepto || mov.categoria;
    } else {
      const cat = leerTabla_(HOJAS.CATEGORIAS).filter(function (c) {
        return c.nombre === d.categoria && c.tipo === tipo && c.activa === 'SI';
      })[0];
      if (!cat) throw new Error('Categoría inválida para ' + tipo.toLowerCase() + '.');
      if (MEDIOS_PAGO.indexOf(d.medio_pago) === -1) throw new Error('Medio de pago inválido.');
      mov.categoria = cat.nombre;
      mov.medio_pago = d.medio_pago;
      mov.cuenta = cuentaPorMedio_(d.medio_pago);
      mov.tercero = tipo === 'EGRESO' ? String(d.tercero || '').trim() : '';
      mov.tercero_doc = tipo === 'EGRESO' ? String(d.tercero_doc || '').trim() : '';
      if (tipo === 'EGRESO' && !mov.tercero) throw new Error('Indique el beneficiario del pago.');
      if (!mov.concepto) mov.concepto = cat.nombre;
    }

    // Control de saldo: no se puede sacar más de lo que hay en la cuenta
    if (tipo === 'EGRESO' || tipo === 'TRASLADO') {
      const disp = saldos_()[mov.cuenta];
      if (valor > disp) {
        throw new Error('Saldo insuficiente en ' + NOMBRE_CUENTA[mov.cuenta] + ': disponible ' + pesos_(disp) + '.');
      }
    }

    mov.numero = siguienteNumero_({ INGRESO: 'RI', EGRESO: 'CE', TRASLADO: 'TR' }[tipo]);
    agregarFila_(HOJAS.MOVIMIENTOS, mov);
    auditar_(usuario, 'CREAR', 'Movimiento', mov.numero, { tipo: tipo, categoria: mov.categoria, valor: valor });
    return mov;
  });
}

/** Importa ingresos o gastos desde Excel; cada fila pasa por las validaciones de un registro manual. */
function accionImportarMovimientos_(d, usuario) {
  const tipo = d.tipo === 'EGRESO' ? 'EGRESO' : 'INGRESO';
  const filas = Array.isArray(d.filas) ? d.filas.slice(0, 300) : [];
  if (!filas.length) throw new Error('El archivo no trae registros.');
  const cats = leerTabla_(HOJAS.CATEGORIAS).filter(function (c) { return c.tipo === tipo && c.activa === 'SI'; });
  const errores = [], numeros = [];
  // Un Excel exportado por el sistema trae el número (RI-/CE-): esos registros ya existen y no se duplican.
  const existentes = {};
  leerTabla_(HOJAS.MOVIMIENTOS).forEach(function (m) { existentes[m.numero] = true; });
  let repetidos = 0;
  filas.forEach(function (f, i) {
    if (f.numero && existentes[String(f.numero).trim()]) { repetidos++; return; }
    try {
      // Categoría y medio de pago sin distinguir mayúsculas ni tildes.
      const cat = cats.filter(function (c) { return normalizarNombre_(c.nombre) === normalizarNombre_(f.categoria); })[0];
      const medio = MEDIOS_PAGO.filter(function (m) { return normalizarNombre_(m) === normalizarNombre_(f.medio_pago || 'Efectivo'); })[0];
      const r = accionCrearMovimiento_({ tipo: tipo, fecha: f.fecha, categoria: cat ? cat.nombre : f.categoria, medio_pago: medio || f.medio_pago,
        valor: f.valor, concepto: f.concepto, tercero: f.tercero, tercero_doc: f.tercero_doc, referencia: f.referencia }, usuario);
      numeros.push(r.numero);
    } catch (e) {
      errores.push('Fila ' + (f.fila || i + 2) + ': ' + e.message);
    }
  });
  return { agregados: numeros.length, numeros: numeros, repetidos: repetidos, errores: errores };
}

function accionAnularMovimiento_(d, usuario) {
  const motivo = String(d.motivo || '').trim();
  if (motivo.length < 5) throw new Error('Escriba el motivo de la anulación.');
  return conBloqueo_(function () {
    const m = leerTabla_(HOJAS.MOVIMIENTOS).filter(function (x) { return x.id === d.id; })[0];
    if (!m) throw new Error('Movimiento no encontrado.');
    if (m.estado !== 'ACTIVO') throw new Error('El movimiento ya estaba anulado.');
    if (diaCerrado_(m.fecha)) throw new Error('La caja del ' + m.fecha + ' está cerrada. Un administrador debe reabrirla.');
    if (m.conciliacion_id) throw new Error('El movimiento ya fue conciliado con Nequi (' + m.conciliacion_id + ').');
    actualizarFila_(HOJAS.MOVIMIENTOS, m._fila, { estado: 'ANULADO', anulado_por: usuario.email, anulado_en: ahora_(), motivo_anulacion: motivo });
    auditar_(usuario, 'ANULAR', 'Movimiento', m.numero, motivo);
    return true;
  });
}

/** Saldos acumulados de caja y Nequi hasta una fecha (inclusive). */
function saldos_(hasta) {
  const s = { CAJA: Number(cfg_('SALDO_INICIAL_CAJA')) || 0, NEQUI: Number(cfg_('SALDO_INICIAL_NEQUI')) || 0 };
  movimientosActivos_().forEach(function (m) {
    if (hasta && m.fecha > hasta) return;
    const v = Number(m.valor) || 0;
    if (m.tipo === 'INGRESO') s[m.cuenta] += v;
    else if (m.tipo === 'EGRESO') s[m.cuenta] -= v;
    else if (m.tipo === 'TRASLADO') { s[m.cuenta] -= v; s[m.cuenta_destino] += v; }
  });
  return s;
}

function diaAnterior_(fecha) {
  const p = fecha.split('-').map(Number);
  const dt = new Date(p[0], p[1] - 1, p[2] - 1, 12);
  return Utilities.formatDate(dt, APP.TZ, 'yyyy-MM-dd');
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────────────────────

function accionDashboard_(d, usuario) {
  const hoy = hoy_();
  const mes = hoy.slice(0, 7);
  const movs = movimientosActivos_();
  const saldos = saldos_();
  const k = { ingresosMes: 0, egresosMes: 0, diezmosMes: 0, ofrendasMes: 0, ingresosHoy: 0, egresosHoy: 0 };
  const porCategoriaEgreso = {};
  const porCategoriaIngreso = {};
  const catDiezmo = categoriaDiezmos_();

  // Serie de los últimos 6 meses
  const meses = [];
  const p = hoy.split('-').map(Number);
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(p[0], p[1] - 1 - i, 1, 12);
    meses.push({ mes: Utilities.formatDate(dt, APP.TZ, 'yyyy-MM'), ingresos: 0, egresos: 0 });
  }
  const idxMes = {};
  meses.forEach(function (m, i) { idxMes[m.mes] = i; });

  movs.forEach(function (m) {
    const v = Number(m.valor) || 0;
    const mm = String(m.fecha).slice(0, 7);
    if (m.tipo === 'INGRESO') {
      if (idxMes[mm] !== undefined) meses[idxMes[mm]].ingresos += v;
      if (mm === mes) {
        k.ingresosMes += v;
        porCategoriaIngreso[m.categoria] = (porCategoriaIngreso[m.categoria] || 0) + v;
        // Los diezmos de una semana cerrada se cuentan desde la hoja Semanas (más abajo).
        if (m.categoria === catDiezmo) { if (!/^SEM-/.test(String(m.referencia))) k.diezmosMes += v; } else k.ofrendasMes += v;
      }
      if (m.fecha === hoy) k.ingresosHoy += v;
    } else if (m.tipo === 'EGRESO') {
      if (idxMes[mm] !== undefined) meses[idxMes[mm]].egresos += v;
      if (mm === mes) { k.egresosMes += v; porCategoriaEgreso[m.categoria] = (porCategoriaEgreso[m.categoria] || 0) + v; }
      if (m.fecha === hoy) k.egresosHoy += v;
    }
  });

  // Los diezmos de las semanas cerradas se liquidan al pastor y no entran como ingreso; se muestran aparte.
  k.liquidadoMes = 0;
  leerTabla_(HOJAS.SEMANAS).forEach(function (s) {
    if (s.estado !== 'CERRADA' || String(s.domingo).slice(0, 7) !== mes) return;
    k.diezmosMes += Number(s.total_diezmos) || 0;
    k.liquidadoMes += (Number(s.total_diezmos) || 0) - (Number(s.total_aportes) || 0);
  });

  const ordenar = function (o) {
    return Object.keys(o).map(function (c) { return { categoria: c, valor: o[c] }; })
      .sort(function (a, b) { return b.valor - a.valor; });
  };

  return {
    hoy: hoy,
    saldoCaja: saldos.CAJA,
    saldoNequi: saldos.NEQUI,
    kpis: k,
    serie: meses,
    egresosPorCategoria: ordenar(porCategoriaEgreso),
    ingresosPorCategoria: ordenar(porCategoriaIngreso),
    presupuesto: resumenPresupuesto_(hoy.slice(0, 4)),
    ultimos: puede_(usuario, 'movimientos.ver') ? accionListarMovimientos_({ limite: 8 }) : [],
    cajaHoyCerrada: diaCerrado_(hoy),
    diasSinCerrar: diasSinCerrar_(),
    ultimaConciliacion: (leerTabla_(HOJAS.CONCILIACIONES).slice(-1)[0] || {}).fecha || '',
    proximosEventos: puede_(usuario, 'eventos.ver') ? eventosActivos_().filter(function (e) { return e.fecha >= hoy; }).slice(0, 5) : [],
    cumpleanos: cumpleanosDelMes_(hoy),
    miembros: miembrosResumen_(),
  };
}

/** La primera categoría de ingreso cuyo nombre empieza por "Diezmo" (por si la renombran). */
function categoriaDiezmos_() {
  const c = leerTabla_(HOJAS.CATEGORIAS).filter(function (x) { return x.tipo === 'INGRESO' && /^diezmo/i.test(x.nombre); })[0];
  return c ? c.nombre : 'Diezmos';
}

function diasSinCerrar_() {
  const cerrados = {};
  cierresActivos_().forEach(function (c) { cerrados[c.fecha] = true; });
  const dias = {};
  movimientosActivos_().forEach(function (m) { if (!cerrados[m.fecha] && m.fecha < hoy_()) dias[m.fecha] = true; });
  return Object.keys(dias).sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// CIERRE DIARIO DE CAJA (doble control: quien cierra + quien verifica el conteo)
// ─────────────────────────────────────────────────────────────────────────────

function cierresActivos_() {
  return leerTabla_(HOJAS.CIERRES).filter(function (c) { return c.estado === 'CERRADO'; });
}

function diaCerrado_(fecha) {
  return cierresActivos_().some(function (c) { return c.fecha === fecha; });
}

function datosDia_(fecha) {
  const movs = movimientosActivos_().filter(function (m) { return m.fecha === fecha; });
  const inicial = saldos_(diaAnterior_(fecha));
  const r = { fecha: fecha, movimientos: movs, saldoInicialCaja: inicial.CAJA, saldoInicialNequi: inicial.NEQUI,
    ingresosCaja: 0, egresosCaja: 0, ingresosNequi: 0, egresosNequi: 0, totalIngresos: 0, totalEgresos: 0, porCategoria: {} };
  const col = { CAJA: 'Caja', NEQUI: 'Nequi' };
  movs.forEach(function (m) {
    const v = Number(m.valor) || 0;
    if (m.tipo === 'INGRESO') {
      r.totalIngresos += v;
      r['ingresos' + col[m.cuenta]] += v;
      r.porCategoria[m.categoria] = (r.porCategoria[m.categoria] || 0) + v;
    } else if (m.tipo === 'EGRESO') {
      r.totalEgresos += v;
      r['egresos' + col[m.cuenta]] += v;
      r.porCategoria[m.categoria] = (r.porCategoria[m.categoria] || 0) - v;
    } else {
      r['egresos' + col[m.cuenta]] += v;
      r['ingresos' + col[m.cuenta_destino]] += v;
    }
  });
  r.saldoEsperadoCaja = r.saldoInicialCaja + r.ingresosCaja - r.egresosCaja;
  r.saldoNequi = r.saldoInicialNequi + r.ingresosNequi - r.egresosNequi;
  return r;
}

function accionPreviaCierre_(d) {
  const fecha = d.fecha || hoy_();
  const r = datosDia_(fecha);
  r.cerrado = diaCerrado_(fecha);
  r.movimientos = r.movimientos.map(limpiar_);
  r.verificador = cfg_('VERIFICADOR');
  return r;
}

function accionCerrarCaja_(d, usuario) {
  const fecha = d.fecha || hoy_();
  if (fecha > hoy_()) throw new Error('No se puede cerrar una fecha futura.');
  const verificador = String(d.verificado_por || '').trim();
  if (verificador.length < 3) throw new Error('Escriba el nombre de quien verificó el conteo (doble control).');
  return conBloqueo_(function () {
    if (diaCerrado_(fecha)) throw new Error('La caja del ' + fecha + ' ya está cerrada.');
    const r = datosDia_(fecha);
    const den = d.denominaciones || {};
    let contado = 0;
    DENOMINACIONES.forEach(function (v) { contado += v * (Math.max(0, Math.floor(Number(den[v]) || 0))); });
    if (d.efectivo_contado !== undefined && d.efectivo_contado !== '' && contado === 0) contado = Math.round(Number(d.efectivo_contado)) || 0;
    const cierre = {
      id: siguienteNumero_('CC'), fecha: fecha,
      saldo_inicial_caja: r.saldoInicialCaja, ingresos_caja: r.ingresosCaja, egresos_caja: r.egresosCaja,
      saldo_esperado_caja: r.saldoEsperadoCaja, efectivo_contado: contado, diferencia: contado - r.saldoEsperadoCaja,
      saldo_nequi: r.saldoNequi, denominaciones: JSON.stringify(den), observaciones: String(d.observaciones || '').trim(),
      estado: 'CERRADO', cerrado_por: usuario.email, verificado_por: verificador, cerrado_en: ahora_(),
    };
    if (cierre.diferencia !== 0 && !cierre.observaciones) {
      throw new Error('Hay una diferencia de ' + pesos_(cierre.diferencia) + '. Explíquela en observaciones para cerrar.');
    }
    const pdf = guardarPdf_(htmlReporteDiario_(r, cierre, usuario), 'Cierres de caja/' + fecha.slice(0, 4),
      'Cierre de caja ' + fecha + ' ' + cierre.id);
    cierre.pdf_url = pdf.url;
    agregarFila_(HOJAS.CIERRES, cierre);
    // Marca los movimientos del día con el cierre
    r.movimientos.forEach(function (m) { actualizarFila_(HOJAS.MOVIMIENTOS, m._fila, { cierre_id: cierre.id }); });
    registrarReporte_(fecha, 'Cierre de caja', pdf, usuario);
    auditar_(usuario, 'CERRAR', 'Caja', cierre.id, { fecha: fecha, diferencia: cierre.diferencia, verificado_por: verificador });
    return limpiar_(cierre);
  });
}

function accionReabrirCaja_(d, usuario) {
  const motivo = String(d.motivo || '').trim();
  if (motivo.length < 5) throw new Error('Escriba el motivo de la reapertura.');
  return conBloqueo_(function () {
    const c = cierresActivos_().filter(function (x) { return x.id === d.id; })[0];
    if (!c) throw new Error('Cierre no encontrado.');
    actualizarFila_(HOJAS.CIERRES, c._fila, { estado: 'REABIERTO', observaciones: (c.observaciones ? c.observaciones + ' | ' : '') + 'Reabierto: ' + motivo });
    auditar_(usuario, 'REABRIR', 'Caja', c.id, motivo);
    return true;
  });
}

function accionListarCierres_() {
  return leerTabla_(HOJAS.CIERRES).map(limpiar_).sort(function (a, b) { return b.fecha.localeCompare(a.fecha); }).slice(0, 60);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCILIACIÓN NEQUI
// Se compara el saldo que muestra la app de Nequi con el del sistema y se marcan
// los movimientos que aparecen en el historial de Nequi.
// ─────────────────────────────────────────────────────────────────────────────

function accionPreviaConciliacion_(d) {
  const fecha = d.fecha || hoy_();
  const pendientes = movimientosActivos_().filter(function (m) {
    return m.fecha <= fecha && !m.conciliacion_id && (m.cuenta === 'NEQUI' || m.cuenta_destino === 'NEQUI');
  }).map(function (m) {
    const o = limpiar_(m);
    o.efecto = (m.tipo === 'INGRESO' || m.cuenta_destino === 'NEQUI') ? Number(m.valor) : -Number(m.valor);
    return o;
  }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  const ult = leerTabla_(HOJAS.CONCILIACIONES).slice(-1)[0];
  return { fecha: fecha, saldoSistema: saldos_(fecha).NEQUI, pendientes: pendientes, ultima: ult ? limpiar_(ult) : null };
}

function accionConciliarNequi_(d, usuario) {
  const fecha = d.fecha || hoy_();
  if (d.saldo_nequi === '' || d.saldo_nequi === undefined || isNaN(Number(d.saldo_nequi))) throw new Error('Escriba el saldo que muestra la app de Nequi.');
  const saldoNequi = Math.round(Number(d.saldo_nequi));
  const ids = d.ids || [];
  return conBloqueo_(function () {
    const previa = accionPreviaConciliacion_({ fecha: fecha });
    const dif = saldoNequi - previa.saldoSistema;
    const obs = String(d.observaciones || '').trim();
    if (dif !== 0 && !obs) throw new Error('El saldo de Nequi difiere en ' + pesos_(dif) + '. Explique la diferencia en observaciones.');
    const conc = { id: siguienteNumero_('CN'), fecha: fecha, saldo_sistema: previa.saldoSistema, saldo_nequi: saldoNequi,
      diferencia: dif, movimientos: ids.length, observaciones: obs, registrado_por: usuario.email, registrado_en: ahora_() };
    const marcados = previa.pendientes.filter(function (m) { return ids.indexOf(m.id) !== -1; });
    const pdf = guardarPdf_(htmlConciliacion_(conc, marcados, previa.pendientes.filter(function (m) { return ids.indexOf(m.id) === -1; }), usuario),
      'Conciliaciones Nequi/' + fecha.slice(0, 4), 'Conciliación Nequi ' + fecha + ' ' + conc.id);
    conc.pdf_url = pdf.url;
    agregarFila_(HOJAS.CONCILIACIONES, conc);
    const filas = {};
    leerTabla_(HOJAS.MOVIMIENTOS).forEach(function (m) { filas[m.id] = m._fila; });
    marcados.forEach(function (m) { actualizarFila_(HOJAS.MOVIMIENTOS, filas[m.id], { conciliacion_id: conc.id }); });
    registrarReporte_(fecha, 'Conciliación Nequi', pdf, usuario);
    auditar_(usuario, 'CONCILIAR', 'Nequi', conc.id, { diferencia: dif, movimientos: ids.length });
    return limpiar_(conc);
  });
}

function accionListarConciliaciones_() {
  return leerTabla_(HOJAS.CONCILIACIONES).map(limpiar_).reverse().slice(0, 36);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESUPUESTO ANUAL
// ─────────────────────────────────────────────────────────────────────────────

function resumenPresupuesto_(anio) {
  const ppto = {};
  leerTabla_(HOJAS.PRESUPUESTO).forEach(function (p) {
    if (String(p.anio) === String(anio)) ppto[p.tipo + '|' + p.categoria] = Number(p.valor) || 0;
  });
  const ejec = {};
  movimientosActivos_().forEach(function (m) {
    if (String(m.fecha).slice(0, 4) !== String(anio) || m.tipo === 'TRASLADO') return;
    const k = m.tipo + '|' + m.categoria;
    ejec[k] = (ejec[k] || 0) + (Number(m.valor) || 0);
  });
  const hoy = hoy_();
  const fraccion = String(anio) < hoy.slice(0, 4) ? 1 : String(anio) > hoy.slice(0, 4) ? 0 : Number(hoy.slice(5, 7)) / 12;
  const filas = leerTabla_(HOJAS.CATEGORIAS).filter(function (c) { return c.activa === 'SI' || ppto[c.tipo + '|' + c.nombre] || ejec[c.tipo + '|' + c.nombre]; })
    .map(function (c) {
      const k = c.tipo + '|' + c.nombre;
      return { tipo: c.tipo, categoria: c.nombre, presupuesto: ppto[k] || 0, ejecutado: ejec[k] || 0 };
    });
  const tot = function (t, campo) { return filas.filter(function (f) { return f.tipo === t; }).reduce(function (a, f) { return a + f[campo]; }, 0); };
  return {
    anio: String(anio), fraccionAnio: fraccion, filas: filas,
    ingresos: { presupuesto: tot('INGRESO', 'presupuesto'), ejecutado: tot('INGRESO', 'ejecutado') },
    egresos: { presupuesto: tot('EGRESO', 'presupuesto'), ejecutado: tot('EGRESO', 'ejecutado') },
  };
}

function accionObtenerPresupuesto_(d) {
  return resumenPresupuesto_(d.anio || hoy_().slice(0, 4));
}

function accionGuardarPresupuesto_(d, usuario) {
  const anio = String(d.anio || '');
  if (!/^\d{4}$/.test(anio)) throw new Error('Año inválido.');
  const valores = d.valores || {};
  return conBloqueo_(function () {
    const existentes = {};
    leerTabla_(HOJAS.PRESUPUESTO).forEach(function (p) { if (String(p.anio) === anio) existentes[p.tipo + '|' + p.categoria] = p; });
    Object.keys(valores).forEach(function (k) {
      const v = Math.max(0, Math.round(Number(valores[k]) || 0));
      const partes = k.split('|');
      const ex = existentes[k];
      if (ex) {
        if (Number(ex.valor) !== v) actualizarFila_(HOJAS.PRESUPUESTO, ex._fila, { valor: v, actualizado_por: usuario.email, actualizado_en: ahora_() });
      } else if (v > 0) {
        agregarFila_(HOJAS.PRESUPUESTO, { anio: anio, tipo: partes[0], categoria: partes.slice(1).join('|'), valor: v,
          actualizado_por: usuario.email, actualizado_en: ahora_() });
      }
    });
    auditar_(usuario, 'EDITAR', 'Presupuesto', anio, Object.keys(valores).length + ' categorías');
    return resumenPresupuesto_(anio);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INFORME SEMANAL DE INGRESOS (formato F JL 02)
// Todos los usuarios diligencian campos durante la semana; el domingo el
// tesorero o el administrador cierra y firma. Cálculos iguales a los del Excel:
//   diezmos del día = conteo de billetes + monedas + Nequi
//   21 % del total · 5 % de (total − 21 %) · 2 % de (total − 21 % − 5 %)
//   total ofrendas = subtotal de cultos − egresos
//   total general  = aportes (21 % + 5 % + 2 %) + total ofrendas + cultos en sectores
//   para cerrar, los egresos no pueden superar aportes + ofrendas + sectores
// ─────────────────────────────────────────────────────────────────────────────

const BILLETES_SEMANA = [100000, 50000, 20000, 10000, 5000, 2000];
const FILAS_EXTRA = 3;
const FILAS_EGRESOS = 5;

function listaConfig_(clave, porDefecto) {
  const v = String(cfg_(clave) || '').trim();
  return (v ? v.split(',') : porDefecto).map(function (x) { return String(x).trim(); }).filter(Boolean);
}

function porcentajesSemana_() {
  return [Number(cfg_('PORC_APORTE_1')) || 21, Number(cfg_('PORC_APORTE_2')) || 5, Number(cfg_('PORC_APORTE_3')) || 2];
}

/** Domingo (aaaa-mm-dd) de la semana lunes–domingo que contiene la fecha. */
function domingoDe_(fecha) {
  const p = String(fecha).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2], 12);
  d.setDate(d.getDate() + (7 - d.getDay()) % 7);
  return Utilities.formatDate(d, APP.TZ, 'yyyy-MM-dd');
}

function sumarDias_(fecha, n) {
  const p = String(fecha).split('-').map(Number);
  return Utilities.formatDate(new Date(p[0], p[1] - 1, p[2] + n, 12), APP.TZ, 'yyyy-MM-dd');
}

function semanaVacia_() {
  const conteo = { monedas: 0, nequi: 0 };
  BILLETES_SEMANA.forEach(function (b) { conteo[b] = 0; });
  const cultos = listaConfig_('CULTOS_SEMANALES', CULTOS_POR_DEFECTO).map(function (n) { return { nombre: n, promedio: '', realizado: false, fecha: '', ofrenda: 0 }; });
  const sectores = listaConfig_('SECTORES', SECTORES_POR_DEFECTO).map(function (n) { return { nombre: n, fecha: '', ofrenda: 0 }; });
  for (let i = 0; i < FILAS_EXTRA; i++) {
    cultos.push({ nombre: '', promedio: '', realizado: false, fecha: '', ofrenda: 0 });
    sectores.push({ nombre: '', fecha: '', ofrenda: 0 });
  }
  const egresos = [];
  for (let i = 0; i < FILAS_EGRESOS; i++) egresos.push({ detalle: '', valor: 0 });
  return { conteo: conteo, diezmos: { noche: 0, sobres: 0 }, cultos: cultos, sectores: sectores, egresos: egresos, observaciones: '' };
}

/** Misma lógica que calcSemana() en Scripts.html. */
function calcularSemana_(d, porc) {
  const n = function (v) { return Math.round(Number(v) || 0); };
  const billetes = BILLETES_SEMANA.reduce(function (a, b) { return a + b * n(d.conteo[b]); }, 0);
  const conteo = billetes + n(d.conteo.monedas) + n(d.conteo.nequi);
  const fila = function (v) {
    const a1 = Math.round(v * porc[0] / 100);
    const a2 = Math.round((v - a1) * porc[1] / 100);
    const a3 = Math.round((v - a1 - a2) * porc[2] / 100);
    return { diezmos: v, a1: a1, a2: a2, a3: a3, neto: v - a1 - a2 - a3 };
  };
  const dia = fila(conteo), noche = fila(n(d.diezmos.noche)), sobres = fila(n(d.diezmos.sobres));
  const total = fila(dia.diezmos + noche.diezmos + sobres.diezmos);
  const subtotalOfrendas = d.cultos.reduce(function (a, c) { return a + n(c.ofrenda); }, 0);
  const totalEgresos = d.egresos.reduce(function (a, e) { return a + n(e.valor); }, 0);
  const totalSectores = d.sectores.reduce(function (a, s) { return a + n(s.ofrenda); }, 0);
  const totalAportes = total.a1 + total.a2 + total.a3;
  const totalOfrendas = subtotalOfrendas - totalEgresos;
  const totalGeneral = totalAportes + totalOfrendas + totalSectores;
  return {
    porcentajes: porc, billetes: billetes, conteo: conteo, dia: dia, noche: noche, sobres: sobres, total: total,
    netoMenosNequi: total.neto - n(d.conteo.nequi), totalAportes: totalAportes,
    subtotalOfrendas: subtotalOfrendas, totalEgresos: totalEgresos, totalOfrendas: totalOfrendas,
    totalSectores: totalSectores, totalGeneral: totalGeneral, letras: numeroALetras_(totalGeneral),
  };
}

function filaSemana_(id) {
  return leerTabla_(HOJAS.SEMANAS).filter(function (s) { return s.id === id; })[0] || null;
}

function semanaPublica_(fila, domingo) {
  const porc = porcentajesSemana_();
  let datos = semanaVacia_();
  let o = { id: 'SEM-' + domingo, domingo: domingo, lunes: sumarDias_(domingo, -6), estado: 'ABIERTA', nueva: true };
  if (fila) {
    o = limpiar_(fila);
    try { datos = JSON.parse(fila.datos); } catch (e) { /* datos dañados: se muestran vacíos */ }
    delete o.datos;
  }
  o.datos = datos;
  o.calculo = calcularSemana_(datos, porc);
  o.billetes = BILLETES_SEMANA;
  return o;
}

function accionObtenerSemana_(d) {
  const domingo = domingoDe_(d.fecha || hoy_());
  return semanaPublica_(filaSemana_('SEM-' + domingo), domingo);
}

function accionListarSemanas_() {
  return leerTabla_(HOJAS.SEMANAS).map(function (s) {
    const o = limpiar_(s); delete o.datos; delete o.firma_img; return o;
  }).sort(function (a, b) { return b.domingo.localeCompare(a.domingo); }).slice(0, 30);
}

const RUTAS_SEMANA = [
  [/^conteo\.(100000|50000|20000|10000|5000|2000|monedas|nequi)$/, 'num'],
  [/^diezmos\.(noche|sobres)$/, 'num'],
  [/^cultos\.(\d+)\.(ofrenda|promedio)$/, 'num'],
  [/^cultos\.(\d+)\.realizado$/, 'bool'],
  [/^(cultos|sectores)\.(\d+)\.fecha$/, 'fecha'],
  [/^(cultos|sectores)\.(\d+)\.nombre$/, 'texto'],
  [/^sectores\.(\d+)\.ofrenda$/, 'num'],
  [/^egresos\.(\d+)\.valor$/, 'num'],
  [/^egresos\.(\d+)\.detalle$/, 'texto'],
  [/^observaciones$/, 'texto'],
];

/** Guarda solo los campos que cambió el usuario, para no pisar lo que otros diligenciaron. */
function accionGuardarSemana_(d, usuario) {
  const domingo = domingoDe_(d.domingo || hoy_());
  const cambios = d.cambios || {};
  const claves = Object.keys(cambios);
  if (!claves.length) throw new Error('No hay cambios para guardar.');
  return conBloqueo_(function () {
    const id = 'SEM-' + domingo;
    const fila = filaSemana_(id);
    if (fila && fila.estado === 'CERRADA') throw new Error('La semana ya fue cerrada y firmada. Solo un administrador puede reabrirla.');
    const datos = fila ? JSON.parse(fila.datos) : semanaVacia_();
    claves.forEach(function (ruta) {
      const regla = RUTAS_SEMANA.filter(function (r) { return r[0].test(ruta); })[0];
      if (!regla) throw new Error('Campo no válido: ' + ruta);
      let v = cambios[ruta];
      if (regla[1] === 'num') { v = Math.round(Number(String(v).replace(/[^\d-]/g, '')) || 0); if (v < 0) throw new Error('Los valores no pueden ser negativos.'); }
      if (regla[1] === 'bool') v = v === true || v === 'true';
      if (regla[1] === 'fecha') { v = String(v || ''); if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Fecha inválida.'); }
      if (regla[1] === 'texto') v = String(v || '').slice(0, ruta === 'observaciones' ? 2000 : 120);
      const partes = ruta.split('.');
      let obj = datos;
      for (let i = 0; i < partes.length - 1; i++) {
        obj = obj[partes[i]];
        if (obj === undefined || obj === null) throw new Error('Campo no válido: ' + ruta);
      }
      obj[partes[partes.length - 1]] = v;
    });
    const c = calcularSemana_(datos, porcentajesSemana_());
    const registro = {
      datos: JSON.stringify(datos), total_diezmos: c.total.diezmos, aporte_1: c.total.a1, aporte_2: c.total.a2, aporte_3: c.total.a3,
      neto_diezmos: c.total.neto, neto_menos_nequi: c.netoMenosNequi, total_aportes: c.totalAportes,
      subtotal_ofrendas: c.subtotalOfrendas, total_egresos: c.totalEgresos, total_ofrendas: c.totalOfrendas,
      total_sectores: c.totalSectores, total_general: c.totalGeneral, actualizado_por: usuario.email, actualizado_en: ahora_(),
    };
    if (fila) actualizarFila_(HOJAS.SEMANAS, fila._fila, registro);
    else {
      registro.id = id; registro.domingo = domingo; registro.lunes = sumarDias_(domingo, -6); registro.estado = 'ABIERTA';
      agregarFila_(HOJAS.SEMANAS, registro);
    }
    auditar_(usuario, 'EDITAR', 'Semana', id, claves.join(', '));
    return semanaPublica_(filaSemana_(id), domingo);
  });
}

/** Asegura que exista la categoría (sin distinguir mayúsculas) y devuelve su nombre. */
function asegurarCategoria_(tipo, nombre) {
  const c = leerTabla_(HOJAS.CATEGORIAS).filter(function (x) { return x.tipo === tipo && x.nombre.toLowerCase() === nombre.toLowerCase(); })[0];
  if (c) {
    if (c.activa !== 'SI') actualizarFila_(HOJAS.CATEGORIAS, c._fila, { activa: 'SI' });
    return c.nombre;
  }
  agregarFila_(HOJAS.CATEGORIAS, { id: siguienteNumero_('CAT'), tipo: tipo, nombre: nombre, activa: 'SI' });
  return nombre;
}

/** Pasa la semana cerrada al libro de movimientos (fecha: el domingo). */
function contabilizarSemana_(sem, datos, c, usuario) {
  const f = sem.domingo;
  if (diaCerrado_(f)) throw new Error('La caja del ' + f + ' ya está cerrada. Cierre la semana antes que la caja del domingo, o pida al administrador reabrir la caja.');
  const ref = sem.id;
  const crear = function (o) {
    o.fecha = f; o.referencia = ref;
    if (Number(o.valor) > 0) accionCrearMovimiento_(o, usuario);
  };
  // Los diezmos se liquidan al pastor: su neto no es ingreso de la iglesia. Solo quedan en contabilidad
  // los aportes (21 % + 5 % + 2 %) y, si así se configura, lo que llegó por Nequi y no se le entrega.
  const liq = liquidacionDiezmos_(c, datos);
  crear({ tipo: 'INGRESO', categoria: asegurarCategoria_('INGRESO', 'Aportes de diezmos'), medio_pago: 'Efectivo', valor: liq.cajaIglesia,
    concepto: 'Aportes de diezmos (' + c.porcentajes.join('% + ') + '%) · ' + ref });
  crear({ tipo: 'INGRESO', categoria: asegurarCategoria_('INGRESO', categoriaDiezmos_()), medio_pago: 'Nequi', valor: liq.nequiIglesia,
    concepto: 'Diezmos por Nequi no liquidados al pastor · ' + ref });
  datos.cultos.concat(datos.sectores).forEach(function (x) {
    if (Number(x.ofrenda) > 0) {
      const nombre = String(x.nombre || '').trim() || 'Otros ingresos';
      crear({ tipo: 'INGRESO', categoria: asegurarCategoria_('INGRESO', nombre), medio_pago: 'Efectivo', valor: x.ofrenda, concepto: 'Ofrenda ' + nombre + ' · ' + ref });
    }
  });
  const catEgreso = asegurarCategoria_('EGRESO', 'Gastos de cultos semanales');
  datos.egresos.forEach(function (e) {
    if (Number(e.valor) > 0) {
      crear({ tipo: 'EGRESO', categoria: catEgreso, medio_pago: 'Efectivo', valor: e.valor, tercero: e.detalle || 'Egreso semanal', concepto: (e.detalle || 'Egreso semanal') + ' · ' + ref });
    }
  });
}

/**
 * Liquidación de diezmos al pastor.
 *   neto      = total diezmos − aportes (21 % + 5 % + 2 %)
 *   efectivo  = neto − lo recibido por Nequi (lo que se le entrega en mano)
 * Lo que queda en caja para la iglesia son los aportes.
 */
function liquidacionDiezmos_(c, datos) {
  const nequi = Math.round(Number(datos.conteo.nequi) || 0);
  const alPastor = String(cfg_('NEQUI_DIEZMOS_AL_PASTOR') || 'SI').toUpperCase() !== 'NO';
  const neto = c.total.neto;
  const efectivo = Math.max(0, neto - nequi);
  const nequiPastor = alPastor ? Math.min(nequi, neto) : 0;
  const efectivoRecibido = c.total.diezmos - nequi;
  return {
    total: c.total.diezmos, aportes: c.totalAportes, neto: neto, nequi: nequi, efectivo: efectivo, nequiPastor: nequiPastor, alPastor: alPastor,
    pastorTotal: efectivo + nequiPastor,
    cajaIglesia: Math.max(0, efectivoRecibido - efectivo), nequiIglesia: nequi - nequiPastor,
  };
}

function accionPdfLiquidacion_(d, usuario) {
  const sem = accionObtenerSemana_({ fecha: d.domingo });
  if (!(sem.calculo.total.diezmos > 0)) throw new Error('La semana no tiene diezmos registrados.');
  const pdf = guardarPdf_(htmlLiquidacion_(sem, usuario), 'Liquidaciones de diezmos/' + sem.domingo.slice(0, 4),
    'Liquidación de diezmos ' + sem.domingo + (sem.estado === 'CERRADA' ? '' : ' (borrador)'));
  registrarReporte_(sem.domingo, 'Liquidación de diezmos' + (sem.estado === 'CERRADA' ? '' : ' (borrador)'), pdf, usuario);
  return pdf;
}

/** Comprobante para entregar al pastor, con el membrete y el formato de los demás PDF. */
function htmlLiquidacion_(sem, usuario) {
  const c = sem.calculo, p = c.porcentajes, $p = pesos_;
  const l = liquidacionDiezmos_(c, sem.datos);
  const cerrada = sem.estado === 'CERRADA';
  const pastor = cfg_('PASTOR') || '';
  const fila = function (t, v, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + t + '</td><td class="n">' + v + '</td></tr>'; };
  const cuerpo =
    '<div class="cajas"><div class="caja"><small>Comprobante N.º</small><b>LD-' + sem.domingo + '</b></div>' +
    '<div class="caja"><small>Semana</small><b style="font-size:10.5pt">' + fechaLarga_(sem.lunes) + ' al ' + fechaLarga_(sem.domingo) + '</b></div>' +
    '<div class="caja"><small>Pastor</small><b style="font-size:10.5pt">' + esc_(pastor || '—') + '</b></div></div>' +
    subtitulo_('Diezmos recibidos') +
    '<table><tr><th>Concepto</th><th class="n">Valor</th></tr>' +
    fila('Diezmos del día (conteo de billetes, monedas y Nequi)', $p(c.dia.diezmos)) + fila('Diezmos de la noche', $p(c.noche.diezmos)) + fila('Diezmos en sobres', $p(c.sobres.diezmos)) +
    fila('Total diezmos', $p(c.total.diezmos), 'tot') + '</table>' +
    subtitulo_('Liquidación') +
    '<table><tr><th>Concepto</th><th class="n">Valor</th></tr>' +
    fila('Total diezmos', $p(l.total)) +
    fila('(−) Descuento ' + p[0] + '% del total', $p(c.total.a1)) +
    fila('(−) Descuento ' + p[1] + '% de (total − ' + p[0] + '%)', $p(c.total.a2)) +
    fila('(−) Descuento ' + p[2] + '% del resto', $p(c.total.a3)) +
    fila('Total descuentos (aportes ' + p.join('% + ') + '%)', $p(l.aportes), 'tot') +
    fila('<b>Neto de diezmos para el pastor</b>', '<b>' + $p(l.neto) + '</b>') +
    fila('(−) Diezmos recibidos por Nequi' + (l.alPastor ? ' (se transfieren al pastor por Nequi)' : ' (quedan en la cuenta Nequi de la iglesia)'), $p(l.nequi)) +
    fila('VALOR A ENTREGAR EN EFECTIVO', $p(l.efectivo), 'tot') + '</table>' +
    '<div class="cajas"><div class="caja"><small>Se entrega en efectivo</small><b style="font-size:16pt">' + $p(l.efectivo) + '</b></div>' +
    (l.alPastor ? '<div class="caja"><small>Por Nequi</small><b>' + $p(l.nequiPastor) + '</b></div><div class="caja"><small>Total liquidado al pastor</small><b>' + $p(l.pastorTotal) + '</b></div>' : '') + '</div>' +
    '<div class="letras"><b>Valor en efectivo en letras:</b> ' + numeroALetras_(l.efectivo) + '</div>' +
    '<p style="font-size:9pt;color:#5b6475">Los descuentos (' + $p(l.aportes) + ') quedan en la tesorería de la congregación como aportes. El neto de diezmos no se cuenta como ingreso de la iglesia.</p>' +
    (cerrada
      ? '<div class="firmas"><div><div style="height:55px"></div><hr><b>' + esc_(sem.firmado_por) + '</b><br><small>Entregó · cerró la semana el ' + esc_(sem.cerrado_en) + '</small></div>' +
        '<div><div style="height:55px"></div><hr><b>' + esc_(pastor || 'Pastor') + '</b><br><small>Recibí a conformidad · Pastor<br>C.C. ____________________ Fecha: ____________</small></div></div>'
      : '<p style="text-align:center;margin-top:18px"><span class="sello" style="border-color:' + COLORES.AMARILLO + ';color:#9a6b00">BORRADOR · LA SEMANA NO SE HA CERRADO</span></p>');
  return plantillaPdf_('Comprobante de liquidación de diezmos', 'Semana del ' + fechaLarga_(sem.lunes) + ' al ' + fechaLarga_(sem.domingo), cuerpo, usuario);
}

function accionCerrarSemana_(d, usuario) {
  const domingo = domingoDe_(d.domingo || hoy_());
  // Ya no hay firma a mano: queda registrado el usuario que cierra (nombre y rol).
  const firmante = (String(usuario.nombre || '').trim() || usuario.email) + ' · ' + (NOMBRE_ROL[usuario.rol] || usuario.rol);
  if (hoy_() < domingo) throw new Error('La semana se cierra el domingo ' + domingo + ' o después.');
  return conBloqueo_(function () {
    const id = 'SEM-' + domingo;
    const fila = filaSemana_(id);
    if (!fila) throw new Error('La semana no tiene datos todavía.');
    if (fila.estado === 'CERRADA') throw new Error('La semana ya está cerrada.');
    const datos = JSON.parse(fila.datos);
    const c = calcularSemana_(datos, porcentajesSemana_());
    // Los aportes (21 % + 5 % + 2 %) cuentan como ingreso de la semana, junto con ofrendas y sectores.
    if (c.totalGeneral < 0) {
      throw new Error('Los egresos (' + pesos_(c.totalEgresos) + ') superan los ingresos de la semana: aportes + ofrendas + sectores = ' +
        pesos_(c.totalAportes + c.subtotalOfrendas + c.totalSectores) + '. Revise los valores antes de cerrar.');
    }
    const contabilizar = String(cfg_('CONTABILIZAR_SEMANA')).toUpperCase() !== 'NO';
    if (contabilizar) contabilizarSemana_({ id: id, domingo: domingo }, datos, c, usuario);
    const cierre = { estado: 'CERRADA', cerrado_por: usuario.email, firmado_por: firmante, cerrado_en: ahora_(), firma_img: '',
      contabilizado: contabilizar ? 'SI' : 'NO' };
    const sem = Object.assign(limpiar_(fila), cierre, { datos: datos, calculo: c });
    const pdf = guardarPdf_(htmlSemana_(sem, usuario), 'Informes semanales/' + domingo.slice(0, 4), 'Informe semanal ' + domingo);
    cierre.pdf_url = pdf.url;
    actualizarFila_(HOJAS.SEMANAS, fila._fila, cierre);
    registrarReporte_(domingo, 'Informe semanal', pdf, usuario);
    auditar_(usuario, 'CERRAR', 'Semana', id, { firmado_por: firmante, total_general: c.totalGeneral, contabilizado: cierre.contabilizado });
    return semanaPublica_(filaSemana_(id), domingo);
  });
}

function accionReabrirSemana_(d, usuario) {
  const motivo = String(d.motivo || '').trim();
  if (motivo.length < 5) throw new Error('Escriba el motivo de la reapertura.');
  const domingo = domingoDe_(d.domingo);
  return conBloqueo_(function () {
    const id = 'SEM-' + domingo;
    const fila = filaSemana_(id);
    if (!fila || fila.estado !== 'CERRADA') throw new Error('La semana no está cerrada.');
    if (fila.contabilizado === 'SI') {
      if (diaCerrado_(domingo)) throw new Error('La caja del ' + domingo + ' está cerrada. Reabra primero la caja de ese día.');
      leerTabla_(HOJAS.MOVIMIENTOS).filter(function (m) { return m.referencia === id && m.estado === 'ACTIVO'; }).forEach(function (m) {
        actualizarFila_(HOJAS.MOVIMIENTOS, m._fila, { estado: 'ANULADO', anulado_por: usuario.email, anulado_en: ahora_(), motivo_anulacion: 'Reapertura de ' + id + ': ' + motivo });
      });
    }
    actualizarFila_(HOJAS.SEMANAS, fila._fila, { estado: 'ABIERTA', firma_img: '', contabilizado: '', firmado_por: '', cerrado_en: '' });
    auditar_(usuario, 'REABRIR', 'Semana', id, motivo);
    return semanaPublica_(filaSemana_(id), domingo);
  });
}

function accionPdfSemana_(d, usuario) {
  const sem = accionObtenerSemana_({ fecha: d.domingo });
  if (sem.estado === 'CERRADA' && sem.pdf_url) return { url: sem.pdf_url, nombre: 'Informe semanal ' + sem.domingo };
  const fila = filaSemana_(sem.id);
  if (fila) sem.firma_img = fila.firma_img;
  const pdf = guardarPdf_(htmlSemana_(sem, usuario), 'Informes semanales/' + sem.domingo.slice(0, 4), 'Informe semanal ' + sem.domingo + ' (borrador)');
  registrarReporte_(sem.domingo, 'Informe semanal (borrador)', pdf, usuario);
  return pdf;
}

/** PDF con la misma estructura del formato en Excel. */
function htmlSemana_(sem, usuario) {
  const d = sem.datos, c = sem.calculo, p = c.porcentajes;
  const $p = pesos_;
  const fd = function (f) { return f ? f.slice(8, 10) + '/' + f.slice(5, 7) : ''; };
  const filaDz = function (t, r) { return '<tr><td>' + t + '</td><td class="n">' + $p(r.diezmos) + '</td><td class="n">' + $p(r.a1) + '</td><td class="n">' + $p(r.a2) + '</td><td class="n">' + $p(r.a3) + '</td><td class="n">' + $p(r.neto) + '</td></tr>'; };
  const conteo = BILLETES_SEMANA.map(function (b) {
    const q = Number(d.conteo[b]) || 0;
    return '<tr><td>' + $p(b) + '</td><td class="n">' + (q || '') + '</td><td class="n">' + (q ? $p(q * b) : '') + '</td></tr>';
  }).join('') + '<tr><td>Monedas</td><td></td><td class="n">' + $p(d.conteo.monedas) + '</td></tr>' +
    '<tr><td>Nequi</td><td></td><td class="n">' + $p(d.conteo.nequi) + '</td></tr>' +
    '<tr class="tot"><td colspan="2">Total</td><td class="n">' + $p(c.conteo) + '</td></tr>';
  const cultos = d.cultos.filter(function (x) { return x.nombre || Number(x.ofrenda); }).map(function (x) {
    return '<tr><td>' + esc_(x.nombre) + '</td><td class="n">' + esc_(x.promedio || '') + '</td><td style="text-align:center">' + (x.realizado ? 'Sí' : 'No') + '</td><td>' + fd(x.fecha) + '</td><td class="n">' + (Number(x.ofrenda) ? $p(x.ofrenda) : '') + '</td></tr>';
  }).join('');
  const sectores = d.sectores.filter(function (x) { return x.nombre || Number(x.ofrenda); }).map(function (x) {
    return '<tr><td>' + esc_(x.nombre) + '</td><td>' + fd(x.fecha) + '</td><td class="n">' + (Number(x.ofrenda) ? $p(x.ofrenda) : '') + '</td></tr>';
  }).join('');
  const egresos = d.egresos.filter(function (e) { return e.detalle || Number(e.valor); }).map(function (e, i) {
    return '<tr><td>' + (i + 1) + '</td><td>' + esc_(e.detalle) + '</td><td class="n">' + $p(e.valor) + '</td></tr>';
  }).join('') || '<tr><td colspan="3" style="color:#8a93a3">Sin egresos</td></tr>';
  const cerrada = sem.estado === 'CERRADA';
  const firma = cerrada
    ? '<div class="firmas"><div><div style="height:55px"></div><hr><b>' + esc_(sem.firmado_por) + '</b><br><small>Cerró la semana en el sistema · ' + esc_(sem.cerrado_en) +
      '<br>Usuario: ' + esc_(sem.cerrado_por) + '</small></div><div><div style="height:55px"></div><hr>' + esc_(cfg_('PASTOR') || 'Pastor') + '<br><small>Pastor</small></div></div>'
    : '<p style="text-align:center;margin-top:18px"><span class="sello" style="border-color:' + COLORES.AMARILLO + ';color:#9a6b00">BORRADOR · SEMANA SIN CERRAR</span></p>';
  const css = '<style>.mini th,.mini td{font-size:8.5pt;padding:3px 5px}.dos{display:table;width:100%;border-spacing:10px 0;margin:0 -10px}.dos>div{display:table-cell;vertical-align:top}</style>';
  const cuerpo = css +
    subtitulo_('Informe de diezmos') +
    '<table class="mini"><tr><th>IT</th><th class="n">Diezmos</th><th class="n">' + p[0] + '%</th><th class="n">' + p[1] + '%</th><th class="n">' + p[2] + '%</th><th class="n">Neto</th></tr>' +
    filaDz('Día', c.dia) + filaDz('Noche', c.noche) + filaDz('Sobres', c.sobres) +
    '<tr class="tot"><td>Total</td><td class="n">' + $p(c.total.diezmos) + '</td><td class="n">' + $p(c.total.a1) + '</td><td class="n">' + $p(c.total.a2) + '</td><td class="n">' + $p(c.total.a3) + '</td><td class="n">' + $p(c.total.neto) + '</td></tr></table>' +
    '<table class="kv mini"><tr><td>Total suma de aportes (' + p.join('% + ') + '%)</td><td class="n"><b>' + $p(c.totalAportes) + '</b></td><td>Neto menos Nequi</td><td class="n"><b>' + $p(c.netoMenosNequi) + '</b></td></tr></table>' +
    '<div class="dos"><div style="width:62%">' + subtitulo_('Relación de cultos semanales') +
    '<table class="mini"><tr><th>Cultos</th><th class="n">Promedio</th><th>¿Se realizó?</th><th>Fecha</th><th class="n">Ofrenda</th></tr>' + cultos +
    '<tr><td colspan="4"><b>Subtotal</b></td><td class="n"><b>' + $p(c.subtotalOfrendas) + '</b></td></tr>' +
    '<tr><td colspan="4">(−) Egresos</td><td class="n">' + $p(c.totalEgresos) + '</td></tr>' +
    '<tr class="tot"><td colspan="4">Total ofrendas</td><td class="n">' + $p(c.totalOfrendas) + '</td></tr></table></div>' +
    '<div>' + subtitulo_('Diezmos · conteo de billetes') + '<table class="mini"><tr><th>Billete</th><th class="n">Cant.</th><th class="n">Valor</th></tr>' + conteo + '</table></div></div>' +
    '<div class="dos"><div style="width:50%">' + subtitulo_('Cultos en los sectores') +
    '<table class="mini"><tr><th>Cultos de barrio</th><th>Fecha</th><th class="n">Ofrenda</th></tr>' + sectores +
    '<tr class="tot"><td colspan="2">Total ofrendas</td><td class="n">' + $p(c.totalSectores) + '</td></tr></table></div>' +
    '<div>' + subtitulo_('Egresos') + '<table class="mini"><tr><th>No.</th><th>Detalle</th><th class="n">Valor</th></tr>' + egresos +
    '<tr class="tot"><td colspan="2">Total</td><td class="n">' + $p(c.totalEgresos) + '</td></tr></table></div></div>' +
    '<div class="cajas"><div class="caja"><small>Total general ingresos</small><b style="font-size:15pt">' + $p(c.totalGeneral) + '</b></div></div>' +
    '<div class="letras"><b>Valor en letras:</b> ' + c.letras + '</div>' +
    (d.observaciones ? '<div class="letras" style="border-left-color:' + COLORES.AZUL_CLARO + '"><b>Observaciones:</b> ' + esc_(d.observaciones) + '</div>' : '') +
    firma + '<p style="font-size:7.5pt;color:#8a93a3;text-align:right;margin:8px 0 0">F JL 02 · Versión 4</p>';
  return plantillaPdf_('Relación de ingresos cultos semanales',
    'Semana del ' + fechaLarga_(sem.lunes) + ' al ' + fechaLarga_(sem.domingo) + (sem.contabilizado === 'SI' ? ' · Registrada en contabilidad' : ''), cuerpo, usuario);
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTES
// ─────────────────────────────────────────────────────────────────────────────

function resumenPeriodo_(desde, hasta) {
  const movs = movimientosActivos_().filter(function (m) { return m.fecha >= desde && m.fecha <= hasta; });
  const inicial = saldos_(diaAnterior_(desde));
  const final = saldos_(hasta);
  const ing = {}, egr = {};
  let ti = 0, te = 0;
  movs.forEach(function (m) {
    const v = Number(m.valor) || 0;
    if (m.tipo === 'INGRESO') { ing[m.categoria] = (ing[m.categoria] || 0) + v; ti += v; }
    if (m.tipo === 'EGRESO') { egr[m.categoria] = (egr[m.categoria] || 0) + v; te += v; }
  });
  const lista = function (o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).map(function (k) { return { categoria: k, valor: o[k] }; }); };
  return { desde: desde, hasta: hasta, ingresos: lista(ing), egresos: lista(egr), totalIngresos: ti, totalEgresos: te,
    resultado: ti - te, saldoInicial: inicial, saldoFinal: final, movimientos: movs };
}

function validarRango_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(d.hasta || '')) throw new Error('Rango de fechas inválido.');
  if (d.desde > d.hasta) throw new Error('La fecha inicial es posterior a la final.');
}

function accionResumenPeriodo_(d, usuario) {
  validarRango_(d);
  const r = resumenPeriodo_(d.desde, d.hasta);
  r.movimientos = puede_(usuario, 'movimientos.ver') ? r.movimientos.map(limpiar_) : [];
  return r;
}

function accionPdfPeriodo_(d, usuario) {
  validarRango_(d);
  const r = resumenPeriodo_(d.desde, d.hasta);
  const pdf = guardarPdf_(htmlReportePeriodo_(r, usuario), 'Reportes de periodo', 'Reporte ' + d.desde + ' a ' + d.hasta);
  registrarReporte_(d.hasta, 'Reporte de periodo', pdf, usuario);
  return pdf;
}

function accionPdfDiario_(d, usuario) {
  const fecha = d.fecha || hoy_();
  return generarReporteDiario_(fecha, usuario);
}

function generarReporteDiario_(fecha, usuario) {
  const r = datosDia_(fecha);
  const cierre = cierresActivos_().filter(function (c) { return c.fecha === fecha; })[0] || null;
  const pdf = guardarPdf_(htmlReporteDiario_(r, cierre, usuario), 'Reportes diarios/' + fecha.slice(0, 7), 'Reporte diario ' + fecha);
  registrarReporte_(fecha, 'Reporte diario', pdf, usuario);
  return pdf;
}

/** Disparador diario (11 p. m.): guarda en Drive el PDF del día. */
function reporteDiarioAutomatico() {
  const fecha = hoy_();
  const ya = leerTabla_(HOJAS.REPORTES).some(function (r) { return r.fecha === fecha && r.tipo === 'Reporte diario' && r.generado_por === 'sistema'; });
  if (ya) return;
  generarReporteDiario_(fecha, null);
  auditar_(null, 'GENERAR', 'Reporte diario', fecha, 'Automático');
}

function accionPdfMovimiento_(d, usuario) {
  const m = leerTabla_(HOJAS.MOVIMIENTOS).filter(function (x) { return x.id === d.id; })[0];
  if (!m) throw new Error('Movimiento no encontrado.');
  if (m.pdf_url && m.estado === 'ACTIVO') return { url: m.pdf_url, nombre: m.numero };
  const titulo = m.tipo === 'INGRESO' ? 'Recibo de ingreso' : m.tipo === 'EGRESO' ? 'Comprobante de egreso' : 'Comprobante de traslado';
  const pdf = guardarPdf_(htmlComprobante_(m, titulo), 'Comprobantes/' + String(m.fecha).slice(0, 7), titulo + ' ' + m.numero);
  if (m.estado === 'ACTIVO') actualizarFila_(HOJAS.MOVIMIENTOS, m._fila, { pdf_url: pdf.url });
  return pdf;
}

function registrarReporte_(fecha, tipo, pdf, usuario) {
  agregarFila_(HOJAS.REPORTES, { fecha: fecha, tipo: tipo, nombre: pdf.nombre, url: pdf.url,
    generado_por: usuario ? usuario.email : 'sistema', generado_en: ahora_() });
}

function accionListarReportes_() {
  return leerTabla_(HOJAS.REPORTES).map(limpiar_).reverse().slice(0, 100);
}

function accionListarAuditoria_() {
  return leerTabla_(HOJAS.AUDITORIA).map(limpiar_).reverse().slice(0, 300);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN (ADMIN)
// ─────────────────────────────────────────────────────────────────────────────

function accionGuardarConfig_(d, usuario) {
  const editables = CONFIG_INICIAL.map(function (c) { return c[0]; });
  const tabla = leerTabla_(HOJAS.CONFIG);
  Object.keys(d).forEach(function (k) {
    if (editables.indexOf(k) === -1) return;
    let v = d[k];
    if (/^SALDO_/.test(k)) v = Math.round(Number(v)) || 0;
    const fila = tabla.filter(function (c) { return c.clave === k; })[0];
    if (fila && String(fila.valor) !== String(v)) {
      actualizarFila_(HOJAS.CONFIG, fila._fila, { valor: v });
      auditar_(usuario, 'EDITAR', 'Config', k, String(fila.valor) + ' → ' + v);
    }
  });
  limpiarCache_();
  return configPublica_();
}

function accionGuardarCategoria_(d, usuario) {
  const nombre = String(d.nombre || '').trim();
  if (!nombre) throw new Error('Escriba el nombre de la categoría.');
  if (['INGRESO', 'EGRESO'].indexOf(d.tipo) === -1) throw new Error('Tipo inválido.');
  return conBloqueo_(function () {
    const tabla = leerTabla_(HOJAS.CATEGORIAS);
    const repetida = tabla.some(function (c) { return c.nombre.toLowerCase() === nombre.toLowerCase() && c.tipo === d.tipo && c.id !== d.id; });
    if (repetida) throw new Error('Ya existe una categoría con ese nombre.');
    if (d.id) {
      const c = tabla.filter(function (x) { return x.id === d.id; })[0];
      if (!c) throw new Error('Categoría no encontrada.');
      actualizarFila_(HOJAS.CATEGORIAS, c._fila, { nombre: nombre, activa: d.activa === 'NO' ? 'NO' : 'SI' });
      // Renombrar: el historial y el presupuesto siguen a la categoría
      if (c.nombre !== nombre) {
        [HOJAS.MOVIMIENTOS, HOJAS.PRESUPUESTO].forEach(function (h) {
          leerTabla_(h).forEach(function (r) {
            if (r.categoria === c.nombre && r.tipo === c.tipo) {
              actualizarFila_(h, r._fila, { categoria: nombre });
            }
          });
        });
      }
    } else {
      agregarFila_(HOJAS.CATEGORIAS, { id: siguienteNumero_('CAT'), tipo: d.tipo, nombre: nombre, activa: 'SI' });
    }
    auditar_(usuario, d.id ? 'EDITAR' : 'CREAR', 'Categoria', d.id || nombre, d);
    return leerTabla_(HOJAS.CATEGORIAS).map(limpiar_);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF (formatos con membrete institucional)
// ─────────────────────────────────────────────────────────────────────────────

function carpetaRaiz_() {
  const id = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!id) throw new Error('Falta la carpeta de reportes. Ejecute setup().');
  return DriveApp.getFolderById(id);
}

function subcarpeta_(ruta) {
  let f = carpetaRaiz_();
  ruta.split('/').forEach(function (n) {
    const it = f.getFoldersByName(n);
    f = it.hasNext() ? it.next() : f.createFolder(n);
  });
  return f;
}

function guardarPdf_(html, ruta, nombre) {
  const blob = HtmlService.createHtmlOutput(html).getBlob().getAs(MimeType.PDF).setName(nombre + '.pdf');
  const archivo = subcarpeta_(ruta).createFile(blob);
  return { url: archivo.getUrl(), id: archivo.getId(), nombre: archivo.getName(), contenido: Utilities.base64Encode(blob.getBytes()) };
}

/** Devuelve un PDF del sistema (solo de la carpeta de reportes) para descargarlo desde el navegador. */
function accionDescargarPdf_(d) {
  const m = String(d.url || '').match(/[-\w]{25,}/);
  if (!m) throw new Error('Enlace de PDF inválido.');
  const archivo = DriveApp.getFileById(m[0]);
  const raiz = carpetaRaiz_().getId();
  let dentro = false;
  let nivel = [archivo.getParents()];
  for (let i = 0; i < 5 && !dentro && nivel.length; i++) {
    const sig = [];
    nivel.forEach(function (it) {
      while (it.hasNext()) {
        const f = it.next();
        if (f.getId() === raiz) dentro = true;
        sig.push(f.getParents());
      }
    });
    nivel = sig;
  }
  if (!dentro) throw new Error('Ese archivo no pertenece al sistema.');
  return { nombre: archivo.getName(), contenido: Utilities.base64Encode(archivo.getBlob().getBytes()) };
}

function urlApp_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function logoUrl_() {
  const u = String(cfg_('LOGO_URL') || '').trim();
  return /^https:\/\//i.test(u) ? u : LOGO_OFICIAL_URL;
}

function logoDriveId_() {
  const id = String(cfg_('LOGO_FILE_ID') || '').trim();
  return id && LOGOS_ANTIGUOS.indexOf(id) === -1 ? id : '';
}

/** Logo para el portal: el navegador lo carga directo de la web (si falla, usa el incluido). */
function logoWeb_() {
  return logoDriveId_() ? logoDataUrl_() : logoUrl_();
}

/** Logo como data URL para los PDF (cacheado en trozos de 90 KB). */
function logoDataUrl_() {
  const id = logoDriveId_() || ('URL:' + logoUrl_());
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('LOGO2_N_' + id));
  if (n) {
    const partes = cache.getAll(Array.from({ length: n }, function (_, i) { return 'LOGO2_' + i; }));
    if (Object.keys(partes).length === n) return Array.from({ length: n }, function (_, i) { return partes['LOGO2_' + i]; }).join('');
  }
  try {
    let blob = id.indexOf('URL:') === 0
      ? UrlFetchApp.fetch(id.slice(4), { muteHttpExceptions: false, followRedirects: true }).getBlob()
      : DriveApp.getFileById(id).getBlob();
    // El conversor de PDF solo dibuja PNG, JPG o GIF; si el archivo es otro formato se intenta convertir.
    if (!/png|jpe?g|gif/i.test(blob.getContentType())) blob = blob.getAs('image/png');
    if (!/png|jpe?g|gif/i.test(blob.getContentType())) return LOGO_VILLA_OLIMPICA;
    const url = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    const trozos = {};
    let i = 0;
    for (let p = 0; p < url.length; p += 90000) trozos['LOGO2_' + (i++)] = url.slice(p, p + 90000);
    if (i <= 9) { trozos['LOGO2_N_' + id] = String(i); cache.putAll(trozos, 21600); }
    return url;
  } catch (e) {
    console.warn('No se pudo leer el logo (' + id + '), se usa el incluido: ' + e.message);
    return LOGO_VILLA_OLIMPICA;
  }
}

// Logo de IPUC Villa Olímpica (PNG tomado del formato en Excel), incluido aquí para no depender de otros archivos.
const LOGO_VILLA_OLIMPICA = 'data:image/png;base64,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';

function limpiarCache_() {
  const cache = CacheService.getScriptCache();
  cache.remove('LOGO_N');
  const id = String(cfg_('LOGO_FILE_ID') || '').trim();
  if (id) cache.remove('LOGO2_N_' + id);
  cache.remove('LOGO2_N_URL:' + logoUrl_());
}

function esc_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Estructura común: membrete según el manual (logo arriba a la izquierda, datos a la derecha). */
function plantillaPdf_(titulo, subtitulo, cuerpo, usuario) {
  const c = configPublica_();
  const logo = logoDataUrl_();
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    '@page{size:letter;margin:1.5cm 1.5cm 1.5cm 1cm}' +
    'body{font-family:"Myriad Pro",Calibri,Arial,sans-serif;color:#1d2433;font-size:10.5pt;margin:0}' +
    '.memb{display:table;width:100%;border-bottom:2px solid ' + COLORES.AZUL_CLARO + ';padding-bottom:8px}' +
    '.memb>div{display:table-cell;vertical-align:middle}' +
    '.logo img{width:3.5cm;height:auto}' +
    '.datos{text-align:right;font-size:8.5pt;color:' + COLORES.AZUL_OSCURO + ';line-height:1.35}' +
    '.datos b{font-size:10pt;letter-spacing:.2px}' +
    '.datos .web{color:' + COLORES.AZUL_CLARO + '}' +
    'h1{font-size:15pt;color:' + COLORES.AZUL_OSCURO + ';margin:16px 0 2px;text-transform:uppercase;letter-spacing:.5px}' +
    '.sub{color:#5b6475;margin-bottom:12px}' +
    '.barra{height:4px;width:60px;background:' + COLORES.AMARILLO + ';margin:4px 0 10px}' +
    'table{width:100%;border-collapse:collapse;margin:8px 0 14px}' +
    'th{background:' + COLORES.AZUL_OSCURO + ';color:#fff;text-align:left;font-size:8.5pt;padding:5px 6px}' +
    'td{border-bottom:1px solid #dfe5ef;padding:4px 6px;font-size:9pt}' +
    'tr:nth-child(even) td{background:#f4f8fc}' +
    '.n{text-align:right;white-space:nowrap}' +
    '.tot td{font-weight:bold;background:#e8f6fc !important;border-top:2px solid ' + COLORES.AZUL_CLARO + '}' +
    '.cajas{display:table;width:100%;border-spacing:6px 0;margin:6px -6px 12px}' +
    '.caja{display:table-cell;border:1px solid #dfe5ef;border-top:3px solid ' + COLORES.AZUL_CLARO + ';padding:8px;border-radius:3px}' +
    '.caja small{display:block;color:#5b6475;font-size:8pt;text-transform:uppercase}' +
    '.caja b{font-size:12.5pt;color:' + COLORES.AZUL_OSCURO + '}' +
    '.firmas{display:table;width:100%;margin-top:50px}' +
    '.firmas>div{display:table-cell;text-align:center;padding:0 14px;font-size:9pt}' +
    '.firmas hr{border:0;border-top:1px solid #1d2433;margin:0 0 4px}' +
    '.pie{margin-top:24px;border-top:1px solid #dfe5ef;padding-top:6px;font-size:7.5pt;color:#8a93a3;text-align:center}' +
    '.sello{display:inline-block;border:2px solid #c0392b;color:#c0392b;padding:2px 10px;font-weight:bold;transform:rotate(-4deg)}' +
    '.letras{background:#f4f8fc;border-left:4px solid ' + COLORES.AMARILLO + ';padding:6px 10px;font-size:9pt;margin:8px 0}' +
    '.kv td{border:none;padding:3px 6px}.kv td:first-child{color:#5b6475;width:32%}' +
    '</style></head><body>' +
    '<div class="memb"><div class="logo">' + (logo ? '<img src="' + logo + '">' : '<b style="color:' + COLORES.AZUL_OSCURO + '">IPUC</b>') + '</div>' +
    '<div class="datos"><b>' + APP.IGLESIA + '</b><br><b>' + esc_(String(c.NOMBRE_CONGREGACION || '').toUpperCase()) + '</b><br>' + esc_(c.DIRECCION) +
    (c.TELEFONO ? ' · Tel. ' + esc_(c.TELEFONO) : '') + (c.CIUDAD ? '<br>' + esc_(c.CIUDAD) + ' - Colombia' : '') +
    (c.NIT ? '<br>NIT ' + esc_(c.NIT) : '') + (c.EMAIL ? '<br>E-mail: ' + esc_(c.EMAIL) : '') +
    '<br><span class="web">' + APP.WEB_NACIONAL + '</span></div></div>' +
    '<h1>' + esc_(titulo) + '</h1><div class="barra"></div><div class="sub">' + subtitulo + '</div>' +
    cuerpo +
    '<div class="pie">Generado el ' + ahora_() + (usuario ? ' por ' + esc_(usuario.email) : ' automáticamente') +
    ' · ' + APP.NOMBRE + ' · ' + APP.IGLESIA + '</div></body></html>';
}

function tablaMovimientos_(movs) {
  if (!movs.length) return '<p style="color:#5b6475">Sin movimientos registrados.</p>';
  let ti = 0, te = 0;
  const filas = movs.map(function (m) {
    const v = Number(m.valor) || 0;
    const ing = m.tipo === 'INGRESO';
    if (m.tipo === 'INGRESO') ti += v; else if (m.tipo === 'EGRESO') te += v;
    return '<tr><td>' + esc_(m.numero) + '</td><td>' + esc_(m.fecha) + '</td><td>' + esc_(m.categoria) + '</td><td>' +
      esc_(m.tercero || '') + '</td><td>' + esc_(m.concepto) + '</td><td>' + esc_(m.medio_pago) + '</td>' +
      '<td class="n">' + (ing ? pesos_(v) : '') + '</td><td class="n">' + (m.tipo === 'EGRESO' ? pesos_(v) : m.tipo === 'TRASLADO' ? '(' + pesos_(v) + ')' : '') + '</td></tr>';
  }).join('');
  return '<table><tr><th>N.º</th><th>Fecha</th><th>Categoría</th><th>Beneficiario</th><th>Concepto</th><th>Medio</th><th class="n">Ingreso</th><th class="n">Egreso</th></tr>' +
    filas + '<tr class="tot"><td colspan="6">Totales</td><td class="n">' + pesos_(ti) + '</td><td class="n">' + pesos_(te) + '</td></tr></table>';
}

function firmas_(lista) {
  const c = configPublica_();
  const f = lista || [[c.TESORERO || '', 'Tesorero(a)'], [c.PASTOR || '', 'Pastor']];
  return '<div class="firmas">' + f.map(function (x) {
    return '<div><hr>' + (esc_(x[0]) || '&nbsp;') + '<br><small>' + esc_(x[1]) + '</small></div>';
  }).join('') + '</div>';
}

function subtitulo_(t) {
  return '<b style="color:' + COLORES.AZUL_OSCURO + '">' + t + '</b>';
}

function htmlReporteDiario_(r, cierre, usuario) {
  const c = configPublica_();
  const titulo = cierre ? 'Cierre diario de caja' : 'Reporte diario de movimientos';
  const sub = fechaLarga_(r.fecha) + (cierre ? ' · Cierre ' + esc_(cierre.id) : ' · <i>Caja sin cerrar (preliminar)</i>');
  let cuerpo = '<div class="cajas">' +
    '<div class="caja"><small>Ingresos del día</small><b>' + pesos_(r.totalIngresos) + '</b></div>' +
    '<div class="caja"><small>Gastos del día</small><b>' + pesos_(r.totalEgresos) + '</b></div>' +
    '<div class="caja"><small>Saldo en caja</small><b>' + pesos_(r.saldoEsperadoCaja) + '</b></div>' +
    '<div class="caja"><small>Saldo en Nequi</small><b>' + pesos_(r.saldoNequi) + '</b></div></div>';

  cuerpo += '<table class="kv"><tr><td>Saldo inicial de caja</td><td class="n">' + pesos_(r.saldoInicialCaja) + '</td>' +
    '<td>Saldo inicial Nequi</td><td class="n">' + pesos_(r.saldoInicialNequi) + '</td></tr>' +
    '<tr><td>(+) Entradas a caja</td><td class="n">' + pesos_(r.ingresosCaja) + '</td><td>(+) Entradas a Nequi</td><td class="n">' + pesos_(r.ingresosNequi) + '</td></tr>' +
    '<tr><td>(−) Salidas de caja</td><td class="n">' + pesos_(r.egresosCaja) + '</td><td>(−) Salidas de Nequi</td><td class="n">' + pesos_(r.egresosNequi) + '</td></tr></table>';

  const cats = Object.keys(r.porCategoria);
  if (cats.length) {
    cuerpo += subtitulo_('Resumen por categoría') + '<table><tr><th>Categoría</th><th class="n">Valor</th></tr>' +
      cats.map(function (k) { return '<tr><td>' + esc_(k) + '</td><td class="n">' + pesos_(r.porCategoria[k]) + '</td></tr>'; }).join('') + '</table>';
  }
  cuerpo += subtitulo_('Detalle de movimientos') + tablaMovimientos_(r.movimientos);

  if (cierre) {
    let den = {};
    try { den = typeof cierre.denominaciones === 'string' ? JSON.parse(cierre.denominaciones || '{}') : cierre.denominaciones || {}; } catch (e) { den = {}; }
    const filasDen = DENOMINACIONES.filter(function (v) { return Number(den[v]) > 0; }).map(function (v) {
      return '<tr><td>' + (v >= 2000 ? 'Billete ' : 'Moneda ') + pesos_(v) + '</td><td class="n">' + den[v] + '</td><td class="n">' + pesos_(v * den[v]) + '</td></tr>';
    }).join('');
    cuerpo += subtitulo_('Arqueo de caja') +
      (filasDen ? '<table><tr><th>Denominación</th><th class="n">Cantidad</th><th class="n">Total</th></tr>' + filasDen + '</table>' : '') +
      '<table class="kv"><tr><td>Saldo esperado en caja</td><td class="n">' + pesos_(cierre.saldo_esperado_caja) + '</td></tr>' +
      '<tr><td>Efectivo contado</td><td class="n">' + pesos_(cierre.efectivo_contado) + '</td></tr>' +
      '<tr><td><b>Diferencia</b></td><td class="n"><b>' + pesos_(cierre.diferencia) + '</b></td></tr>' +
      (cierre.observaciones ? '<tr><td>Observaciones</td><td>' + esc_(cierre.observaciones) + '</td></tr>' : '') + '</table>' +
      '<p style="font-size:8.5pt;color:#5b6475">Conteo realizado por ' + esc_(c.TESORERO || cierre.cerrado_por) +
      ' y verificado por ' + esc_(cierre.verificado_por) + '.</p>';
    return plantillaPdf_(titulo, sub, cuerpo + firmas_([[c.TESORERO, 'Tesorero(a) · Contó'], [cierre.verificado_por, 'Verificó el conteo'], [c.PASTOR, 'Pastor · Vo. Bo.']]), usuario);
  }
  return plantillaPdf_(titulo, sub, cuerpo + firmas_(), usuario);
}

function htmlReportePeriodo_(r, usuario) {
  const lista = function (arr, total) {
    return '<table><tr><th>Categoría</th><th class="n">Valor</th><th class="n">%</th></tr>' +
      arr.map(function (x) { return '<tr><td>' + esc_(x.categoria) + '</td><td class="n">' + pesos_(x.valor) + '</td><td class="n">' + (total ? (x.valor * 100 / total).toFixed(1) : '0') + '%</td></tr>'; }).join('') +
      '<tr class="tot"><td>Total</td><td class="n">' + pesos_(total) + '</td><td class="n">100%</td></tr></table>';
  };
  const pp = resumenPresupuesto_(r.hasta.slice(0, 4));
  const conPpto = pp.filas.filter(function (f) { return f.presupuesto > 0; });
  const tablaPpto = conPpto.length ? subtitulo_('Ejecución del presupuesto ' + pp.anio + ' (acumulado del año)') +
    '<table><tr><th>Tipo</th><th>Categoría</th><th class="n">Presupuesto anual</th><th class="n">Ejecutado</th><th class="n">%</th></tr>' +
    conPpto.map(function (f) {
      return '<tr><td>' + (f.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto') + '</td><td>' + esc_(f.categoria) + '</td><td class="n">' + pesos_(f.presupuesto) +
        '</td><td class="n">' + pesos_(f.ejecutado) + '</td><td class="n">' + Math.round(f.ejecutado * 100 / f.presupuesto) + '%</td></tr>';
    }).join('') + '</table>' : '';
  const cuerpo = '<div class="cajas">' +
    '<div class="caja"><small>Total ingresos</small><b>' + pesos_(r.totalIngresos) + '</b></div>' +
    '<div class="caja"><small>Total gastos</small><b>' + pesos_(r.totalEgresos) + '</b></div>' +
    '<div class="caja"><small>Resultado</small><b>' + pesos_(r.resultado) + '</b></div></div>' +
    '<table class="kv"><tr><td></td><td class="n"><b>Caja</b></td><td class="n"><b>Nequi</b></td><td class="n"><b>Total</b></td></tr>' +
    '<tr><td>Saldo inicial</td><td class="n">' + pesos_(r.saldoInicial.CAJA) + '</td><td class="n">' + pesos_(r.saldoInicial.NEQUI) + '</td><td class="n">' + pesos_(r.saldoInicial.CAJA + r.saldoInicial.NEQUI) + '</td></tr>' +
    '<tr><td>Saldo final</td><td class="n">' + pesos_(r.saldoFinal.CAJA) + '</td><td class="n">' + pesos_(r.saldoFinal.NEQUI) + '</td><td class="n">' + pesos_(r.saldoFinal.CAJA + r.saldoFinal.NEQUI) + '</td></tr></table>' +
    subtitulo_('Ingresos por categoría') + lista(r.ingresos, r.totalIngresos) +
    subtitulo_('Gastos por categoría') + lista(r.egresos, r.totalEgresos) +
    tablaPpto +
    subtitulo_('Detalle de movimientos') + tablaMovimientos_(r.movimientos) + firmas_();
  return plantillaPdf_('Informe financiero del periodo', 'Del ' + fechaLarga_(r.desde) + ' al ' + fechaLarga_(r.hasta), cuerpo, usuario);
}

function htmlConciliacion_(conc, marcados, pendientes, usuario) {
  const c = configPublica_();
  const filas = function (arr) {
    if (!arr.length) return '<p style="color:#5b6475">Ninguno.</p>';
    return '<table><tr><th>N.º</th><th>Fecha</th><th>Categoría</th><th>Referencia</th><th class="n">Valor</th></tr>' +
      arr.map(function (m) {
        return '<tr><td>' + esc_(m.numero) + '</td><td>' + esc_(m.fecha) + '</td><td>' + esc_(m.categoria) + '</td><td>' + esc_(m.referencia) +
          '</td><td class="n">' + pesos_(m.efecto) + '</td></tr>';
      }).join('') + '</table>';
  };
  const cuerpo = '<div class="cajas">' +
    '<div class="caja"><small>Saldo según el sistema</small><b>' + pesos_(conc.saldo_sistema) + '</b></div>' +
    '<div class="caja"><small>Saldo en la app Nequi</small><b>' + pesos_(conc.saldo_nequi) + '</b></div>' +
    '<div class="caja"><small>Diferencia</small><b>' + pesos_(conc.diferencia) + '</b></div></div>' +
    (c.NEQUI_NUMERO ? '<p>Cuenta Nequi N.º ' + esc_(c.NEQUI_NUMERO) + '</p>' : '') +
    (conc.observaciones ? '<div class="letras"><b>Observaciones:</b> ' + esc_(conc.observaciones) + '</div>' : '') +
    subtitulo_('Movimientos verificados en el historial de Nequi') + filas(marcados) +
    subtitulo_('Movimientos aún sin verificar') + filas(pendientes) +
    firmas_([[c.TESORERO, 'Tesorero(a)'], [c.PASTOR, 'Pastor']]);
  return plantillaPdf_('Conciliación de la cuenta Nequi', 'Corte al ' + fechaLarga_(conc.fecha) + ' · ' + esc_(conc.id), cuerpo, usuario);
}

function htmlComprobante_(m, titulo) {
  const c = configPublica_();
  const anulado = m.estado !== 'ACTIVO' ? '<p><span class="sello">ANULADO</span> ' + esc_(m.motivo_anulacion) + '</p>' : '';
  const filas = [['Fecha', fechaLarga_(m.fecha)]];
  if (m.tipo === 'EGRESO') filas.push(['Pagado a', m.tercero], ['Documento / NIT', m.tercero_doc || '—']);
  if (m.tipo === 'TRASLADO') filas.push(['Movimiento', NOMBRE_CUENTA[m.cuenta] + ' → ' + NOMBRE_CUENTA[m.cuenta_destino]]);
  filas.push(['Categoría', m.categoria], ['Concepto', m.concepto],
    ['Medio de pago', m.medio_pago + (m.referencia ? ' · Ref. ' + m.referencia : '')],
    ['Cuenta', NOMBRE_CUENTA[m.cuenta] || m.cuenta]);
  const cuerpo = anulado + '<div class="cajas"><div class="caja"><small>Valor</small><b style="font-size:16pt">' + pesos_(m.valor) + '</b></div></div>' +
    '<div class="letras"><b>Son:</b> ' + numeroALetras_(Number(m.valor)) + '</div>' +
    '<table class="kv">' + filas.map(function (f) { return '<tr><td>' + f[0] + '</td><td>' + esc_(f[1]) + '</td></tr>'; }).join('') + '</table>' +
    (m.tipo === 'EGRESO'
      ? firmas_([[c.TESORERO, 'Elaboró · Tesorero(a)'], [c.PASTOR, 'Aprobó · Pastor'], ['', 'Recibí conforme · C.C.']])
      : m.tipo === 'INGRESO'
        ? firmas_([[c.TESORERO, 'Recibió · Tesorero(a)'], [c.VERIFICADOR, 'Verificó']]) +
          '<p style="margin-top:22px;font-size:8.5pt;color:#5b6475;text-align:center">“Cada uno dé como propuso en su corazón: no con tristeza, ni por necesidad, porque Dios ama al dador alegre.” 2 Corintios 9:7</p>'
        : firmas_([[c.TESORERO, 'Tesorero(a)'], [c.VERIFICADOR, 'Verificó']]));
  return plantillaPdf_(titulo, 'N.º <b>' + esc_(m.numero) + '</b>', cuerpo, { email: m.registrado_por });
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

function hoy_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }
function ahora_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function pad_(n, l) { return ('000000000' + n).slice(-l); }

function pesos_(v) {
  const n = Math.round(Number(v) || 0);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-$ ' : '$ ') + s;
}

function fechaLarga_(f) {
  const m = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const p = String(f).split('-');
  return Number(p[2]) + ' de ' + m[Number(p[1]) - 1] + ' de ' + p[0];
}

/** 1250000 → "UN MILLÓN DOSCIENTOS CINCUENTA MIL PESOS M/CTE" */
function numeroALetras_(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'CERO PESOS M/CTE';
  const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE',
    'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS',
    'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const apocope = function (s) { return s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN'); };
  const cientos = function (x) {
    if (x === 0) return '';
    if (x === 100) return 'CIEN';
    const c = Math.floor(x / 100), r = x % 100;
    const dec = r === 0 ? '' : r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : '');
    return [C[c], dec].filter(Boolean).join(' ');
  };
  const hastaMillon = function (x) {
    const mil = Math.floor(x / 1000), r = x % 1000;
    const a = mil === 0 ? '' : mil === 1 ? 'MIL' : apocope(cientos(mil)) + ' MIL';
    return [a, cientos(r)].filter(Boolean).join(' ');
  };
  const millones = Math.floor(n / 1e6), resto = n % 1e6;
  const pm = millones === 0 ? '' : millones === 1 ? 'UN MILLÓN' : apocope(hastaMillon(millones)) + ' MILLONES';
  let texto = [pm, apocope(hastaMillon(resto))].filter(Boolean).join(' ');
  if (millones && !resto) texto += ' DE';
  return texto + (n === 1 ? ' PESO M/CTE' : ' PESOS M/CTE');
}
