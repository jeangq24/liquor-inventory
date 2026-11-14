Liquor Inventory — Modelo físico y migración inicial
Documento: Especificación física de base de datos
Versión: 1.0
Modelo de referencia: MER Licorera Online v1.2
Servicio propietario: liquor-inventory
Base de datos: PostgreSQL / Supabase
ORM: Drizzle ORM

1. Alcance
Esta implementación crea el esquema inventory y sus seis entidades:
    1. inventory_locations
    2. stock_balances
    3. stock_reservations
    4. stock_reservation_items
    5. stock_returns
    6. stock_return_items
    7. stock_movements
Se incluyen los tipos ENUM, restricciones, índices, relaciones internas y reglas de integridad.
Las referencias a catalog, commerce y app serán UUID lógicos, sin claves foráneas físicas.
2. Tipos de datos
Concepto	PostgreSQL	Justificación
Identificadores	UUID	Identificación distribuida
Cantidades	INTEGER	Unidades enteras
Estados	ENUM	Valores controlados
Fechas	TIMESTAMPTZ	Fecha con zona horaria
Motivos	VARCHAR / TEXT	Información descriptiva
Claves idempotentes	VARCHAR(180)	Identificación de operaciones
2.1 ENUM
CREATE TYPE inventory.reservation_status AS ENUM (
  'ACTIVE',
  'RELEASED',
  'DISPATCHED'
);

CREATE TYPE inventory.movement_type AS ENUM (
  'IN',
  'OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RESERVATION',
  'RELEASE'
);

CREATE TYPE inventory.stock_return_status AS ENUM (
  'RECEIVED',
  'PROCESSED',
  'CANCELLED'
);
3. Migración SQL inicial
Archivo sugerido:
drizzle/0001_create_inventory_schema.sql
La migración debe ejecutarse en una base de datos donde el esquema inventory todavía no exista.
-- =====================================================
-- 1. SCHEMA
-- =====================================================

CREATE SCHEMA IF NOT EXISTS inventory;

-- =====================================================
-- 2. ENUMS
-- =====================================================

CREATE TYPE inventory.reservation_status AS ENUM (
  'ACTIVE',
  'RELEASED',
  'DISPATCHED'
);

CREATE TYPE inventory.movement_type AS ENUM (
  'IN',
  'OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RESERVATION',
  'RELEASE'
);

CREATE TYPE inventory.stock_return_status AS ENUM (
  'RECEIVED',
  'PROCESSED',
  'CANCELLED'
);

-- =====================================================
-- 3. INVENTORY LOCATIONS
-- =====================================================

CREATE TABLE inventory.inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(120) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  address TEXT,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. STOCK BALANCES
-- =====================================================

CREATE TABLE inventory.stock_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  location_id UUID NOT NULL,
  variant_id UUID NOT NULL,

  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_stock_balances_location
    FOREIGN KEY (location_id)
    REFERENCES inventory.inventory_locations(id),

  CONSTRAINT uq_stock_balances_location_variant
    UNIQUE (location_id, variant_id),

  CONSTRAINT chk_stock_balances_on_hand
    CHECK (quantity_on_hand >= 0),

  CONSTRAINT chk_stock_balances_reserved
    CHECK (quantity_reserved >= 0),

  CONSTRAINT chk_stock_balances_available
    CHECK (quantity_reserved <= quantity_on_hand)
);

CREATE INDEX idx_stock_balances_variant
  ON inventory.stock_balances(variant_id);

CREATE INDEX idx_stock_balances_location
  ON inventory.stock_balances(location_id);

-- =====================================================
-- 5. STOCK RESERVATIONS
-- =====================================================

CREATE TABLE inventory.stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL,
  location_id UUID NOT NULL,

  status inventory.reservation_status
    NOT NULL DEFAULT 'ACTIVE',

  idempotency_key VARCHAR(180) NOT NULL UNIQUE,

  reserved_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_stock_reservations_location
    FOREIGN KEY (location_id)
    REFERENCES inventory.inventory_locations(id),

  CONSTRAINT chk_stock_reservations_timestamps
    CHECK (
      (status <> 'RELEASED' OR released_at IS NOT NULL)
      AND
      (status <> 'DISPATCHED' OR dispatched_at IS NOT NULL)
    )
);

-- Un pedido solo puede tener una reserva activa.
CREATE UNIQUE INDEX uq_stock_reservations_active_order
  ON inventory.stock_reservations(order_id)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_stock_reservations_order
  ON inventory.stock_reservations(order_id);

CREATE INDEX idx_stock_reservations_location
  ON inventory.stock_reservations(location_id);

