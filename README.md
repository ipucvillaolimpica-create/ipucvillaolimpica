# Sistema Administrativo y Contable · IPUC Villa Olímpica

Aplicación web para la congregación Villa Olímpica de la Iglesia Pentecostal Unida de Colombia. Funciona con Google Apps Script y Google Sheets, y guarda los PDF en Google Drive. La interfaz usa HTML, CSS y JavaScript puro, sin librerías.

## Archivos del proyecto

| Archivo | Contenido |
|---|---|
| `Code.gs` | Servidor: instalación, hojas de datos, roles y permisos, reglas contables, cierre de caja, PDF, disparador diario y el logo de Villa Olímpica |
| `Index.html` | Estructura del panel (menú lateral, barra superior, modal) |
| `Styles.html` | Estilos con la identidad institucional |
| `Scripts.html` | Lógica del panel: vistas, formularios, gráficos SVG y llamadas al servidor |
| `appsscript.json` | Manifiesto: zona horaria de Bogotá, V8, permisos y configuración de la aplicación web |

## Identidad aplicada (Manual de Identidad Corporativa IPUC)

- **Azul oscuro** `#00338D` (Pantone 287C): menú, títulos y encabezados de tabla.
- **Azul claro / cyan** `#009FDA` (Pantone Process Cyan C): ingresos, líneas del membrete y acentos.
- **Amarillo oro** `#F0AB00` (Pantone 130C): botones principales, gastos y elemento activo.
- **Degradado radial** de azul oscuro a cyan en la tarjeta principal y el menú (pág. 14 del manual).
- **Tipografía**: Myriad Pro. Como no se puede cargar en la web, se usa Source Sans 3 (su equivalente libre de Adobe) y, como alternativa, Calibri, que es la fuente sustituta que indica el manual.
- **Membrete de los PDF** según la hoja carta (pág. 36): logo arriba a la izquierda de 3,5 cm; a la derecha IGLESIA PENTECOSTAL UNIDA DE COLOMBIA, VILLA OLÍMPICA, Carrera 62 - Calle 8ª, E-mail: Ipucvillaolimpica@gmail.com y www.ipuc.org.co. Teléfono, ciudad y NIT aparecen solo si se llenan en Configuración. Márgenes de 1,5 / 1 / 1,5 / 1,5 cm.

## Módulos

1. **Panel**: diseño basado en el sitio oficial ipuc.org.co (barra azul con el logo, línea dorada y lema "Un Señor, una fe, un bautismo"); saldo disponible (caja + Nequi), ingresos, diezmos y gastos del mes, gráfico de 6 meses, gastos por categoría, avance del presupuesto anual y aviso de días sin cierre.
2. **Diezmos e ingresos**: se registra el **valor total** recogido (sin nombres de quienes aportaron), con consecutivo `RI-000001`, recibido en efectivo o por Nequi.
3. **Gastos**: registro con consecutivo `CE-000001`. Pide beneficiario y concepto, y no permite gastar más de lo que hay en caja o en Nequi. El comprobante en PDF lleva las firmas de elaboró, aprobó y recibí.
4. **Caja diaria**: arqueo por billetes y monedas con **doble control**. Al cerrar se pide el nombre de la segunda persona que verificó el conteo, y el PDF lleva tres firmas: tesorero, verificador y pastor. El cierre bloquea los movimientos del día.
5. **Nequi**: depósitos de caja a Nequi y retiros de Nequi a caja (`TR-`). En la **conciliación**, el tesorero escribe el saldo que muestra la app, marca los movimientos que aparecen en el historial de Nequi y guarda; se genera un PDF con lo verificado y lo pendiente.
6. **Presupuesto**: valor anual por categoría de ingreso y de gasto, comparado con lo ejecutado y con lo esperado a la fecha. Los gastos que van más de 10 puntos por encima de lo esperado se marcan en dorado.
7. **Miembros**: directorio con nombre y género (obligatorios), y fecha de nacimiento, teléfono, correo y dirección (opcionales). Muestra la edad, y el panel muestra los cumpleaños del mes. Los nombres viven en la hoja **Miembros**: se pueden escribir allí directamente (el sistema completa el código, el estado y entiende M/F y fechas como 13/05/2001) o con el botón **Importar desde Excel**, pegando las columnas Nombre, Sexo, Fecha de nacimiento y Teléfono. No se repiten nombres. Se filtra por Hermanos / Hermanas y se descarga en PDF el listado por género (todos, solo hermanos o solo hermanas; activos o incluyendo inactivos). El PDF queda en Drive en `Reportes de miembros`.
8. **Eventos**: agenda general con calendario mensual. Todos los roles, incluido CONSULTA, ven y agendan eventos. Dos eventos activos no pueden cruzarse en horario el mismo día (el sistema lo avisa al llenar y lo bloquea en el servidor). Quien agenda un evento lo puede editar o cancelar; ADMIN, PASTOR y SECRETARIO pueden editar o cancelar cualquiera. Nada se borra: se cancela con un motivo.
   - **Enlace para comités** (`URL de la aplicación?p=agenda`): el representante escribe su nombre y elige su comité, sin usuario ni contraseña. Puede registrar eventos (con la misma regla de no cruzarse) y ver los que ha registrado y los próximos de la iglesia. Los comités y sus representantes se escriben en la hoja **Comites** (una fila por persona). Si un comité tiene representantes escritos, solo esos nombres pueden entrar por ese comité; si no tiene ninguno, se acepta cualquier nombre.
