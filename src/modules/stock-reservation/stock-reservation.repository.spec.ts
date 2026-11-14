import { StockReservationRepository } from './stock-reservation.repository.js';

describe('StockReservationRepository', () => {
	const createQuery = () => {
		const query = {
			from: vi.fn(),
			where: vi.fn(),
			orderBy: vi.fn(),
			limit: vi.fn(),
			for: vi.fn(),
		};

		query.from.mockReturnValue(query);
		query.where.mockReturnValue(query);
		query.for.mockReturnValue(query);

		return query;
	};

	it('returns reservation history for an order', async () => {
		const reservations = [{ id: 'reservation-1' }];
		const query = createQuery();
		query.orderBy.mockResolvedValue(reservations);
		const db = { select: vi.fn().mockReturnValue(query) };
		const repository = new StockReservationRepository(db as never);

		await expect(repository.getByOrder('order-1')).resolves.toBe(
			reservations,
		);
		expect(query.orderBy).toHaveBeenCalledOnce();
	});

	it('locks the active reservation when queried inside a transaction', async () => {
		const reservation = { id: 'reservation-1' };
		const query = createQuery();
		query.limit.mockResolvedValue([reservation]);
		const tx = { select: vi.fn().mockReturnValue(query) };
		const repository = new StockReservationRepository({} as never);

		await expect(
			repository.getActiveByOrderForUpdate('order-1', tx as never),
		).resolves.toBe(reservation);
		expect(query.for).toHaveBeenCalledWith('update');
	});

	it('runs work through the database transaction', async () => {
		const tx = {};
		const db = {
			transaction: vi.fn((work) => work(tx)),
		};
		const repository = new StockReservationRepository(db as never);

		await expect(repository.transaction(async (receivedTx) => receivedTx)).resolves.toBe(
			tx,
		);
		expect(db.transaction).toHaveBeenCalledOnce();
	});

	it('sets the release timestamp when changing status to RELEASED', async () => {
		const updatedReservation = { id: 'reservation-1' };
		const returning = vi.fn().mockResolvedValue([updatedReservation]);
		const where = vi.fn().mockReturnValue({ returning });
		const set = vi.fn().mockReturnValue({ where });
		const db = { update: vi.fn().mockReturnValue({ set }) };
		const repository = new StockReservationRepository({} as never);

		await expect(
			repository.updateStatus('reservation-1', 'RELEASED', db as never),
		).resolves.toEqual([updatedReservation]);
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'RELEASED',
				releasedAt: expect.any(Date),
				updatedAt: expect.any(Date),
			}),
		);
	});
});