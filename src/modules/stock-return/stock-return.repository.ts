import { InjectDrizzle } from '@nestjs/drizzle';
import { Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
	stockReturnItems,
	stockReturns,
} from '../../infrastructure/database/schema/inventory.schema.js';
import type { DatabaseTransaction } from '../../infrastructure/database/database.types.js';

type NewStockReturn = typeof stockReturns.$inferInsert;
type NewStockReturnItem = typeof stockReturnItems.$inferInsert;

@Injectable()
export class StockReturnRepository {
	constructor(
		@InjectDrizzle()
		private readonly db: NodePgDatabase,
	) {}

	transaction<T>(work: (tx: DatabaseTransaction) => Promise<T>) {
		return this.db.transaction(work);
	}

	lockIdempotencyKey(idempotencyKey: string, tx: DatabaseTransaction) {
		return tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`stock-return:${idempotencyKey}`}, 0))`,
		);
	}

	async getByIdempotencyKey(
		idempotencyKey: string,
		tx: DatabaseTransaction,
	) {
		const [stockReturn] = await tx
			.select()
			.from(stockReturns)
			.where(eq(stockReturns.idempotencyKey, idempotencyKey))
			.limit(1);

		return stockReturn;
	}

	async getById(returnId: string, tx?: DatabaseTransaction) {
		const executor = tx ?? this.db;
		const [stockReturn] = await executor
			.select()
			.from(stockReturns)
			.where(eq(stockReturns.id, returnId))
			.limit(1);

		return stockReturn;
	}

	getByOrder(orderId: string) {
		return this.db
			.select()
			.from(stockReturns)
			.where(eq(stockReturns.orderId, orderId))
			.orderBy(desc(stockReturns.receivedAt));
	}

	getItems(returnId: string, tx?: DatabaseTransaction) {
		const executor = tx ?? this.db;
		return executor
			.select()
			.from(stockReturnItems)
			.where(eq(stockReturnItems.stockReturnId, returnId));
	}

	async create(input: NewStockReturn, tx: DatabaseTransaction) {
		const [stockReturn] = await tx
			.insert(stockReturns)
			.values(input)
			.returning();

		return stockReturn;
	}

	createItems(items: NewStockReturnItem[], tx: DatabaseTransaction) {
		if (items.length === 0) {
			return Promise.resolve([]);
		}

		return tx.insert(stockReturnItems).values(items).returning();
	}

	async markProcessed(returnId: string, tx: DatabaseTransaction) {
		const processedAt = new Date();
		const [stockReturn] = await tx
			.update(stockReturns)
			.set({ status: 'PROCESSED', processedAt })
			.where(eq(stockReturns.id, returnId))
			.returning();

		return stockReturn;
	}
}