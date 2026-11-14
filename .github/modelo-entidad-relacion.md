Modelo Entidad-Relación — Licorera Online
Versión: 1.2
Estado: Propuesta de modelo físico actualizado
Motor: PostgreSQL
ORM: Drizzle ORM
Infraestructura: Supabase
Arquitectura: Multiservicio · Base de datos compartida · Esquemas independientes
Nombre de plataforma: LicoresYaaa. La base local autogestionada se denomina `licoresyaaa`; en Supabase se mantiene el nombre de base `postgres` y los esquemas independientes por servicio.

1. Objetivo
Definir el modelo de datos de Licorera Online, estableciendo las entidades, atributos, relaciones, restricciones y responsabilidades de persistencia de cada servicio.
El modelo contempla:
    • Catálogo de productos y variantes.
    • Gestión manual de inventario.
    • Reservas y movimientos de existencias.
    • Devoluciones y reintentos de entrega.
    • Carritos y pedidos.
    • Pagos y comprobantes.
    • Usuarios, perfiles y control de acceso.
    • Coordinación de operaciones entre servicios.
1.1 Organización de esquemas
Esquema	Servicio responsable	Propósito
app	Plataforma / Access	Perfiles, roles, permisos y auditoría.
catalog	liquor-catalog	Productos, categorías, marcas y variantes.
inventory	liquor-inventory	Existencias, reservas, movimientos y devoluciones.
commerce	liquor-commerce-service	Carritos, pedidos, entregas, pagos y coordinación.
auth	Supabase	Identidad y autenticación administrada.
storage	Supabase	Archivos y comprobantes.
Los esquemas auth y storage son administrados por Supabase y no forman parte de las migraciones de los servicios.

2. Esquema app
Responsable de los perfiles de usuario, autorización y auditoría.
2.1 Entidades
app.profiles
Extiende la identidad proporcionada por Supabase Auth.
Campo	Tipo	Restricciones
id	UUID	PK, referencia a auth.users.id
full_name	VARCHAR(150)	NOT NULL
phone	VARCHAR(30)	NULL
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
app.roles
Campo	Tipo	Restricciones
id	UUID	PK
name	VARCHAR(50)	UNIQUE, NOT NULL
description	TEXT	NULL
created_at	TIMESTAMPTZ	NOT NULL
Roles iniciales: ADMIN, MANAGER y OPERATOR.
app.permissions
Campo	Tipo	Restricciones
id	UUID	PK
code	VARCHAR(120)	UNIQUE, NOT NULL
description	TEXT	NULL
Ejemplos:
    • catalog.products.read
    • inventory.stock.adjust
    • commerce.orders.update_status
    • commerce.payments.approve
    • access.roles.assign
    • audit.logs.read
app.user_roles
Campo	Tipo	Restricciones
user_id	UUID	FK a profiles.id
role_id	UUID	FK a roles.id
assigned_by	UUID	FK lógica a profiles.id, NULL
created_at	TIMESTAMPTZ	NOT NULL
PK compuesta: (user_id, role_id).
app.role_permissions
Campo	Tipo	Restricciones
role_id	UUID	FK a roles.id
permission_id	UUID	FK a permissions.id
created_at	TIMESTAMPTZ	NOT NULL
PK compuesta: (role_id, permission_id).
app.audit_logs
Campo	Tipo	Restricciones
id	UUID	PK
user_id	UUID	Referencia lógica a profiles.id
action	VARCHAR(120)	NOT NULL
resource	VARCHAR(120)	NOT NULL
resource_id	UUID	NULL
metadata	JSONB	NULL
ip_address	INET	NULL
created_at	TIMESTAMPTZ	NOT NULL
Registra acciones sensibles como ajustes de inventario, cambios de precios, cancelaciones, aprobación de pagos y modificaciones de permisos.