-- =====================================================
-- 6. STOCK RESERVATION ITEMS
-- =====================================================

CREATE TABLE inventory.stock_reservation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  reservation_id UUID NOT NULL,
  variant_id UUID NOT NULL,

  quantity INTEGER NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_reservation_items_reservation
    FOREIGN KEY (reservation_id)
    REFERENCES inventory.stock_reservations(id),

  CONSTRAINT uq_reservation_items_variant
    UNIQUE (reservation_id, variant_id),

  CONSTRAINT chk_reservation_items_quantity
    CHECK (quantity > 0)
);

CREATE INDEX idx_reservation_items_variant
  ON inventory.stock_reservation_items(variant_id);

-- =====================================================
-- 7. STOCK RETURNS
-- =====================================================

CREATE TABLE inventory.stock_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL,
  location_id UUID NOT NULL,

  -- Referencia lógica a commerce.delivery_attempts.id
  delivery_attempt_id UUID,

  idempotency_key VARCHAR(180) NOT NULL UNIQUE,

  reason VARCHAR(180) NOT NULL,

  status inventory.stock_return_status
    NOT NULL DEFAULT 'RECEIVED',

  received_by UUID,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_stock_returns_location
    FOREIGN KEY (location_id)
    REFERENCES inventory.inventory_locations(id),

  CONSTRAINT chk_stock_returns_processed
    CHECK (
      status <> 'PROCESSED'
      OR processed_at IS NOT NULL
    )
);

CREATE INDEX idx_stock_returns_order
  ON inventory.stock_returns(order_id);

CREATE INDEX idx_stock_returns_location
  ON inventory.stock_returns(location_id);

CREATE INDEX idx_stock_returns_delivery_attempt
  ON inventory.stock_returns(delivery_attempt_id);

-- =====================================================
-- 8. STOCK RETURN ITEMS
-- =====================================================

CREATE TABLE inventory.stock_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  stock_return_id UUID NOT NULL,
  variant_id UUID NOT NULL,

  quantity_received INTEGER NOT NULL,
  quantity_restockable INTEGER NOT NULL DEFAULT 0,

  reason VARCHAR(180),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_stock_return_items_return
    FOREIGN KEY (stock_return_id)
    REFERENCES inventory.stock_returns(id),

  CONSTRAINT uq_stock_return_items_variant
    UNIQUE (stock_return_id, variant_id),

  CONSTRAINT chk_stock_return_items_received
    CHECK (quantity_received > 0),

  CONSTRAINT chk_stock_return_items_restockable
    CHECK (
      quantity_restockable >= 0
      AND quantity_restockable <= quantity_received
    )
);

CREATE INDEX idx_stock_return_items_variant
  ON inventory.stock_return_items(variant_id);

-- =====================================================
-- 9. STOCK MOVEMENTS
-- =====================================================

CREATE TABLE inventory.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  location_id UUID NOT NULL,
  variant_id UUID NOT NULL,

  reservation_id UUID,
  stock_return_id UUID,

  order_id UUID,

  movement_type inventory.movement_type NOT NULL,

  quantity INTEGER NOT NULL,

  reason VARCHAR(180) NOT NULL,

  idempotency_key VARCHAR(180) NOT NULL UNIQUE,

  -- Referencia lógica a app.profiles.id
  performed_by UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_stock_movements_location
    FOREIGN KEY (location_id)
    REFERENCES inventory.inventory_locations(id),

  CONSTRAINT fk_stock_movements_reservation
    FOREIGN KEY (reservation_id)
    REFERENCES inventory.stock_reservations(id),

  CONSTRAINT fk_stock_movements_return
    FOREIGN KEY (stock_return_id)
    REFERENCES inventory.stock_returns(id),

  CONSTRAINT chk_stock_movements_quantity
    CHECK (quantity > 0)
);

CREATE INDEX idx_stock_movements_variant_date
  ON inventory.stock_movements(variant_id, created_at DESC);

CREATE INDEX idx_stock_movements_order
  ON inventory.stock_movements(order_id);

CREATE INDEX idx_stock_movements_location_date
  ON inventory.stock_movements(location_id, created_at DESC);

CREATE INDEX idx_stock_movements_reservation
  ON inventory.stock_movements(reservation_id);

CREATE INDEX idx_stock_movements_return
  ON inventory.stock_movements(stock_return_id);
4. Reglas de integridad
4.1 Existencias
La cantidad disponible se calcula:
SELECT
  location_id,
  variant_id,
  quantity_on_hand,
  quantity_reserved,
  quantity_on_hand - quantity_reserved AS quantity_available
