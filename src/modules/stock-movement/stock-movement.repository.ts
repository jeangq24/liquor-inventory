import { InjectDrizzle } from '@nestjs/drizzle';
import { Injectable } from '@nestjs/common';
import {
	and,
	desc,
	eq,
	gte,
	like,
	lte,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
	movementTypeEnum,
	stockMovements,
} from '../../infrastructure/database/schema/inventory.schema.js';
import type { DatabaseTransaction } from '../../infrastructure/database/database.types.js';

export type NewStockMovement = typeof stockMovements.$inferInsert;
export type StockMovementType = (typeof movementTypeEnum.enumValues)[number];

export interface StockMovementFilters {
	locationId?: string;
	variantId?: string;
	orderId?: string;
	reservationId?: string;
	stockReturnId?: string;
	performedBy?: string;
	movementType?: StockMovementType;
	createdFrom?: Date;
	createdTo?: Date;
	limit?: number;
	offset?: number;
}

@Injectable()
export class StockMovementRepository {
	constructor(
		@InjectDrizzle()
		private readonly db: NodePgDatabase,
	) {}

	createMany(movements: NewStockMovement[], tx: DatabaseTransaction) {
		if (movements.length === 0) {
			return Promise.resolve([]);
		}

		return tx.insert(stockMovements).values(movements).returning();
	}

	getByIdempotencyPrefix(prefix: string, tx: DatabaseTransaction) {
		return tx
			.select()
			.from(stockMovements)
			.where(like(stockMovements.idempotencyKey, `${prefix}%`));
	}

	async getByIdempotencyKey(idempotencyKey: string) {
		const [movement] = await this.db
			.select()
			.from(stockMovements)
			.where(eq(stockMovements.idempotencyKey, idempotencyKey))
			.limit(1);

		return movement;
	}

	async getById(id: string) {
		const [movement] = await this.db
			.select()
			.from(stockMovements)
			.where(eq(stockMovements.id, id))
			.limit(1);

		return movement;
	}

	getHistory(filters: StockMovementFilters = {}) {
		const conditions = [
			filters.locationId
				? eq(stockMovements.locationId, filters.locationId)
				: undefined,
			filters.variantId
				? eq(stockMovements.variantId, filters.variantId)
				: undefined,
			filters.orderId
				? eq(stockMovements.orderId, filters.orderId)
				: undefined,
			filters.reservationId
				? eq(stockMovements.reservationId, filters.reservationId)
				: undefined,
			filters.stockReturnId
				? eq(stockMovements.stockReturnId, filters.stockReturnId)
				: undefined,
			filters.performedBy
				? eq(stockMovements.performedBy, filters.performedBy)
				: undefined,
			filters.movementType
				? eq(stockMovements.movementType, filters.movementType)
				: undefined,
			filters.createdFrom
				? gte(stockMovements.createdAt, filters.createdFrom)
				: undefined,
			filters.createdTo
				? lte(stockMovements.createdAt, filters.createdTo)
				: undefined,
		].filter((condition) => condition !== undefined);

		const limit = Math.min(Math.max(Math.floor(filters.limit ?? 50), 1), 100);
		const offset = Math.max(Math.floor(filters.offset ?? 0), 0);

		return this.db
			.select()
			.from(stockMovements)
			.where(and(...conditions))
			.orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
			.limit(limit)
			.offset(offset);
	}
}