3. Esquema catalog
Responsable de la información comercial de los productos.
3.1 Entidades
catalog.brands
Campo	Tipo	Restricciones
id	UUID	PK
name	VARCHAR(120)	UNIQUE, NOT NULL
description	TEXT	NULL
image_path	TEXT	NULL
is_active	BOOLEAN	NOT NULL, DEFAULT TRUE
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
catalog.categories
Campo	Tipo	Restricciones
id	UUID	PK
name	VARCHAR(120)	NOT NULL
slug	VARCHAR(140)	UNIQUE, NOT NULL
description	TEXT	NULL
image_path	TEXT	NULL
parent_id	UUID	FK autorreferenciada, NULL
is_active	BOOLEAN	NOT NULL, DEFAULT TRUE
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
Permite jerarquías de categorías.
catalog.products
Campo	Tipo	Restricciones
id	UUID	PK
brand_id	UUID	FK a brands.id, NULL
name	VARCHAR(180)	NOT NULL
slug	VARCHAR(200)	UNIQUE, NOT NULL
description	TEXT	NULL
alcohol_percentage	NUMERIC(5,2)	NULL
is_active	BOOLEAN	NOT NULL, DEFAULT TRUE
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
catalog.product_categories
Campo	Tipo	Restricciones
product_id	UUID	FK a products.id
category_id	UUID	FK a categories.id
created_at	TIMESTAMPTZ	NOT NULL
PK compuesta: (product_id, category_id).
catalog.product_variants
Cada variante representa una presentación comercial independiente y tiene su propio SKU, precio e inventario.
Campo	Tipo	Restricciones
id	UUID	PK
product_id	UUID	FK a products.id
name	VARCHAR(120)	NOT NULL
sku	VARCHAR(80)	UNIQUE, NOT NULL
barcode	VARCHAR(80)	NULL
unit_size	VARCHAR(60)	NULL
price_cop	BIGINT	NOT NULL, >= 0
is_active	BOOLEAN	NOT NULL, DEFAULT TRUE
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
El precio se almacena como entero en pesos colombianos, evitando problemas de precisión decimal en operaciones monetarias.
catalog.product_images
Campo	Tipo	Restricciones
id	UUID	PK
product_id	UUID	FK a products.id
variant_id	UUID	FK a product_variants.id, NULL
storage_path	TEXT	NOT NULL
alt_text	VARCHAR(180)	NULL
position	INTEGER	NOT NULL, DEFAULT 0
is_primary	BOOLEAN	NOT NULL, DEFAULT FALSE
created_at	TIMESTAMPTZ	NOT NULL
Las imágenes se almacenan en Supabase Storage. La base de datos conserva su ruta.

4. Esquema inventory
Responsable exclusivo de la gestión física y lógica de existencias.
4.1 Entidades
inventory.inventory_locations
Permite administrar ubicaciones de inventario. Inicialmente existirá una ubicación principal, pero el modelo soporta futuras ubicaciones.
Campo	Tipo	Restricciones
id	UUID	PK
name	VARCHAR(120)	NOT NULL
code	VARCHAR(50)	UNIQUE, NOT NULL
address	TEXT	NULL
is_active	BOOLEAN	NOT NULL, DEFAULT TRUE
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
inventory.stock_balances
Representa el estado actual de existencias por variante y ubicación.
Campo	Tipo	Restricciones
id	UUID	PK
location_id	UUID	FK a inventory_locations.id
variant_id	UUID	Referencia lógica a catalog.product_variants.id
quantity_on_hand	INTEGER	NOT NULL, >= 0
quantity_reserved	INTEGER	NOT NULL, >= 0
updated_at	TIMESTAMPTZ	NOT NULL
Restricciones:
    • UNIQUE (location_id, variant_id).
    • quantity_reserved <= quantity_on_hand.
Existencia disponible:
quantity_available = quantity_on_hand - quantity_reserved
No se almacena quantity_available; se calcula para evitar inconsistencias.
inventory.stock_reservations
Registra cada intento de reserva asociado a un pedido.
Campo	Tipo	Restricciones
id	UUID	PK
order_id	UUID	Referencia lógica a commerce.orders.id
location_id	UUID	FK a inventory_locations.id
status	VARCHAR(20)	NOT NULL
idempotency_key	VARCHAR(180)	UNIQUE, NOT NULL
reserved_at	TIMESTAMPTZ	NULL
released_at	TIMESTAMPTZ	NULL
dispatched_at	TIMESTAMPTZ	NULL
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
Estados:
    • ACTIVE
    • RELEASED
    • DISPATCHED