9. **Reportes**: resumen por periodo, informe en PDF (incluye la ejecución del presupuesto) y archivo de todos los PDF.
10. **Usuarios y roles**, **Configuración** (membrete, Nequi, saldos iniciales, logo, categorías, cultos y sectores, enlace para comités) y **Auditoría**.

Los **cultos y sectores** del informe semanal se editan con los botones *Sectores* y *Cultos* del Informe semanal (ADMIN, PASTOR, TESORERO) o en Configuración. Al renombrar, la categoría de ingreso y las semanas abiertas toman el nombre nuevo.

## Excel: exportar e importar

Cada sección tiene un botón **Excel** arriba a la derecha. La librería SheetJS se carga desde cdnjs.cloudflare.com solo cuando se usa ese botón, así que se necesita internet.

| Sección | Exportar | Importar |
|---|---|---|
| Informe semanal | Hoja "Informe" (con columna Clave) y hoja "Resumen" con los cálculos | Se llena la columna Valor (y Fecha, ¿Se realizó? y Promedio en cultos) del mismo archivo. Solo se guardan los campos que cambiaron. Si el archivo es de otra semana, se guarda en esa semana. No se puede importar en una semana cerrada. |
| Eventos | Todos los eventos activos | Nombre del evento, Fecha, Hora de inicio, Hora de terminación (Lugar, Responsable, Descripción opcionales). Cada fila se revisa como un evento nuevo: sin cruces y sin fechas pasadas. Los que ya están en la agenda no se repiten. |
| Miembros | Todos los miembros | Nombre y Sexo (M/F); Fecha de nacimiento, Teléfono, Correo, Dirección y Estado opcionales. Los nombres que ya existan no se repiten. Sigue disponible "Pegar filas". |
| Diezmos e ingresos / Gastos | Lo que muestra el filtro | Fecha, Categoría, Valor, Recibido en / Pagado con; en gastos también Concepto y Pagado a. Cada fila pasa por las validaciones normales (categoría existente, caja abierta, saldo). Las filas con número RI-/CE- ya registrado no se duplican. |
| Presupuesto | Tipo, Categoría, Presupuesto anual, Ejecutado, Avance | Tipo (Ingreso o Gasto), Categoría, Presupuesto anual. |
| Reportes, Caja diaria, Nequi, Auditoría | Las tablas o el resumen que se ven en pantalla | No aplica |