FROM inventory.stock_balances;
No se almacena quantity_available porque es un valor derivado.
4.2 Reservas
Una reserva tiene un ciclo de vida:
ACTIVE
  ├── RELEASED
  └── DISPATCHED
No se permite reactivar una reserva finalizada.
Cuando un pedido vuelve a preparación después de una devolución, se crea una reserva nueva.
4.3 Movimientos
Movimiento	Efecto sobre existencias físicas	Efecto sobre reservas
IN	+ cantidad	Sin cambios
OUT	- cantidad	Sin cambios
ADJUSTMENT_IN	+ cantidad	Sin cambios
ADJUSTMENT_OUT	- cantidad	Sin cambios
RESERVATION	Sin cambios	+ cantidad
RELEASE	Sin cambios	- cantidad
El despacho combina dos modificaciones:
quantity_on_hand  -= quantity
quantity_reserved -= quantity
Y genera un movimiento OUT.
4.4 Devoluciones
Una devolución puede contener unidades en distintas condiciones.
Ejemplo:
Cantidad recibida: 3
Cantidad apta:     2
Cantidad dañada:   1
Resultado:
stock_on_hand += 2
La devolución se marca PROCESSED una vez se registra la reintegración correspondiente.

5. Configuración Drizzle ORM
5.1 Estructura sugerida
src/
└── infrastructure/
    └── database/
        ├── database.module.ts
        ├── database.provider.ts
        └── schema/
            ├── inventory.schema.ts
            └── index.ts

drizzle/
├── 0001_create_inventory_schema.sql
└── meta/
5.2 Configuración drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infrastructure/database/schema/**/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
La configuración debe cargar únicamente las tablas que pertenecen a Inventory. No se deben incluir los esquemas de otros servicios como parte de sus migraciones.
5.3 Definición de esquemas en TypeScript
Archivo: inventory.schema.ts
import { sql } from 'drizzle-orm';

import {
  pgSchema,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';

export const inventorySchema = pgSchema('inventory');

export const reservationStatusEnum = inventorySchema.enum(
  'reservation_status',
  ['ACTIVE', 'RELEASED', 'DISPATCHED'],
);

export const movementTypeEnum = inventorySchema.enum(
  'movement_type',
  [
    'IN',
    'OUT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'RESERVATION',
    'RELEASE',
  ],
);

export const stockReturnStatusEnum = inventorySchema.enum(
  'stock_return_status',
  ['RECEIVED', 'PROCESSED', 'CANCELLED'],
);

export const inventoryLocations = inventorySchema.table(
  'inventory_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: varchar('name', { length: 120 }).notNull(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    address: text('address'),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
);

export const stockBalances = inventorySchema.table(
  'stock_balances',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    locationId: uuid('location_id')
      .notNull()
      .references(() => inventoryLocations.id),

    // Referencia lógica a catalog.product_variants.id
    variantId: uuid('variant_id').notNull(),

    quantityOnHand: integer('quantity_on_hand')
      .notNull()
      .default(0),

    quantityReserved: integer('quantity_reserved')
      .notNull()
      .default(0),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_stock_balances_location_variant')
      .on(table.locationId, table.variantId),

    check(
      'chk_stock_balances_on_hand',
      sql`${table.quantityOnHand} >= 0`,
    ),

    check(
      'chk_stock_balances_reserved',
      sql`${table.quantityReserved} >= 0`,
    ),

    check(
      'chk_stock_balances_available',
      sql`${table.quantityReserved} <= ${table.quantityOnHand}`,
    ),

    index('idx_stock_balances_variant').on(table.variantId),
  ],
);

export const stockReservations = inventorySchema.table(
  'stock_reservations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    orderId: uuid('order_id').notNull(),

    locationId: uuid('location_id')
      .notNull()
      .references(() => inventoryLocations.id),

    status: reservationStatusEnum('status')
      .notNull()
      .default('ACTIVE'),

    idempotencyKey: varchar('idempotency_key', {
      length: 180,
    }).notNull().unique(),

    reservedAt: timestamp('reserved_at', {
      withTimezone: true,
    }),

    releasedAt: timestamp('released_at', {
      withTimezone: true,
    }),

    dispatchedAt: timestamp('dispatched_at', {
      withTimezone: true,
    }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_stock_reservations_active_order')
      .on(table.orderId)
      .where(sql`${table.status} = 'ACTIVE'`),

    index('idx_stock_reservations_order')
      .on(table.orderId),
  ],
);