Reglas:
    • Cada intento genera un registro independiente.
    • Un pedido puede tener reservas históricas.
    • Solo puede existir una reserva ACTIVE por pedido.
    • Una reserva liberada o despachada no puede volver a activarse.
    • Un nuevo intento de preparación genera una nueva reserva.
Índice único parcial:
UNIQUE (order_id) WHERE status = 'ACTIVE'
inventory.stock_reservation_items
Detalle de las variantes y cantidades incluidas en cada reserva.
Campo	Tipo	Restricciones
id	UUID	PK
reservation_id	UUID	FK a stock_reservations.id
variant_id	UUID	Referencia lógica a catalog.product_variants.id
quantity	INTEGER	NOT NULL, > 0
created_at	TIMESTAMPTZ	NOT NULL
Restricciones:
    • UNIQUE (reservation_id, variant_id).
    • No se permiten cantidades iguales o inferiores a cero.
inventory.stock_movements
Registro histórico e inmutable de movimientos de inventario.
Campo	Tipo	Restricciones
id	UUID	PK
location_id	UUID	FK a inventory_locations.id
variant_id	UUID	Referencia lógica a catalog.product_variants.id
reservation_id	UUID	FK a stock_reservations.id, NULL
stock_return_id	UUID	FK a stock_returns.id, NULL
movement_type	VARCHAR(30)	NOT NULL
quantity	INTEGER	NOT NULL, > 0
reason	VARCHAR(180)	NOT NULL
order_id	UUID	Referencia lógica a commerce.orders.id, NULL
idempotency_key	VARCHAR(180)	UNIQUE, NOT NULL
performed_by	UUID	Referencia lógica a app.profiles.id, NULL
created_at	TIMESTAMPTZ	NOT NULL
Tipos de movimiento:
    • IN
    • OUT
    • ADJUSTMENT_IN
    • ADJUSTMENT_OUT
    • RESERVATION
    • RELEASE
Reglas:
    • Los movimientos no se actualizan ni eliminan.
    • Las correcciones se registran mediante movimientos compensatorios.
    • RESERVATION y RELEASE modifican la cantidad reservada.
    • IN y OUT modifican la cantidad física.
    • ADJUSTMENT_IN y ADJUSTMENT_OUT modifican la cantidad física.
    • El movimiento OUT de un despacho debe quedar relacionado con su reserva.
inventory.stock_returns
Representa una devolución física asociada a un pedido.
Campo	Tipo	Restricciones
id	UUID	PK
order_id	UUID	Referencia lógica a commerce.orders.id
location_id	UUID	FK a inventory_locations.id
delivery_attempt_id	UUID	Referencia lógica a commerce.delivery_attempts.id, NULL
idempotency_key	VARCHAR(180)	UNIQUE, NOT NULL
reason	VARCHAR(180)	NOT NULL
status	VARCHAR(20)	NOT NULL
received_by	UUID	Referencia lógica a app.profiles.id
received_at	TIMESTAMPTZ	NOT NULL
created_at	TIMESTAMPTZ	NOT NULL
Estados:
    • RECEIVED
    • PROCESSED
    • CANCELLED
Una devolución debe ser procesada una sola vez. La recepción física y la reintegración al inventario son eventos diferenciados.
inventory.stock_return_items
Detalle de las unidades recibidas y su condición.
Campo	Tipo	Restricciones
id	UUID	PK
stock_return_id	UUID	FK a stock_returns.id
variant_id	UUID	Referencia lógica a catalog.product_variants.id
quantity_received	INTEGER	NOT NULL, > 0
quantity_restockable	INTEGER	NOT NULL, >= 0
reason	VARCHAR(180)	NULL
created_at	TIMESTAMPTZ	NOT NULL
Restricciones:
    • UNIQUE (stock_return_id, variant_id).
    • quantity_restockable <= quantity_received.
Las unidades dañadas o no aptas no se reintegran al inventario disponible.
La cantidad reintegrable genera un movimiento IN. La cantidad no reintegrable permanece registrada en el historial de devolución.