Los encabezados se reconocen sin importar mayúsculas ni tildes, y las fechas pueden venir como fecha de Excel, dd/mm/aaaa o aaaa-mm-dd. Al terminar, la ventana muestra qué filas no se importaron y por qué.

## Informe semanal (formato F JL 02)

Es el formato "Relación de ingresos cultos semanales" del Excel, dentro del sistema:

- **Quién llena**: todos los usuarios autorizados, sin importar el rol. Cada uno diligencia los campos que le corresponden y guarda. El sistema guarda solo los campos que esa persona cambió, así que no borra lo que otros ingresaron.
- **Quién cierra**: el tesorero o el administrador, desde el domingo de esa semana (semana de lunes a domingo). No se dibuja firma: el sistema registra automáticamente el nombre y el rol de quien cierra, con fecha, hora y usuario, y así aparece en el PDF. Al cerrar, la semana queda bloqueada y se guarda el PDF en Drive (`Informes semanales/año`).
- **Cultos**: la ofrenda va en la primera columna. La asistencia promedio queda oculta y se muestra con el botón **Promedio**; el sistema recuerda la preferencia en cada equipo.
- **Escoger la semana**: con las flechas ‹ › o con el calendario del encabezado. Al escoger cualquier día se abre la semana (lunes a domingo) que lo contiene, sea pasada o futura.
- **Validación al cerrar**: los aportes (21 % + 5 % + 2 %) cuentan como ingreso de la semana. Los egresos no pueden superar aportes + ofrendas de cultos + cultos en sectores.
- **Descargar**: el botón "Descargar PDF" funciona en cualquier momento. Mientras la semana está abierta sale marcado como BORRADOR.
- **Contabilidad**: al cerrar se registran en el libro, con fecha del domingo, los **aportes** de diezmos (21 % + 5 % + 2 %, categoría "Aportes de diezmos"), las ofrendas de cada culto y sector, y los egresos (`CONTABILIZAR_SEMANA = SI`). El **neto de diezmos se liquida al pastor** y no cuenta como ingreso ni en el saldo disponible. Si el administrador reabre la semana, esos registros se anulan. La semana debe cerrarse antes que la caja del domingo. Las semanas cerradas con una versión anterior (que registraba el total de diezmos) se corrigen reabriéndolas y cerrándolas otra vez.
- **Liquidación de diezmos**: el botón "Liquidación de diezmos" descarga el comprobante para el pastor: total de diezmos (incluido lo recibido por Nequi), menos los descuentos, igual al neto; menos lo recibido por Nequi (que se le transfiere), igual al valor a entregar en efectivo. Lleva la firma de quien cerró la semana y la del pastor "Recibí a conformidad". Si la semana no está cerrada sale como BORRADOR. Se guarda en Drive (`Liquidaciones de diezmos/año`). Con `NEQUI_DIEZMOS_AL_PASTOR = NO`, lo de Nequi queda en la cuenta de la iglesia.

**Cálculos (iguales al Excel)**
- Diezmo del día = billetes contados × su valor + monedas + Nequi.
- Total diezmos = día + noche + sobres.
- 21 % del total; 5 % de (total − 21 %); 2 % de (total − 21 % − 5 %); neto = total − los tres aportes. Cada valor se redondea al peso.
- Total suma de aportes = 21 % + 5 % + 2 %. Neto menos Nequi = neto − valor recibido por Nequi.
- Total ofrendas = suma de ofrendas de los cultos − egresos.
- Total general ingresos = aportes + total ofrendas + cultos en los sectores, con el valor en letras.

Los porcentajes, la lista de cultos y la de sectores se cambian en Configuración. En el Excel original, la celda del total de diezmos (`D11 = SUM(D9:F10)`) no incluía la fila DÍA; el sistema sí la suma.

## Categorías iniciales

Todas se pueden **renombrar**, desactivar o agregar en Configuración → Categorías. Al renombrar, el historial y el presupuesto se actualizan con el nombre nuevo.

