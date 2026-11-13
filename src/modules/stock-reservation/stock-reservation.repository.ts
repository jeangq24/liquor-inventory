import { InjectDrizzle } from '@nestjs/drizzle';
import { Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
	reservationStatusEnum,
	stockReservationItems,
	stockReservations,
} from '../../infrastructure/database/schema/inventory.schema.js';
import type { DatabaseTransaction } from '../../infrastructure/database/database.types.js';

export type ReservationTransaction = DatabaseTransaction;

type ReservationExecutor = NodePgDatabase | ReservationTransaction;
type NewReservation = typeof stockReservations.$inferInsert;
type NewReservationItem = typeof stockReservationItems.$inferInsert;
type ReservationStatus = (typeof reservationStatusEnum.enumValues)[number];

@Injectable()
export class StockReservationRepository {
	constructor(
		@InjectDrizzle()
		private readonly db: NodePgDatabase,
	) {}

	transaction<T>(work: (tx: ReservationTransaction) => Promise<T>) {
		return this.db.transaction(work);
	}

	lockOrder(orderId: string, tx: ReservationTransaction) {
		return tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${orderId}, 0))`,
		);
	}

	getByOrder(orderId: string, tx?: ReservationTransaction) {
		return this.executor(tx)
			.select()
			.from(stockReservations)
			.where(eq(stockReservations.orderId, orderId))
			.orderBy(desc(stockReservations.createdAt));
	}

	async getByIdempotencyKey(
		idempotencyKey: string,
		tx?: ReservationTransaction,
	) {
		const [reservation] = await this.executor(tx)
			.select()
			.from(stockReservations)
			.where(eq(stockReservations.idempotencyKey, idempotencyKey))
			.limit(1);

		return reservation;
	}

	async getById(reservationId: string, tx?: ReservationTransaction) {
		const [reservation] = await this.executor(tx)
			.select()
			.from(stockReservations)
			.where(eq(stockReservations.id, reservationId))
			.limit(1);

		return reservation;
	}

	async getActiveByOrderForUpdate(
		orderId: string,
		tx: ReservationTransaction,
	) {
		const [reservation] = await tx
			.select()
			.from(stockReservations)
			.where(
				and(
					eq(stockReservations.orderId, orderId),
					eq(stockReservations.status, 'ACTIVE'),
				),
			)
			.for('update')
			.limit(1);

		return reservation;
	}

	getItems(reservationId: string, tx?: ReservationTransaction) {
		return this.executor(tx)
			.select()
			.from(stockReservationItems)
			.where(eq(stockReservationItems.reservationId, reservationId));
	}

	async createReservation(input: NewReservation, tx: ReservationTransaction) {
		const [reservation] = await tx
			.insert(stockReservations)
			.values(input)
			.returning();

		return reservation;
	}

	createItems(items: NewReservationItem[], tx: ReservationTransaction) {
		if (items.length === 0) {
			return Promise.resolve([]);
		}

		return tx.insert(stockReservationItems).values(items).returning();
	}

	updateStatus(
		reservationId: string,
		status: ReservationStatus,
		tx: ReservationTransaction,
	) {
		const updatedAt = new Date();

		return tx
			.update(stockReservations)
			.set({
				status,
				updatedAt,
				...(status === 'RELEASED' ? { releasedAt: updatedAt } : {}),
				...(status === 'DISPATCHED' ? { dispatchedAt: updatedAt } : {}),
			})
			.where(eq(stockReservations.id, reservationId))
			.returning();
	}

	private executor(tx?: ReservationTransaction): ReservationExecutor {
		return tx ?? this.db;
	}
}