5. Esquema commerce
Responsable de la experiencia de compra y de la operación comercial de los pedidos.
5.1 Entidades
commerce.carts
Campo	Tipo	Restricciones
id	UUID	PK
customer_id	UUID	Referencia lógica a app.profiles.id, NULL
session_id	VARCHAR(180)	NULL
status	VARCHAR(20)	NOT NULL
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
Un carrito puede pertenecer a un cliente registrado o a una sesión de invitado.
commerce.cart_items
Campo	Tipo	Restricciones
id	UUID	PK
cart_id	UUID	FK a carts.id
variant_id	UUID	Referencia lógica a catalog.product_variants.id
quantity	INTEGER	NOT NULL, > 0
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
Restricción:
    • UNIQUE (cart_id, variant_id).
Los precios definitivos se validan nuevamente durante el checkout.
commerce.orders
Entidad central del proceso comercial.
Campo	Tipo	Restricciones
id	UUID	PK
order_number	VARCHAR(40)	UNIQUE, NOT NULL
customer_id	UUID	Referencia lógica a app.profiles.id, NULL
customer_type	VARCHAR(20)	NOT NULL
customer_name	VARCHAR(150)	NOT NULL
customer_phone	VARCHAR(30)	NOT NULL
customer_email	VARCHAR(180)	NULL
status	VARCHAR(30)	NOT NULL
fulfillment_type	VARCHAR(20)	NOT NULL
inventory_reservation_status	VARCHAR(20)	NOT NULL
subtotal_cop	BIGINT	NOT NULL, >= 0
discount_cop	BIGINT	NOT NULL, DEFAULT 0
delivery_fee_cop	BIGINT	NOT NULL, DEFAULT 0
total_cop	BIGINT	NOT NULL, >= 0
notes	TEXT	NULL
cancellation_reason	TEXT	NULL
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
Valores de customer_type:
    • REGISTERED
    • GUEST
Valores de fulfillment_type:
    • DELIVERY
    • PICKUP
Estados comerciales:
    • PENDING
    • CONFIRMED
    • PREPARING
    • READY
    • ON_DELIVERY
    • DELIVERY_FAILED
    • RETURNED_TO_STORE
    • DELIVERED
    • PICKED_UP
    • CANCELLED
Estados de coordinación con Inventory:
    • PENDING
    • RESERVED
    • RELEASED
    • DISPATCHED
    • FAILED
El estado comercial y el estado de reserva son independientes.
Un pedido no puede pasar a PREPARING si no tiene su reserva confirmada.
Los datos del cliente se conservan como fotografía del momento de la compra. Los pedidos históricos no deben depender de que el perfil del cliente permanezca sin cambios.
commerce.order_items
Conserva una fotografía de los productos comprados.
Campo	Tipo	Restricciones
id	UUID	PK
order_id	UUID	FK a orders.id
variant_id	UUID	Referencia lógica a catalog.product_variants.id
product_name_snapshot	VARCHAR(180)	NOT NULL
variant_name_snapshot	VARCHAR(120)	NOT NULL
sku_snapshot	VARCHAR(80)	NOT NULL
quantity	INTEGER	NOT NULL, > 0
unit_price_cop	BIGINT	NOT NULL, >= 0
discount_amount_cop	BIGINT	NOT NULL, DEFAULT 0
line_total_cop	BIGINT	NOT NULL, >= 0
created_at	TIMESTAMPTZ	NOT NULL
Los nombres, SKU y precios se conservan aunque el catálogo cambie posteriormente.
commerce.payments
Campo	Tipo	Restricciones
id	UUID	PK
order_id	UUID	FK a orders.id
method	VARCHAR(30)	NOT NULL
status	VARCHAR(30)	NOT NULL
amount_cop	BIGINT	NOT NULL, > 0
reference	VARCHAR(180)	NULL
proof_path	TEXT	NULL
paid_at	TIMESTAMPTZ	NULL
verified_by	UUID	Referencia lógica a app.profiles.id, NULL
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
Métodos:
    • CASH
    • BANK_TRANSFER
Estados:
    • PENDING
    • UNDER_REVIEW
    • APPROVED
    • REJECTED
    • REFUNDED
    • CANCELLED