- **Ingresos**: Diezmos; los cultos del informe semanal (Oración, Dorcas, Caballeros, Jóvenes, Escuela Dominical, Evangelístico, Niños Escuela D., Votos, Ahorro fiducia); Sector 1 a 5; Ofrenda culto general, Gavillas, Rayos de luz, Ofrenda especial, Pro-templo, Otros ingresos.
- **Gastos**: Seguridad social pastor, Servicios públicos, Arriendo, Mantenimiento, Aportes al distrito, Misiones, Ayuda social, Papelería y aseo, Transporte, Comisiones Nequi, Gastos de cultos semanales, Otros gastos.

Al cerrar una semana, cada culto o sector se registra en la categoría de ingreso con su mismo nombre; si no existe, se crea.

## Hojas de datos (Google Sheets)

`setup()` crea estas hojas. Los encabezados quedan en azul institucional y las fechas se guardan como texto `aaaa-mm-dd`.

| Hoja | Para qué sirve |
|---|---|
| `Config` | Datos de la congregación, Nequi, saldos iniciales, logo y consecutivos (`SEQ_*`, no editar) |
| `Usuarios` | usuario (correo), nombre, rol, activo, contraseña cifrada (hash y sal), último ingreso, bloqueo por intentos |
| `Miembros` | id `MB-`, nombre, género, fecha de nacimiento, teléfono, correo, dirección, estado |
| `Eventos` | id `EV-`, nombre, fecha, hora de inicio y fin, lugar, responsable, comité, origen (sistema o enlace), estado (Programado/Cancelado) |
| `Comites` | comité, representante (una fila por persona), activo |
| `Categorias` | Categorías de ingreso y gasto |
| `Movimientos` | Libro único de ingresos, gastos y traslados, con cuenta (CAJA/NEQUI), estado, cierre y conciliación |
| `Cierres` | Arqueo diario: esperado, contado, diferencia, quién cerró, quién verificó y PDF |
| `Conciliaciones` | Cortes de Nequi: saldo del sistema, saldo de la app, diferencia y PDF |
| `Semanas` | Un registro por semana: datos del formato, totales calculados, estado, quién cerró (nombre y rol), fecha de cierre y PDF |
| `Presupuesto` | Año, tipo, categoría y valor anual |
| `Reportes` | Índice de los PDF generados en Drive |
| `Auditoria` | Bitácora de acciones |

**Reglas contables**
- Nada se borra: un error se **anula** con un motivo y se vuelve a registrar.
- Un día cerrado no admite registros ni anulaciones; solo el ADMIN lo reabre, dando el motivo. Un movimiento ya conciliado con Nequi tampoco se puede anular.
- Saldo = saldo inicial + ingresos − gastos ± traslados, por cuenta (Efectivo → CAJA, Nequi → NEQUI).
- Cerrar caja o conciliar Nequi con diferencia exige una observación.

## Roles

| Rol | Puede |
|---|---|
| **ADMIN** | Todo: usuarios, configuración, categorías, reabrir cierres |
| **PASTOR** | Ver todo; el informe semanal y los ingresos solo en lectura (no los modifica ni importa). Define el presupuesto, gestiona miembros y eventos, ve reportes y auditoría |
| **TESORERO** | Registrar ingresos y gastos, anular, cerrar caja, conciliar Nequi, presupuesto |
| **SECRETARIO** | Gestionar miembros y consultar movimientos |
| **CONSULTA** | El panel, los reportes consolidados, el informe semanal y la agenda de eventos |

Los permisos se validan en el servidor (`Code.gs`), no solo en la pantalla.

## PDF en Drive

Todo queda en la carpeta **"IPUC · Sistema Contable · Reportes PDF"**:

```
Reportes diarios/2026-10/Reporte diario 2026-10-12.pdf   ← automático a las 11 p. m.
Cierres de caja/2026/Cierre de caja 2026-10-12 CC-000001.pdf
Comprobantes/2026-10/Recibo de ingreso RI-000001.pdf
Comprobantes/2026-10/Comprobante de egreso CE-000001.pdf
Conciliaciones Nequi/2026/Conciliación Nequi 2026-10-31 CN-000001.pdf
Reportes de miembros/Listado de hermanos por género 2026-10-12.pdf
Reportes de periodo/Reporte 2026-10-01 a 2026-10-31.pdf
```

