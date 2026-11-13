import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ConflictException } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import {
	inventoryLocations,
	stockBalances,
	stockMovements,
	stockReservationItems,
	stockReservations,
} from '../../infrastructure/database/schema/inventory.schema.js';
import { StockBalanceRepository } from '../stock-balance/stock-balance.repository.js';
import { StockMovementRepository } from '../stock-movement/stock-movement.repository.js';
import { StockReservationRepository } from './stock-reservation.repository.js';
import { StockReservationService } from './stock-reservation.service.js';

const testDatabaseUrl = process.env.POSTGRES_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('StockReservation PostgreSQL concurrency', () => {
	let pool: Pool | undefined;
	let db: ReturnType<typeof drizzle> | undefined;
	let service: StockReservationService;
	let locationIds: string[] = [];
	let orderIds: string[] = [];

	const database = () => {
		if (!db) {
			throw new Error('POSTGRES_TEST_DATABASE_URL is not configured');
		}
		return db;
	};

	beforeAll(async () => {
		if (!testDatabaseUrl) {
			return;
		}

		pool = new Pool({ connectionString: testDatabaseUrl });
		db = drizzle(pool);
		await migrate(db, { migrationsFolder: './drizzle' });

		for (const migrationFile of [
			'0000_create_inventory_schema.sql',
			'0001_create_inventory_tables.sql',
		]) {
			const migrationSql = await readFile(`./drizzle/${migrationFile}`, 'utf8');
			await pool.query(migrationSql);
			await pool.query(migrationSql);
		}

		service = new StockReservationService(
			new StockReservationRepository(db),
			new StockBalanceRepository(db),
			new StockMovementRepository(db),
		);
	});

	afterEach(async () => {
		const connection = database();

		if (orderIds.length > 0) {
			const reservations = await connection
				.select({ id: stockReservations.id })
				.from(stockReservations)
				.where(inArray(stockReservations.orderId, orderIds));
			const reservationIds = reservations.map(({ id }) => id);

			await connection
				.delete(stockMovements)
				.where(inArray(stockMovements.orderId, orderIds));
			if (reservationIds.length > 0) {
				await connection
					.delete(stockReservationItems)
					.where(inArray(stockReservationItems.reservationId, reservationIds));
			}
			await connection
				.delete(stockReservations)
				.where(inArray(stockReservations.orderId, orderIds));
		}

		if (locationIds.length > 0) {
			await connection
				.delete(stockBalances)
				.where(inArray(stockBalances.locationId, locationIds));
			await connection
				.delete(inventoryLocations)
				.where(inArray(inventoryLocations.id, locationIds));
		}

		locationIds = [];
		orderIds = [];
	});

	afterAll(async () => {
		await pool?.end();
	});

	it('returns one reservation for concurrent retries with the same key', async () => {
		const stock = await createStock(1);
		const orderId = randomUUID();
		orderIds.push(orderId);
		const input = {
			orderId,
			locationId: stock.locationId,
			idempotencyKey: `reserve:${randomUUID()}`,
			items: [{ variantId: stock.variantId, quantity: 1 }],
		};

		const results = await Promise.all([
			service.reserve(input),
			service.reserve(input),
		]);

		expect(results[0]?.reservation.id).toBe(results[1]?.reservation.id);
		const [balance] = await database()
			.select()
			.from(stockBalances)
			.where(
				and(
					eq(stockBalances.locationId, stock.locationId),
					eq(stockBalances.variantId, stock.variantId),
				),
			);
		const movements = await database()
			.select()
			.from(stockMovements)
			.where(eq(stockMovements.orderId, orderId));

		expect(balance?.quantityReserved).toBe(1);
		expect(movements).toHaveLength(1);
	});

	it('prevents overselling when different orders reserve the last unit concurrently', async () => {
		const stock = await createStock(1);
		const firstOrderId = randomUUID();
		const secondOrderId = randomUUID();
		orderIds.push(firstOrderId, secondOrderId);

		const results = await Promise.allSettled([
			service.reserve({
				orderId: firstOrderId,
				locationId: stock.locationId,
				idempotencyKey: `reserve:${randomUUID()}`,
				items: [{ variantId: stock.variantId, quantity: 1 }],
			}),
			service.reserve({
				orderId: secondOrderId,
				locationId: stock.locationId,
				idempotencyKey: `reserve:${randomUUID()}`,
				items: [{ variantId: stock.variantId, quantity: 1 }],
			}),
		]);

		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		const rejected = results.find((result) => result.status === 'rejected');
		expect(rejected?.status).toBe('rejected');	
		if (rejected?.status === 'rejected') {
			expect(rejected.reason).toBeInstanceOf(ConflictException);
		}

		const [balance] = await database()
			.select()
			.from(stockBalances)
			.where(
				and(
					eq(stockBalances.locationId, stock.locationId),
					eq(stockBalances.variantId, stock.variantId),
				),
			);
		expect(balance?.quantityReserved).toBe(1);
	});

	it('applies a concurrent release retry only once', async () => {
		const stock = await createStock(1);
		const orderId = randomUUID();
		orderIds.push(orderId);
		const reservation = await service.reserve({
			orderId,
			locationId: stock.locationId,
			idempotencyKey: `reserve:${randomUUID()}`,
			items: [{ variantId: stock.variantId, quantity: 1 }],
		});
		const releaseInput = {
			idempotencyKey: `release:${randomUUID()}`,
			reason: 'ORDER_CANCELLED',
		};

		const results = await Promise.all([
			service.release(orderId, releaseInput),
			service.release(orderId, releaseInput),
		]);

		expect(results[0]?.reservation.id).toBe(reservation.reservation.id);
		expect(results[1]?.reservation.id).toBe(reservation.reservation.id);
		const movements = await database()
			.select()
			.from(stockMovements)
			.where(
				and(
					eq(stockMovements.orderId, orderId),
					eq(stockMovements.movementType, 'RELEASE'),
				),
			);
		const [balance] = await database()
			.select()
			.from(stockBalances)
			.where(eq(stockBalances.locationId, stock.locationId));

		expect(movements).toHaveLength(1);
		expect(balance?.quantityReserved).toBe(0);
	});

	it('applies a concurrent dispatch retry only once', async () => {
		const stock = await createStock(1);
		const orderId = randomUUID();
		orderIds.push(orderId);
		const reservation = await service.reserve({
			orderId,
			locationId: stock.locationId,
			idempotencyKey: `reserve:${randomUUID()}`,
			items: [{ variantId: stock.variantId, quantity: 1 }],
		});
		const dispatchInput = {
			idempotencyKey: `dispatch:${randomUUID()}`,
			performedBy: randomUUID(),
		};

		const results = await Promise.all([
			service.dispatch(orderId, dispatchInput),
			service.dispatch(orderId, dispatchInput),
		]);

		expect(results[0]?.reservation.id).toBe(reservation.reservation.id);
		expect(results[1]?.reservation.id).toBe(reservation.reservation.id);
		const movements = await database()
			.select()
			.from(stockMovements)
			.where(
				and(
					eq(stockMovements.orderId, orderId),
					eq(stockMovements.movementType, 'OUT'),
				),
			);
		const [balance] = await database()
			.select()
			.from(stockBalances)
			.where(eq(stockBalances.locationId, stock.locationId));

		expect(movements).toHaveLength(1);
		expect(balance?.quantityOnHand).toBe(0);
		expect(balance?.quantityReserved).toBe(0);
	});

	async function createStock(quantityOnHand: number) {
		const [location] = await database()
			.insert(inventoryLocations)
			.values({
				name: 'Concurrency test location',
				code: `test-${randomUUID()}`,
			})
			.returning();
		if (!location) {
			throw new Error('Could not create test inventory location');
		}
		locationIds.push(location.id);

		const variantId = randomUUID();
		await database().insert(stockBalances).values({
			locationId: location.id,
			variantId,
			quantityOnHand,
			quantityReserved: 0,
		});

		return { locationId: location.id, variantId };
	}
});