Un pedido puede tener múltiples pagos para permitir futuras operaciones parciales.
Solo los pagos aprobados se consideran dinero recibido.
En efectivo contraentrega, el pedido puede estar DELIVERED mientras el pago permanece PENDING, hasta que el operador recibe el dinero del domiciliario.
commerce.order_deliveries
Conserva la información principal de entrega de un pedido.
Campo	Tipo	Restricciones
id	UUID	PK
order_id	UUID	UNIQUE, FK a orders.id
recipient_name	VARCHAR(150)	NULL
recipient_phone	VARCHAR(30)	NULL
municipality	VARCHAR(120)	NULL
neighborhood	VARCHAR(120)	NULL
address	TEXT	NULL
address_reference	TEXT	NULL
latitude	NUMERIC(10,7)	NULL
longitude	NUMERIC(10,7)	NULL
created_at	TIMESTAMPTZ	NOT NULL
updated_at	TIMESTAMPTZ	NOT NULL
Solo se crea para pedidos con fulfillment_type = DELIVERY.
La dirección y los datos del destinatario se conservan como fotografía de la compra.
commerce.delivery_attempts
Registra cada intento de entrega de un pedido.
Campo	Tipo	Restricciones
id	UUID	PK
delivery_id	UUID	FK a order_deliveries.id
attempt_number	INTEGER	NOT NULL, > 0
status	VARCHAR(30)	NOT NULL
failure_reason	TEXT	NULL
started_at	TIMESTAMPTZ	NULL
failed_at	TIMESTAMPTZ	NULL
returned_at	TIMESTAMPTZ	NULL
delivered_at	TIMESTAMPTZ	NULL
registered_by	UUID	Referencia lógica a app.profiles.id
created_at	TIMESTAMPTZ	NOT NULL
Restricciones:
    • UNIQUE (delivery_id, attempt_number).
Estados:
    • PENDING
    • IN_TRANSIT
    • FAILED
    • RETURNED_TO_STORE
    • DELIVERED
Cada intento tiene su propio registro. No se sobrescribe el historial anterior cuando se reintenta una entrega.
commerce.outbox_events
Permite recuperar operaciones distribuidas pendientes entre Commerce e Inventory.
Campo	Tipo	Restricciones
id	UUID	PK
event_type	VARCHAR(100)	NOT NULL
aggregate_id	UUID	NOT NULL
payload	JSONB	NOT NULL
idempotency_key	VARCHAR(180)	UNIQUE, NOT NULL
status	VARCHAR(20)	NOT NULL
attempts	INTEGER	NOT NULL, DEFAULT 0
next_attempt_at	TIMESTAMPTZ	NULL
last_error	TEXT	NULL
created_at	TIMESTAMPTZ	NOT NULL
processed_at	TIMESTAMPTZ	NULL
Estados:
    • PENDING
    • PROCESSING
    • COMPLETED
    • FAILED
El Outbox es responsabilidad exclusiva de Commerce.
Permite recuperar operaciones como:
    • RESERVE_STOCK
    • RELEASE_STOCK
    • DISPATCH_STOCK
    • REGISTER_STOCK_RETURN
El procesamiento debe ser idempotente y admitir reintentos controlados.

6. Relaciones entre entidades
6.1 app
    • profiles 1 user_roles
    • roles 1 user_roles
    • roles 1 role_permissions
    • permissions 1 role_permissions
    • profiles 1 audit_logs
6.2 catalog
    • brands 1 products
    • categories 1 categories mediante parent_id
    • products N categories mediante product_categories
    • products 1 product_variants
    • products 1 product_images
    • product_variants 1 product_images
6.3 inventory
    • inventory_locations 1 stock_balances
    • inventory_locations 1 stock_reservations
    • inventory_locations 1 stock_movements
    • inventory_locations 1 stock_returns
    • stock_balances 1 stock_movements mediante location_id y variant_id como referencia lógica
    • stock_reservations 1 stock_reservation_items
    • stock_reservations 1 stock_movements
    • stock_returns 1 stock_return_items
    • stock_returns 1 stock_movements
    • product_variants 1 stock_balances mediante referencia lógica
    • product_variants 1 stock_reservation_items mediante referencia lógica
