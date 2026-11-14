Especificación de Requerimientos Funcionales (ERF)
Licorera Online — Versión 1.1
Fecha: noviembre de 2026
Estado: Actualización funcional
Base: ERF v1.0 y decisiones operativas aprobadas.
1. Objetivo de la actualización
Precisar el comportamiento del ciclo comercial desde el checkout hasta la finalización de una orden, estableciendo las reglas de:
    • Creación de órdenes.
    • Reserva y movimiento de inventario.
    • Modalidades de recepción.
    • Gestión operativa de entregas.
    • Registro y validación de pagos.
    • Cancelaciones y entregas fallidas.
La solución contempla inicialmente la operación en Fusagasugá y zonas aledañas.
2. Actores
Actor	Responsabilidad
Visitante	Consulta el catálogo y realiza compras como invitado.
Cliente registrado	Compra y consulta su historial.
ADMIN	Administra configuración, usuarios y operaciones.
MANAGER	Gestiona operaciones comerciales y administrativas autorizadas.
OPERATOR	Gestiona órdenes, preparación, entregas, inventario y registro operativo de pagos según sus permisos.
Domiciliario	Realiza la entrega física y devuelve el dinero recibido a la tienda. No requiere acceso al sistema en el MVP.
3. Requerimientos funcionales actualizados
3.1. Checkout y creación de órdenes
FR-COM-001 — Creación de orden
El sistema debe crear una orden cuando el cliente complete satisfactoriamente el checkout desde el storefront.
La creación debe registrar:
    • Productos y variantes.
    • Cantidades.
    • Precio unitario histórico.
    • Subtotal.
    • Descuentos aplicados.
    • Costo de domicilio, cuando corresponda.
    • Total de la orden.
    • Datos de contacto.
    • Modalidad de recepción.
    • Método de pago seleccionado.
    • Fecha de creación.
El backend debe calcular y validar los precios, descuentos, disponibilidad y total. No debe confiar en los importes enviados por el navegador.
FR-COM-002 — Compra como invitado o registrado
El sistema debe permitir que un cliente complete el checkout sin crear una cuenta o utilizando una cuenta registrada.
FR-COM-003 — Datos de contacto
El checkout debe solicitar:
    • Nombre completo.
    • Número de teléfono de contacto, preferiblemente WhatsApp.
El correo electrónico será opcional para el MVP, salvo que una funcionalidad posterior lo requiera.
FR-COM-004 — Modalidad de recepción
El cliente debe seleccionar una modalidad:
    • DELIVERY: entrega a domicilio.
    • PICKUP: recogida en tienda.
La modalidad determina los datos adicionales requeridos.
FR-COM-005 — Datos de entrega
Para modalidad DELIVERY, el sistema debe solicitar:
    • Municipio.
    • Barrio o zona.
    • Dirección completa.
    • Referencia o indicaciones para localizar el domicilio.
    • Nombre y teléfono del destinatario, cuando sea diferente del comprador.
La ubicación geográfica mediante coordenadas será opcional en el MVP.
FR-COM-006 — Datos de recogida
Para modalidad PICKUP, el sistema debe informar el punto de recogida y las instrucciones correspondientes. No debe exigir una dirección de domicilio.
FR-COM-007 — Cobertura
El sistema debe validar que la ubicación de entrega se encuentre dentro de la cobertura comercial configurada.
La cobertura inicial comprende Fusagasugá y zonas aledañas que defina la operación. Las zonas y condiciones no deben quedar codificadas directamente en el frontend.
FR-COM-008 — Método de pago
El cliente debe seleccionar uno de los siguientes métodos:
    • CASH: efectivo.
    • BANK_TRANSFER: transferencia bancaria.
La selección del método no implica que el pago haya sido recibido o validado.
3.2. Inventario y reservas
FR-INV-001 — Validación de disponibilidad
Antes de crear una orden, el sistema debe validar que exista disponibilidad suficiente para todas las variantes solicitadas.
FR-INV-002 — Reserva de inventario
Al crear la orden, el sistema debe reservar las unidades correspondientes.
La reserva:
    • Disminuye el stock disponible.
    • No disminuye inicialmente el stock físico.
    • Se mantiene hasta que la orden sea despachada o cancelada.
    • No tiene vencimiento automático en el MVP.
FR-INV-003 — Disponibilidad
La disponibilidad se calcula como:
quantity_on_hand - quantity_reserved
FR-INV-004 — Consistencia de reservas
La reserva debe ejecutarse de manera atómica. Si alguna variante no tiene disponibilidad suficiente, no se debe completar parcialmente la reserva.
El sistema debe prevenir reservas duplicadas por reintentos o concurrencia.
FR-INV-005 — Despacho
Cuando el operador confirma la salida física del pedido:
    • Se descuenta del stock físico la cantidad despachada.
    • Se disminuye la cantidad reservada correspondiente.
    • Se registra el movimiento de salida.
    • Se conserva la referencia a la orden.
FR-INV-006 — Cancelación antes del despacho
Si una orden se cancela antes de su salida física:
    • Se conserva la orden con estado CANCELLED.
    • Se libera la reserva.
    • No se registra una salida física ficticia.
    • Se registra el motivo y responsable de la cancelación.
