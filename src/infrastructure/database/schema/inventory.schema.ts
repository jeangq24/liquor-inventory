import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	index,
	integer,
	pgSchema,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const inventorySchema = pgSchema('inventory');

export const reservationStatusEnum = inventorySchema.enum(
	'reservation_status',
	['ACTIVE', 'RELEASED', 'DISPATCHED'],
);

export const movementTypeEnum = inventorySchema.enum('movement_type', [
	'IN',
	'OUT',
	'ADJUSTMENT_IN',
	'ADJUSTMENT_OUT',
	'RESERVATION',
	'RELEASE',
]);

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
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
);

export const stockBalances = inventorySchema.table(
	'stock_balances',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		locationId: uuid('location_id')
			.notNull()
			.references(() => inventoryLocations.id),
		variantId: uuid('variant_id').notNull(),
		quantityOnHand: integer('quantity_on_hand').notNull().default(0),
		quantityReserved: integer('quantity_reserved').notNull().default(0),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex('uq_stock_balances_location_variant').on(
			table.locationId,
			table.variantId,
		),
		check('chk_stock_balances_on_hand', sql`${table.quantityOnHand} >= 0`),
		check('chk_stock_balances_reserved', sql`${table.quantityReserved} >= 0`),
		check(
			'chk_stock_balances_available',
			sql`${table.quantityReserved} <= ${table.quantityOnHand}`,
		),
		index('idx_stock_balances_variant').on(table.variantId),
		index('idx_stock_balances_location').on(table.locationId),
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
		status: reservationStatusEnum('status').notNull().default('ACTIVE'),
		idempotencyKey: varchar('idempotency_key', { length: 180 })
			.notNull()
			.unique(),
		reservedAt: timestamp('reserved_at', { withTimezone: true }),
		releasedAt: timestamp('released_at', { withTimezone: true }),
		dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			'chk_stock_reservations_timestamps',
			sql`(${table.status} <> 'RELEASED' OR ${table.releasedAt} IS NOT NULL) AND (${table.status} <> 'DISPATCHED' OR ${table.dispatchedAt} IS NOT NULL)`,
		),
		uniqueIndex('uq_stock_reservations_active_order')
			.on(table.orderId)
			.where(sql`${table.status} = 'ACTIVE'`),
		index('idx_stock_reservations_order').on(table.orderId),
		index('idx_stock_reservations_location').on(table.locationId),
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
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex('uq_reservation_items_variant').on(
			table.reservationId,
			table.variantId,
		),
		check('chk_reservation_items_quantity', sql`${table.quantity} > 0`),
		index('idx_reservation_items_variant').on(table.variantId),
	],
);

export const stockReturns = inventorySchema.table(
	'stock_returns',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		orderId: uuid('order_id').notNull(),
		locationId: uuid('location_id')
			.notNull()
			.references(() => inventoryLocations.id),
		deliveryAttemptId: uuid('delivery_attempt_id'),
		idempotencyKey: varchar('idempotency_key', { length: 180 })
			.notNull()
			.unique(),
		reason: varchar('reason', { length: 180 }).notNull(),
		status: stockReturnStatusEnum('status').notNull().default('RECEIVED'),
		receivedBy: uuid('received_by'),
		receivedAt: timestamp('received_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		processedAt: timestamp('processed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			'chk_stock_returns_processed',
			sql`${table.status} <> 'PROCESSED' OR ${table.processedAt} IS NOT NULL`,
		),
		index('idx_stock_returns_order').on(table.orderId),
		index('idx_stock_returns_location').on(table.locationId),
		index('idx_stock_returns_delivery_attempt').on(table.deliveryAttemptId),
	],
);

export const stockReturnItems = inventorySchema.table(
	'stock_return_items',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		stockReturnId: uuid('stock_return_id')
			.notNull()
			.references(() => stockReturns.id),
		variantId: uuid('variant_id').notNull(),
		quantityReceived: integer('quantity_received').notNull(),
		quantityRestockable: integer('quantity_restockable').notNull().default(0),
		reason: varchar('reason', { length: 180 }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex('uq_stock_return_items_variant').on(
			table.stockReturnId,
			table.variantId,
		),
		check(
			'chk_stock_return_items_received',
			sql`${table.quantityReceived} > 0`,
		),
		check(
			'chk_stock_return_items_restockable',
			sql`${table.quantityRestockable} >= 0 AND ${table.quantityRestockable} <= ${table.quantityReceived}`,
		),
		index('idx_stock_return_items_variant').on(table.variantId),
	],
);

export const stockMovements = inventorySchema.table(
	'stock_movements',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		locationId: uuid('location_id')
			.notNull()
			.references(() => inventoryLocations.id),
		variantId: uuid('variant_id').notNull(),
		reservationId: uuid('reservation_id').references(
			() => stockReservations.id,
		),
		stockReturnId: uuid('stock_return_id').references(() => stockReturns.id),
		orderId: uuid('order_id'),
		movementType: movementTypeEnum('movement_type').notNull(),
		quantity: integer('quantity').notNull(),
		reason: varchar('reason', { length: 180 }).notNull(),
		idempotencyKey: varchar('idempotency_key', { length: 180 })
			.notNull()
			.unique(),
		performedBy: uuid('performed_by'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check('chk_stock_movements_quantity', sql`${table.quantity} > 0`),
		index('idx_stock_movements_variant_date').on(
			table.variantId,
			table.createdAt.desc(),
		),
		index('idx_stock_movements_order').on(table.orderId),
		index('idx_stock_movements_location_date').on(
			table.locationId,
			table.createdAt.desc(),
		),
		index('idx_stock_movements_reservation').on(table.reservationId),
		index('idx_stock_movements_return').on(table.stockReturnId),
	],
);