6.4 commerce
    • carts 1 cart_items
    • orders 1 order_items
    • orders 1 payments
    • orders 1:1 order_deliveries para pedidos de entrega
    • order_deliveries 1 delivery_attempts
    • orders 1 outbox_events
    • profiles 1 orders mediante customer_id, opcional
    • product_variants 1 cart_items mediante referencia lógica
    • product_variants 1 order_items mediante referencia lógica
6.5 Relaciones entre esquemas
Las referencias entre servicios son referencias lógicas mediante UUID.
Ejemplos:
    • inventory.stock_balances.variant_id → catalog.product_variants.id
    • inventory.stock_reservations.order_id → commerce.orders.id
    • commerce.orders.customer_id → app.profiles.id
    • inventory.stock_movements.performed_by → app.profiles.id
No se crean claves foráneas físicas entre esquemas propiedad de servicios diferentes.
Cada servicio valida estas referencias mediante sus contratos de integración.

7. Reglas de integridad y negocio
7.1 Inventario
    1. No se permiten cantidades físicas negativas.
    2. No se permiten cantidades reservadas negativas.
    3. Las cantidades reservadas nunca pueden superar las físicas.
    4. Una reserva debe afectar todas sus variantes o ninguna.
    5. Solo una reserva activa puede existir por pedido.
    6. Una reserva liberada no se libera nuevamente.
    7. Una reserva despachada no se despacha nuevamente.
    8. El despacho descuenta simultáneamente cantidad física y reservada.
    9. Las devoluciones solo reintegran unidades físicamente verificadas y aptas.
    10. Los movimientos son inmutables.
    11. Las operaciones críticas requieren idempotency key.
7.2 Pedidos
    1. Los pedidos pueden ser de clientes registrados o invitados.
    2. El cliente invitado no requiere profile.
    3. Los pedidos conservan la información del cliente y sus productos.
    4. Los pedidos de recogida no requieren dirección de entrega.
    5. Un pedido solo puede prepararse con reserva confirmada.
    6. Un pedido cancelado conserva su historial.
    7. Las devoluciones no eliminan ni revierten el pedido histórico.
    8. Los intentos de entrega se registran individualmente.
7.3 Pagos
    1. El pago se administra independientemente del estado del pedido.
    2. La transferencia debe verificarse antes del despacho.
    3. El efectivo contraentrega se aprueba cuando el operador recibe el dinero.
    4. Un pago pendiente no se contabiliza como ingreso recibido.
    5. Las modificaciones de estado de pago deben quedar auditadas.
7.4 Operaciones distribuidas
    1. Commerce coordina el proceso de compra.
    2. Inventory administra el inventario.
    3. Cada servicio confirma sus propias transacciones.
    4. Las solicitudes internas son idempotentes.
    5. Los errores de red no deben generar operaciones duplicadas.
    6. Outbox permite recuperar operaciones incompletas.
    7. Las compensaciones deben respetar el estado real de la operación original.

8. Índices y restricciones recomendadas
Además de las claves primarias, foráneas y restricciones únicas de las entidades:
Catalog
    • products.slug UNIQUE.
    • product_variants.sku UNIQUE.
    • categories.slug UNIQUE.
    • Índice en products.brand_id.
    • Índice en product_categories.category_id.
    • Índice en product_variants.product_id.
Inventory
    • UNIQUE (location_id, variant_id) en stock_balances.
    • UNIQUE (order_id) WHERE status = 'ACTIVE' en stock_reservations.
    • UNIQUE (idempotency_key) en stock_reservations.
    • UNIQUE (reservation_id, variant_id) en stock_reservation_items.
    • UNIQUE (idempotency_key) en stock_movements.
    • UNIQUE (idempotency_key) en stock_returns.
    • UNIQUE (stock_return_id, variant_id) en stock_return_items.
    • Índice en stock_movements.variant_id, created_at.
    • Índice en stock_movements.order_id.
    • Índice en stock_reservations.order_id.
    • Índice en stock_returns.order_id.
Commerce
    • UNIQUE orders.order_number.
    • UNIQUE (cart_id, variant_id) en cart_items.
    • UNIQUE order_deliveries.order_id.
    • UNIQUE (delivery_id, attempt_number) en delivery_attempts.
    • UNIQUE outbox_events.idempotency_key.
    • Índice en orders.status, created_at.
    • Índice en orders.customer_id.
    • Índice en orders.inventory_reservation_status.
    • Índice en payments.order_id, status.
    • Índice en delivery_attempts.delivery_id.
    • Índice en outbox_events.status, next_attempt_at.