FR-INV-007 — Retorno de mercancía
Si un pedido no puede entregarse y regresa a la tienda:
    • El operador verifica físicamente los productos.
    • Se registra la entrada de las unidades efectivamente devueltas y aptas para inventario.
    • Se registra la referencia de la orden.
    • No se reintegra inventario automáticamente sin verificación.
Los productos dañados o no aptos deben tratarse mediante un ajuste o movimiento de inventario justificado.
3.3. Gestión de órdenes
FR-ORD-001 — Bandeja de órdenes
El backoffice debe mostrar las órdenes creadas desde el checkout.
FR-ORD-002 — Consulta de detalle
Los usuarios autorizados pueden consultar:
    • Datos del comprador.
    • Datos del destinatario.
    • Productos y cantidades.
    • Total.
    • Modalidad de recepción.
    • Dirección o punto de recogida.
    • Método y estado del pago.
    • Estado de la orden.
    • Historial de operaciones.
FR-ORD-003 — Estados de la orden
Se establecen los siguientes estados:
Estado	Descripción
PENDING	Orden creada desde el checkout, pendiente de gestión.
CONFIRMED	Orden aceptada para su preparación.
PREPARING	Productos en proceso de alistamiento.
READY	Pedido preparado para despacho o recogida.
ON_DELIVERY	Pedido salió de la tienda con el domiciliario.
DELIVERY_FAILED	No fue posible completar la entrega.
RETURNED_TO_STORE	El pedido regresó y fue recibido en tienda.
DELIVERED	Pedido entregado al destinatario.
PICKED_UP	Pedido entregado al cliente en tienda.
CANCELLED	Orden cancelada.
FR-ORD-004 — Actualización de estados
El operador puede actualizar los estados permitidos según la modalidad y el estado actual.
El backend debe validar las transiciones. No se permiten cambios arbitrarios de estado desde el frontend.
FR-ORD-005 — Entrega fallida
Cuando el domiciliario no logra entregar el pedido:
    1. El operador registra el intento fallido y su motivo.
    2. La orden pasa a DELIVERY_FAILED.
    3. El pedido retorna a la tienda.
    4. El operador verifica los productos.
    5. La orden pasa a RETURNED_TO_STORE.
    6. Se registra el reintegro físico de las unidades aptas para inventario.
Desde RETURNED_TO_STORE, la orden podrá:
    • Volver a READY para un nuevo intento de entrega, realizando una nueva reserva de inventario.
    • Pasar a CANCELLED, liberando cualquier reserva activa.
FR-ORD-006 — Cancelación
El sistema debe permitir cancelar órdenes de acuerdo con los permisos y reglas operativas.
La cancelación debe registrar:
    • Motivo.
    • Usuario responsable.
    • Fecha y hora.
    • Efectos sobre reservas activas.
    • Estado de los pagos asociados.
Una orden despachada no puede tratarse como una cancelación previa al despacho. Debe registrarse primero su retorno físico o el tratamiento correspondiente.
3.4. Pagos
FR-PAY-001 — Registro inicial de pago
Al crear una orden, el sistema debe crear un registro de pago asociado al método seleccionado y con estado PENDING.
FR-PAY-002 — Transferencia bancaria
El sistema no procesa ni concilia transferencias bancarias automáticamente en el MVP.
El procedimiento será:
    1. Cliente selecciona transferencia.
    2. Se crea la orden con pago pendiente.
    3. El operador prepara el pedido.
    4. En tienda se verifica la recepción efectiva de la transferencia.
    5. El operador registra el pago como APPROVED.
    6. Se autoriza la salida del producto o la entrega en tienda.
La selección de transferencia no equivale a comprobación del pago.
FR-PAY-003 — Efectivo contraentrega
El procedimiento será:
    1. Cliente selecciona efectivo.
    2. Se crea la orden con pago pendiente.
    3. El pedido se prepara y despacha.
    4. El domiciliario entrega el producto y recibe el efectivo.
    5. El domiciliario entrega el dinero en tienda.
    6. El operador registra el pago como APPROVED.
El pedido puede encontrarse en estado DELIVERED mientras el pago continúa pendiente de entrega y registro del efectivo en tienda. La orden solo se considera financieramente pagada cuando el operador confirma la recepción del dinero.
FR-PAY-004 — Efectivo en recogida
Para modalidad PICKUP, el operador registra el pago cuando recibe el efectivo en tienda, antes o en el momento de entregar el pedido.
FR-PAY-005 — Validación de pagos
El registro de pago aprobado debe conservar:
    • Importe.
    • Método.
    • Fecha y hora de recepción.
    • Usuario responsable de su registro.
    • Referencia u observaciones, cuando correspondan.