export const stockReservationItems = inventorySchema.table(
  'stock_reservation_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => stockReservations.id),

    variantId: uuid('variant_id').notNull(),

    quantity: integer('quantity').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_reservation_items_variant')
      .on(table.reservationId, table.variantId),

    check(
      'chk_reservation_items_quantity',
      sql`${table.quantity} > 0`,
    ),
  ],
);
Las definiciones TypeScript deben completarse con stockReturns, stockReturnItems y stockMovements siguiendo las mismas columnas, ENUM, referencias internas y restricciones del SQL anterior.
El SQL versionado es la fuente de verdad de la migración inicial. Después de incorporarlo, se debe mantener sincronizado con el esquema TypeScript y validar los cambios con Drizzle Kit.
6. Reglas transaccionales de los repositorios
Las siguientes operaciones deben ejecutarse dentro de una única transacción PostgreSQL.
6.1 Reserva de varias variantes
Pseudoflujo:
await db.transaction(async (tx) => {
  // 1. Verificar idempotencia.
  // 2. Crear filas faltantes de stock_balances con cero.
  // 3. Bloquear las filas de todas las variantes.
  // 4. Validar disponibilidad de todas las variantes.
  // 5. Crear stock_reservations.
  // 6. Crear stock_reservation_items.
  // 7. Incrementar quantity_reserved.
  // 8. Registrar movimientos RESERVATION.
  // 9. Confirmar transacción.
});
Para evitar interbloqueos, bloquear las filas en orden determinista por variant_id.
La operación de bloqueo debe utilizar SELECT ... FOR UPDATE o una sentencia SQL equivalente dentro de la transacción.
Si una variante no tiene existencias suficientes, se debe ejecutar rollback completo.
6.2 Liberación
await db.transaction(async (tx) => {
  // 1. Buscar reserva por order_id.
  // 2. Bloquear reserva.
  // 3. Validar status ACTIVE.
  // 4. Bloquear balances relacionados.
  // 5. Decrementar quantity_reserved.
  // 6. Cambiar reserva a RELEASED.
  // 7. Registrar movimientos RELEASE.
  // 8. Confirmar transacción.
});
6.3 Despacho
await db.transaction(async (tx) => {
  // 1. Bloquear reserva.
  // 2. Validar status ACTIVE.
  // 3. Bloquear balances relacionados.
  // 4. Validar cantidades.
  // 5. Decrementar quantity_on_hand.
  // 6. Decrementar quantity_reserved.
  // 7. Cambiar reserva a DISPATCHED.
  // 8. Registrar movimientos OUT.
  // 9. Confirmar transacción.
});
6.4 Devolución
await db.transaction(async (tx) => {
  // 1. Buscar devolución por idempotency_key.
  // 2. Bloquear devolución.
  // 3. Validar status RECEIVED.
  // 4. Bloquear balances correspondientes.
  // 5. Sumar quantity_restockable a quantity_on_hand.
  // 6. Registrar movimientos IN.
  // 7. Marcar devolución PROCESSED.
  // 8. Confirmar transacción.
});
Las operaciones deben generar resultados consistentes incluso si el cliente HTTP repite la solicitud.
7. Estrategia de idempotencia
Cada operación crítica tendrá una clave estable:
Operación	Clave sugerida
Reservar	reserve:{orderId}:{attempt}
Liberar	release:{reservationId}
Despachar	dispatch:{reservationId}
Devolver	return:{returnId}
Entrada manual	stock-entry:{operationId}
Ajuste manual	stock-adjustment:{operationId}
La clave no debe cambiar cuando se reintenta una solicitud por timeout.
Una solicitud repetida con la misma clave y el mismo contenido devuelve el resultado original.
Una solicitud con la misma clave y contenido diferente debe rechazarse como conflicto.
Para conseguirlo, conviene almacenar también un hash del contenido de la solicitud, por ejemplo request_hash, en las entidades de operación. Su incorporación a las tablas de reservas, devoluciones y operaciones manuales queda recomendada antes de producción.
8. Criterios de aceptación
    • El esquema inventory puede crearse independientemente.
    • Todos los ENUM están definidos.
    • Las tablas tienen PK y restricciones.
    • No se permiten cantidades negativas.
    • No se permiten reservas superiores a las existencias físicas.
    • Solo existe una reserva activa por pedido.
    • Se pueden conservar reservas históricas.
    • Una reserva puede contener múltiples variantes.
    • Los movimientos no se eliminan ni modifican.
    • Las devoluciones distinguen unidades aptas y dañadas.
    • Las operaciones críticas son atómicas.
    • Las operaciones críticas son idempotentes.
    • Las operaciones concurrentes no generan sobreventa.
    • Drizzle puede consultar todas las entidades.
    • Las migraciones son reproducibles desde una base de datos limpia.
Resultado: persistencia inicial de Inventory definida para comenzar la implementación del servicio.