Los índices únicos parciales y sus predicados deben definirse explícitamente en las migraciones PostgreSQL. Drizzle permite declarar índices con condiciones where; cuando sea necesario, se puede usar SQL explícito en la migración.

9. Decisiones de persistencia
Decisión	Definición
Base de datos	PostgreSQL
Infraestructura	Supabase
ORM	Drizzle ORM
Identificadores	UUID
Fechas	TIMESTAMPTZ
Moneda	BIGINT en COP
Cantidades	INTEGER
Datos flexibles	JSONB solo cuando corresponda
Identidad	Supabase Auth
Archivos	Supabase Storage
Relaciones entre servicios	Referencias lógicas
Migraciones	Propiedad de cada servicio
Inventario	Gestión manual
Ubicaciones	Modelo preparado para expansión
Variantes	Sí
Clientes	Registrados e invitados
Reservas	Hasta despacho o cancelación
Expiración automática	No incluida en MVP

10. Distribución de propiedad
Tabla	Servicio propietario
profiles	Plataforma / Access
roles	Plataforma / Access
permissions	Plataforma / Access
user_roles	Plataforma / Access
role_permissions	Plataforma / Access
audit_logs	Plataforma / Access
brands	liquor-catalog
categories	liquor-catalog
products	liquor-catalog
product_categories	liquor-catalog
product_variants	liquor-catalog
product_images	liquor-catalog
inventory_locations	liquor-inventory
stock_balances	liquor-inventory
stock_reservations	liquor-inventory
stock_reservation_items	liquor-inventory
stock_movements	liquor-inventory
stock_returns	liquor-inventory
stock_return_items	liquor-inventory
carts	liquor-commerce-service
cart_items	liquor-commerce-service
orders	liquor-commerce-service
order_items	liquor-commerce-service
payments	liquor-commerce-service
order_deliveries	liquor-commerce-service
delivery_attempts	liquor-commerce-service
outbox_events	liquor-commerce-service

11. Decisiones pendientes
Tema	Estado
Zonas exactas de cobertura	Pendiente
Tarifas de domicilio	Pendiente
Horarios de operación	Pendiente
Política de cancelación	Pendiente
Tratamiento de pagos al cancelar	Pendiente
Política de productos dañados	Pendiente
Verificación de edad en entrega	Pendiente
Punto de recogida	Pendiente
Conservación de comprobantes	Pendiente
Proveedor de despliegue	Pendiente

12. Criterios de aceptación del modelo
El MER se considera listo para implementación cuando:
    • Todas las tablas tienen propietario definido.
    • Las relaciones internas tienen claves foráneas.
    • Las relaciones entre servicios están documentadas como referencias lógicas.
    • Las restricciones de integridad están definidas.
    • Los índices críticos están identificados.
    • Las reservas permiten reintentos.
    • Las devoluciones tienen trazabilidad.
    • Los intentos de entrega conservan historial.
    • El Outbox permite recuperar operaciones distribuidas.
    • Las migraciones pueden ejecutarse independientemente por servicio.
Resultado: modelo de datos preparado para implementar el ciclo completo de compra, reserva, despacho, devolución y recuperación de operaciones en Licorera Online.
Cambios principales respecto a v1.1
Área	Cambio
Inventory	Se agregan stock_reservations y stock_reservation_items.
Inventory	Se agregan stock_returns y stock_return_items.
Inventory	Se relacionan los movimientos con reservas y devoluciones.
Commerce	Se agrega inventory_reservation_status a orders.
Commerce	Se agrega outbox_events.
Commerce	Se agrega delivery_attempts.
Integridad	Se incorporan restricciones de idempotencia y reserva activa.


Una precisión importante: la reserva activa se controla con un índice único parcial. Esto permite conservar reservas históricas y crear una nueva después de una devolución sin permitir dos reservas activas simultáneas para el mismo pedido. PostgreSQL soporta esta restricción y Drizzle permite declararla mediante condiciones where. 
PostgreSQL+1