FR-PAY-006 — Rechazo de transferencia
Si una transferencia no se verifica, el operador debe poder rechazar el registro o mantenerlo pendiente según el resultado de la revisión. No se autoriza la salida del producto como transferencia pagada.
FR-PAY-007 — Reportes financieros
Los ingresos efectivamente recibidos deben calcularse únicamente a partir de pagos aprobados. Las órdenes con pagos pendientes no deben contabilizarse como ingresos recibidos.
3.5. Backoffice
FR-BO-001 — Gestión de órdenes
El operador debe disponer de una bandeja para consultar, filtrar y gestionar órdenes.
FR-BO-002 — Gestión de entrega
El operador debe poder:
    • Consultar los datos de entrega.
    • Cambiar el estado operativo.
    • Registrar intentos fallidos.
    • Confirmar el retorno a tienda.
    • Registrar observaciones.
FR-BO-003 — Registro de pagos
El operador debe poder registrar la recepción de efectivo y la validación de transferencias.
FR-BO-004 — Trazabilidad
Las acciones sensibles deben registrar actor, fecha, operación y referencia afectada.
4. Reglas de negocio consolidadas
Código	Regla
RN-001	Una orden nace al completar exitosamente el checkout.
RN-002	Una orden puede pertenecer a un cliente registrado o invitado.
RN-003	Toda orden debe tener al menos un producto.
RN-004	El backend calcula precios, descuentos y totales.
RN-005	Toda orden debe tener una modalidad de recepción.
RN-006	La dirección es obligatoria únicamente para DELIVERY.
RN-007	La disponibilidad se calcula restando reservas al stock físico.
RN-008	La creación de una orden reserva inventario de manera atómica.
RN-009	Las reservas no expiran automáticamente en el MVP.
RN-010	La reserva se mantiene hasta despacho o cancelación.
RN-011	El despacho disminuye stock físico y reserva en una operación consistente.
RN-012	Una cancelación previa al despacho libera la reserva.
RN-013	Una devolución requiere recepción y verificación física.
RN-014	El retorno de mercancía se registra mediante un movimiento de entrada.
RN-015	Una nueva entrega requiere que exista inventario disponible y una nueva reserva.
RN-016	El método de pago seleccionado no implica que el pago esté realizado.
RN-017	Las transferencias se validan en tienda antes de autorizar la salida.
RN-018	El efectivo contraentrega se registra cuando el operador recibe el dinero del domiciliario.
RN-019	El efectivo de recogida se registra en tienda.
RN-020	Solo los pagos aprobados se consideran dinero recibido.
RN-021	Una orden entregada puede tener temporalmente un pago pendiente de registro.
RN-022	Los movimientos de inventario son inmutables; los errores se corrigen con movimientos compensatorios.
RN-023	Las operaciones de pago, inventario y cambio de estado deben ser auditables.
RN-024	La cobertura inicial se limita a Fusagasugá y zonas aledañas configuradas.
5. Transiciones principales de órdenes
Domicilio
PENDING → CONFIRMED → PREPARING → READY → ON_DELIVERY → DELIVERED
En caso de fallo:
ON_DELIVERY → DELIVERY_FAILED → RETURNED_TO_STORE
Desde RETURNED_TO_STORE:
    • Nuevo intento: READY.
    • Cancelación: CANCELLED.
Recogida en tienda
PENDING → CONFIRMED → PREPARING → READY → PICKED_UP
Cancelación antes de despacho
PENDING | CONFIRMED | PREPARING | READY → CANCELLED
Las transiciones deben ser validadas por backend. No se permite saltar directamente desde una orden despachada a una cancelación ordinaria.
6. Fuera del alcance del MVP
    • Integración bancaria y conciliación automática.
    • Pasarela de pagos.
    • Aplicación para domiciliarios.
    • Asignación automática de repartidores.
    • GPS y seguimiento en tiempo real.
    • Optimización de rutas.
    • Vencimiento automático de reservas.
    • Múltiples sucursales operativas.
    • Devoluciones y reembolsos automatizados.
    • Pagos parciales y múltiples medios de pago por orden.
7. Decisiones que siguen pendientes
    1. Definición exacta de municipios, barrios y zonas de cobertura.
    2. Tarifas de domicilio y reglas de cálculo.
    3. Horarios de operación.
    4. Política de cancelación por etapa.
    5. Tratamiento de pagos ya recibidos cuando se cancela una orden.
    6. Política de reintentos de entrega y costos asociados.
    7. Verificación de mayoría de edad y control en la entrega.
    8. Canal de notificaciones al cliente.
    9. Punto o puntos físicos de recogida.
    10. Reglas de recepción de productos devueltos que no estén en condiciones de reventa.
8. Criterios de aceptación del ciclo completo
El ciclo comercial se considera funcional cuando:
    1. Un cliente puede completar checkout como invitado o registrado.
    2. El backend crea una orden con sus datos y snapshots.
    3. El inventario se reserva correctamente.
    4. El operador visualiza y gestiona la orden.
    5. El operador puede preparar y despachar el pedido.
    6. Las transferencias se validan antes de la salida.
    7. El efectivo se registra cuando el operador recibe el dinero.
    8. Una entrega fallida puede regresar a tienda y registrar la entrada física.
    9. Una cancelación libera las reservas activas.
    10. El historial de orden, pagos e inventario permite reconstruir lo sucedido.
