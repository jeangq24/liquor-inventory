1. Objetivo
Definir la estructura interna, responsabilidades, contratos y pruebas necesarias para implementar la gestión de inventario y el ciclo de compra.
Los dos servicios tendrán responsabilidades independientes:
Servicio	Responsabilidad
liquor-inventory	Existencias, reservas, movimientos, despachos y devoluciones.
liquor-commerce-service	Carrito, checkout, pedidos, pagos y coordinación del proceso de compra.
1.1 Principios de implementación
    1. Cada servicio administra exclusivamente su esquema de base de datos.
    2. Commerce nunca modifica directamente el inventario.
    3. Inventory no administra estados comerciales de los pedidos.
    4. Las operaciones críticas deben ser transaccionales.
    5. Las solicitudes internas deben ser idempotentes.
    6. Los movimientos de inventario son inmutables.
    7. Las operaciones distribuidas deben contemplar fallos, reintentos y compensaciones.
    8. No se implementará un broker de mensajes para el MVP.

2. liquor-inventory
2.1 Responsabilidades
    • Consultar existencias disponibles.
    • Crear reservas de productos.
    • Liberar reservas.
    • Descontar existencias al despachar.
    • Registrar entradas y ajustes manuales.
    • Registrar devoluciones verificadas físicamente.
    • Mantener el historial de movimientos.
    • Garantizar que las operaciones concurrentes no generen sobreventa.
Inventory será la única autoridad sobre las cantidades físicas y reservadas.
2.2 Estructura de módulos
src/
├── modules/
│   ├── stock-balance/
│   │   ├── stock-balance.module.ts
│   │   ├── stock-balance.controller.ts
│   │   ├── stock-balance.service.ts
│   │   ├── stock-balance.repository.ts
│   │   └── dto/
│   │
│   ├── stock-reservation/
│   │   ├── stock-reservation.module.ts
│   │   ├── stock-reservation.controller.ts
│   │   ├── stock-reservation.service.ts
│   │   ├── stock-reservation.repository.ts
│   │   └── dto/
│   │
│   ├── stock-movement/
│   │   ├── stock-movement.module.ts
│   │   ├── stock-movement.service.ts
│   │   ├── stock-movement.repository.ts
│   │   └── dto/
│   │
│   └── stock-return/
│       ├── stock-return.module.ts
│       ├── stock-return.controller.ts
│       ├── stock-return.service.ts
│       ├── stock-return.repository.ts
│       └── dto/
│
├── infrastructure/
│   ├── database/
│   ├── security/
│   └── http/
│
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   └── exceptions/
│
└── app.module.ts
La estructura es una separación inicial de responsabilidades. No es necesario crear módulos adicionales hasta que exista una necesidad real.
2.3 Modelo de persistencia
inventory.stock_balances
Representa el estado actual de las existencias por variante y ubicación.
Campo	Tipo	Restricción
id	UUID	PK
location_id	UUID	Referencia lógica
variant_id	UUID	Referencia lógica a Catalog
quantity_on_hand	INTEGER	>= 0
quantity_reserved	INTEGER	>= 0
updated_at	TIMESTAMP	NOT NULL
Restricciones:
    • UNIQUE (location_id, variant_id).
    • quantity_reserved <= quantity_on_hand.
    • No permitir cantidades negativas.
Existencia disponible:
quantity_available = quantity_on_hand - quantity_reserved
inventory.stock_reservations
Registra cada intento de reserva de un pedido.
Campo	Tipo	Restricción
id	UUID	PK
order_id	UUID	Referencia lógica
location_id	UUID	Referencia lógica
status	ENUM	ACTIVE, RELEASED, DISPATCHED
idempotency_key	VARCHAR	UNIQUE
reserved_at	TIMESTAMP	Nullable
released_at	TIMESTAMP	Nullable
dispatched_at	TIMESTAMP	Nullable
created_at	TIMESTAMP	NOT NULL
updated_at	TIMESTAMP	NOT NULL
Una reserva por intento permite conservar el historial si un pedido vuelve a preparación después de una devolución.
Regla: solo puede existir una reserva ACTIVE por pedido y ubicación. Implementar un índice único parcial para garantizarlo.
inventory.stock_reservation_items
Campo	Tipo	Restricción
id	UUID	PK
reservation_id	UUID	FK a stock_reservations
variant_id	UUID	Referencia lógica
quantity	INTEGER	> 0
Restricción:
    • UNIQUE (reservation_id, variant_id).
inventory.stock_movements
Registro histórico e inmutable de movimientos.
Campo	Tipo	Descripción
id	UUID	PK
location_id	UUID	Ubicación
variant_id	UUID	Variante
movement_type	ENUM	IN, OUT, ADJUSTMENT, RESERVATION, RELEASE
quantity	INTEGER	Cantidad positiva
reason	VARCHAR	Motivo
reference_id	UUID	Referencia lógica
idempotency_key	VARCHAR	Identificador de operación
performed_by	UUID	Usuario responsable
created_at	TIMESTAMP	Fecha de operación
No se deben actualizar ni eliminar movimientos históricos. Las correcciones se realizan mediante movimientos compensatorios.
Consideración sobre devoluciones
Para soportar reintentos y evitar registrar dos veces una devolución, implementar también:
    • inventory.stock_returns
    • inventory.stock_return_items