## Instalación

1. Entre a <https://script.google.com> con la cuenta de Google de la iglesia y cree un **proyecto nuevo**.
2. En ⚙️ *Configuración del proyecto*, active **"Mostrar el archivo de manifiesto appsscript.json"**.
3. Copie el contenido de cada archivo de esta carpeta: `Code.gs`, `appsscript.json` y tres archivos HTML con los nombres exactos `Index`, `Styles` y `Scripts`. Al crear cada HTML, borre el contenido de ejemplo que pone el editor antes de pegar.
4. Elija la función **`setup`** y presione **Ejecutar**. Acepte los permisos. Abra **Registro de ejecución**: ahí aparece *"INGRESO DEL ADMINISTRADOR → usuario: … · contraseña temporal: …"*. Anótela.
5. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier persona**
6. Abra la URL, ingrese con su correo y la contraseña temporal, y cree su contraseña personal.
7. En **Configuración** revise los datos de la congregación, el pastor, el tesorero, el número Nequi y los saldos iniciales; edite los sectores y defina el presupuesto.
8. En **Usuarios y roles** cree a cada persona: el sistema muestra **una sola vez** su contraseña temporal para entregársela. Si alguien la olvida, use *Restablecer clave*.
9. En la hoja **Miembros** pegue o importe el listado de hermanos, y en la hoja **Comites** escriba los representantes. Comparta con los comités el enlace que aparece en Configuración.

### Sobre el acceso

La aplicación se ejecuta con la cuenta de la iglesia y cada persona entra con **usuario y contraseña**. Nadie necesita acceso a la hoja ni a la carpeta de Drive: los PDF se descargan desde el sistema. Las contraseñas se guardan cifradas (SHA-256 con sal), la sesión dura 6 horas desde el último uso y después de 5 intentos fallidos el usuario queda bloqueado 15 minutos. Sin sesión, la aplicación solo muestra la pantalla de ingreso; el enlace `?p=agenda` solo muestra y registra eventos.

### Logo

El sistema usa el **logo oficial de la IPUC** publicado en https://ipuc.org.co/assets/logo-ipuc-CokGg3u3.webp (clave `LOGO_URL` en Configuración). En el panel, el navegador lo carga directamente de esa dirección. Para los PDF, Apps Script lo descarga y lo convierte a PNG. Si la página no responde o la conversión del formato WEBP falla, se usa el logo de Villa Olímpica incluido en `Code.gs` (`LOGO_VILLA_OLIMPICA`).

Si los PDF siguen saliendo con el logo anterior, guarde el logo oficial como PNG, súbalo a Drive y ponga su ID en `LOGO_FILE_ID`. Ese archivo tiene prioridad sobre `LOGO_URL`. La versión instalada aparece abajo en el menú lateral (por ejemplo, "Versión 2026.11.05-d").

### Actualizar una instalación existente

Reemplace el contenido de todos los archivos que cambiaron (incluido `appsscript.json` si cambió), guarde y ejecute **`setup`** otra vez. Si Google pide permisos nuevos, acéptelos (por ejemplo, "Conectarse a un servicio externo", que se usa para descargar el logo). `setup` agrega hojas y columnas nuevas sin borrar información, y si el administrador aún no tiene contraseña, la muestra en el registro de ejecución. Luego en **Implementar → Gestionar implementaciones → Editar** elija *Nueva versión*, y verifique *Ejecutar como: Yo* y *Quién tiene acceso: Cualquier persona*. La versión instalada aparece abajo en el menú lateral.

## Próximos pasos sugeridos

- Presupuesto mensual por categoría con alerta de sobregiro.
- Envío del PDF diario por correo al pastor y al tesorero.
