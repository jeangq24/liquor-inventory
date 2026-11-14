import { StockBalanceRepository } from './stock-balance.repository.js';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

describe('StockBalanceRepository', () => {
	const createQuery = () => {
		const query = {
			from: vi.fn(),
			where: vi.fn(),
			limit: vi.fn(),
		};

		query.from.mockReturnValue(query);
		query.where.mockReturnValue(query);

		return query;
	};

	it('returns balances for a variant', async () => {
		const balances = [{ variantId: 'variant-1' }];
		const query = createQuery();
		query.where.mockResolvedValue(balances);
		const db = { select: vi.fn().mockReturnValue(query) };
		const repository = new StockBalanceRepository(db as never);

		await expect(repository.getByVariant('variant-1')).resolves.toBe(balances);
		expect(query.from).toHaveBeenCalledOnce();
	});

	it('returns a balance with calculated availability', async () => {
		const balance = { quantityAvailable: 4 };
		const query = createQuery();
		query.limit.mockResolvedValue([balance]);
		const db = { select: vi.fn().mockReturnValue(query) };
		const repository = new StockBalanceRepository(db as never);

		await expect(
			repository.getAvailable('variant-1', 'location-1'),
		).resolves.toBe(balance);
		expect(query.limit).toHaveBeenCalledWith(1);
		const whereCondition = query.where.mock.calls[0][0] as SQL;
		const whereSql = new PgDialect().sqlToQuery(whereCondition).sql;
		expect(whereSql).toContain('"variant_id" = $1');
		expect(whereSql).toContain('"location_id" = $2');
	});

	it('returns balances for a location', async () => {
		const balances = [{ locationId: 'location-1' }];
		const query = createQuery();
		query.where.mockResolvedValue(balances);
		const db = { select: vi.fn().mockReturnValue(query) };
		const repository = new StockBalanceRepository(db as never);

		await expect(repository.getByLocation('location-1')).resolves.toBe(
			balances,
		);
		expect(query.from).toHaveBeenCalledOnce();
	});
});