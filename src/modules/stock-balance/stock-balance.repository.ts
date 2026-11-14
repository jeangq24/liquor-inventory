import { InjectDrizzle } from '@nestjs/drizzle';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { stockBalances } from '../../infrastructure/database/schema/inventory.schema.js';
import type { DatabaseTransaction } from '../../infrastructure/database/database.types.js';

@Injectable()
export class StockBalanceRepository {
	constructor(
		@InjectDrizzle()
		private readonly db: NodePgDatabase,
	) {}

	getByVariant(variantId: string) {
		return this.db
			.select()
			.from(stockBalances)
			.where(eq(stockBalances.variantId, variantId));
	}

	async getAvailable(variantId: string, locationId: string) {
		const [balance] = await this.db
			.select({
				id: stockBalances.id,
				locationId: stockBalances.locationId,
				variantId: stockBalances.variantId,
				quantityOnHand: stockBalances.quantityOnHand,
				quantityReserved: stockBalances.quantityReserved,
				quantityAvailable: sql<number>`${stockBalances.quantityOnHand} - ${stockBalances.quantityReserved}`,
				updatedAt: stockBalances.updatedAt,
			})
			.from(stockBalances)
			.where(
				and(
					eq(stockBalances.variantId, variantId),
					eq(stockBalances.locationId, locationId),
				),
			)
			.limit(1);

		return balance;
	}

	getByLocation(locationId: string) {
		return this.db
			.select()
			.from(stockBalances)
			.where(eq(stockBalances.locationId, locationId));
	}

	getAvailability(locationId: string, variantIds: string[]) {
		if (variantIds.length === 0) {
			return Promise.resolve([]);
		}

		return this.db
			.select({
				id: stockBalances.id,
				locationId: stockBalances.locationId,
				variantId: stockBalances.variantId,
				quantityOnHand: stockBalances.quantityOnHand,
				quantityReserved: stockBalances.quantityReserved,
				quantityAvailable: sql<number>`${stockBalances.quantityOnHand} - ${stockBalances.quantityReserved}`,
				updatedAt: stockBalances.updatedAt,
			})
			.from(stockBalances)
			.where(
				and(
					eq(stockBalances.locationId, locationId),
					inArray(stockBalances.variantId, variantIds),
				),
			);
	}

	async ensureAndLock(
		locationId: string,
		variantIds: string[],
		tx: DatabaseTransaction,
	) {
		const orderedVariantIds = [...new Set(variantIds)].sort();

		if (orderedVariantIds.length === 0) {
			return [];
		}

		await tx
			.insert(stockBalances)
			.values(
				orderedVariantIds.map((variantId) => ({
					locationId,
					variantId,
				})),
			)
			.onConflictDoNothing({
				target: [stockBalances.locationId, stockBalances.variantId],
			});

		return tx
			.select()
			.from(stockBalances)
			.where(
				and(
					eq(stockBalances.locationId, locationId),
					inArray(stockBalances.variantId, orderedVariantIds),
				),
			)
			.orderBy(asc(stockBalances.variantId))
			.for('update');
	}

	lockExisting(
		locationId: string,
		variantIds: string[],
		tx: DatabaseTransaction,
	) {
		if (variantIds.length === 0) {
			return Promise.resolve([]);
		}

		return tx
			.select()
			.from(stockBalances)
			.where(
				and(
					eq(stockBalances.locationId, locationId),
					inArray(stockBalances.variantId, variantIds),
				),
			)
			.orderBy(asc(stockBalances.variantId))
			.for('update');
	}

	adjustReserved(
		locationId: string,
		variantId: string,
		quantityDelta: number,
		tx: DatabaseTransaction,
	) {
		return tx
			.update(stockBalances)
			.set({
				quantityReserved: sql`${stockBalances.quantityReserved} + ${quantityDelta}`,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(stockBalances.locationId, locationId),
					eq(stockBalances.variantId, variantId),
				),
			)
			.returning();
	}

	adjustOnHand(
		locationId: string,
		variantId: string,
		quantityDelta: number,
		tx: DatabaseTransaction,
	) {
		return tx
			.update(stockBalances)
			.set({
				quantityOnHand: sql`${stockBalances.quantityOnHand} + ${quantityDelta}`,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(stockBalances.locationId, locationId),
					eq(stockBalances.variantId, variantId),
				),
			)
			.returning();
	}

	decrementForDispatch(
		locationId: string,
		variantId: string,
		quantity: number,
		tx: DatabaseTransaction,
	) {
		return tx
			.update(stockBalances)
			.set({
				quantityOnHand: sql`${stockBalances.quantityOnHand} - ${quantity}`,
				quantityReserved: sql`${stockBalances.quantityReserved} - ${quantity}`,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(stockBalances.locationId, locationId),
					eq(stockBalances.variantId, variantId),
				),
			)
			.returning();
	}
}