import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { DatabaseTransaction } from '../../infrastructure/database/database.types.js';
import { StockMovementRepository } from './stock-movement.repository.js';

describe('StockMovementRepository', () => {
	const createQuery = () => {
		const query = {
			from: vi.fn(),
			where: vi.fn(),
			orderBy: vi.fn(),
			limit: vi.fn(),
			offset: vi.fn(),
	};

		query.from.mockReturnValue(query);
		query.where.mockReturnValue(query);
		query.orderBy.mockReturnValue(query);
		query.limit.mockReturnValue(query);

		return query;
	};

	it('filters movement history and clamps pagination', () => {
		const query = createQuery();
		const db = { select: vi.fn().mockReturnValue(query) };
		const repository = new StockMovementRepository(db as never);

		repository.getHistory({
			locationId: 'location-1',
			variantId: 'variant-1',
			movementType: 'OUT',
			createdFrom: new Date('2026-01-01T00:00:00.000Z'),
			createdTo: new Date('2026-01-31T23:59:59.999Z'),
			limit: 500,
			offset: -10,
		});

		const whereCondition = query.where.mock.calls[0][0] as SQL;
		const whereSql = new PgDialect().sqlToQuery(whereCondition).sql;
		expect(whereSql).toContain('"location_id" = $1');
		expect(whereSql).toContain('"variant_id" = $2');
		expect(whereSql).toContain('"movement_type" = $3');
		expect(whereSql).toContain('"created_at" >= $4');
		expect(whereSql).toContain('"created_at" <= $5');
		expect(query.orderBy).toHaveBeenCalledOnce();
		expect(query.limit).toHaveBeenCalledWith(100);
		expect(query.offset).toHaveBeenCalledWith(0);
	});

	it('does not execute an insert for an empty movement list', async () => {
		const tx = { insert: vi.fn() };
		const repository = new StockMovementRepository({} as never);

		await expect(
			repository.createMany([], tx as unknown as DatabaseTransaction),
		).resolves.toEqual([]);
		expect(tx.insert).not.toHaveBeenCalled();
	});

	it('inserts movements using the caller transaction', async () => {
		const movements = [{ id: 'movement-1' }];
		const returning = vi.fn().mockResolvedValue(movements);
		const values = vi.fn().mockReturnValue({ returning });
		const insert = vi.fn().mockReturnValue({ values });
		const tx = { insert };
		const repository = new StockMovementRepository({} as never);

		await expect(
			repository.createMany(
				[
					{
						locationId: 'location-1',
						variantId: 'variant-1',
						movementType: 'IN',
						quantity: 2,
						reason: 'RESTOCK',
						idempotencyKey: 'entry-1',
					},
				],
				tx as unknown as DatabaseTransaction,
			),
		).resolves.toBe(movements);
		expect(insert).toHaveBeenCalledOnce();
	});
});