Cada devolución tendrá su propio identificador e idempotency key. Esto permite registrar devoluciones parciales y diferenciar unidades vendibles de unidades dañadas.

2.4 Servicios y casos de uso
StockBalanceService
Responsabilidades:
    • Consultar existencias por variante.
    • Consultar disponibilidad por ubicación.
    • Consultar inventario general.
    • Validar cantidades disponibles.
Métodos propuestos:
getByVariant(variantId: string)
getAvailable(variantId: string, locationId: string)
getByLocation(locationId: string)
StockReservationService
Responsabilidades:
    • Crear reservas.
    • Liberar reservas.
    • Despachar reservas.
    • Consultar estado de una reserva.
    • Validar idempotencia.
Métodos propuestos:
reserve(input: ReserveStockDto)
release(orderId: string, input: ReleaseStockDto)
dispatch(orderId: string, input: DispatchStockDto)
getByOrder(orderId: string)
StockMovementService
Responsabilidades:
    • Registrar entradas.
    • Registrar salidas manuales autorizadas.
    • Registrar ajustes.
    • Consultar historial.
Métodos propuestos:
registerEntry(input: StockMovementDto)
registerAdjustment(input: StockAdjustmentDto)
getHistory(filters: StockMovementFilters)
StockReturnService
Responsabilidades:
    • Registrar devoluciones.
    • Validar unidades recibidas.
    • Reintegrar únicamente unidades aptas para la venta.
    • Mantener trazabilidad de la devolución.
Métodos propuestos:
registerReturn(input: RegisterStockReturnDto)
getByOrder(orderId: string)

2.5 API interna de Inventory
Todas las rutas internas requieren autenticación entre servicios.
Consultar disponibilidad
GET /internal/v1/stock/availability
Query:
{
  "variantIds": ["uuid-1", "uuid-2"],
  "locationId": "uuid-location"
}
Reservar existencias
POST /internal/v1/stock/reservations
{
  "orderId": "uuid-order",
  "locationId": "uuid-location",
  "idempotencyKey": "reserve-order-uuid",
  "items": [
    {
      "variantId": "uuid-variant",
      "quantity": 2
    }
  ]
}
Respuesta:
{
  "reservationId": "uuid-reservation",
  "orderId": "uuid-order",
  "status": "ACTIVE"
}
Liberar reserva
POST /internal/v1/stock/reservations/{orderId}/release
{
  "idempotencyKey": "release-order-uuid",
  "reason": "ORDER_CANCELLED"
}
Despachar reserva
POST /internal/v1/stock/reservations/{orderId}/dispatch
{
  "idempotencyKey": "dispatch-order-uuid",
  "performedBy": "uuid-operator"
}
El usuario responsable debe ser validado por el servicio a partir de un contexto autenticado y confiable. No debe aceptarse como identidad confiable un valor arbitrario enviado por el navegador.
Registrar devolución
POST /internal/v1/stock/returns
{
  "orderId": "uuid-order",
  "idempotencyKey": "return-order-attempt-1",
  "locationId": "uuid-location",
  "items": [
    {
      "variantId": "uuid-variant",
      "quantityReceived": 2,
      "quantityRestockable": 1,
      "reason": "DELIVERY_FAILED"
    }
  ]
}
La diferencia entre cantidad recibida y cantidad reintegrable permite registrar productos dañados sin devolverlos al inventario disponible.

2.6 Reglas transaccionales críticas
Reserva
Dentro de una transacción:
    1. Validar idempotency key.
    2. Bloquear las filas de stock_balances correspondientes.
    3. Validar disponibilidad de todas las variantes.
    4. Incrementar quantity_reserved.
    5. Crear stock_reservations.
    6. Crear stock_reservation_items.
    7. Registrar movimientos RESERVATION.
    8. Confirmar transacción.
Si una variante no tiene disponibilidad suficiente, no se reserva ninguna.
Liberación
Dentro de una transacción:
    1. Consultar y bloquear la reserva.
    2. Validar que esté ACTIVE.
    3. Decrementar quantity_reserved.
    4. Cambiar estado a RELEASED.
    5. Registrar movimientos RELEASE.
    6. Confirmar transacción.
Una reserva liberada no puede liberarse nuevamente.
Despacho
Dentro de una transacción:
    1. Consultar y bloquear la reserva.
    2. Validar que esté ACTIVE.
    3. Validar existencias reservadas.
    4. Decrementar quantity_on_hand.
    5. Decrementar quantity_reserved.
    6. Cambiar estado a DISPATCHED.
    7. Registrar movimientos OUT.
    8. Confirmar transacción.
No se permite despachar una reserva liberada o ya despachada.