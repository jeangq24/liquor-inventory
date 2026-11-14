import { createHash } from 'node:crypto';
import type { DatabaseTransaction } from '../../infrastructure/database/database.types.js';
import { StockBalanceRepository } from '../stock-balance/stock-balance.repository.js';
import { StockMovementRepository } from './stock-movement.repository.js';
import { StockMovementService } from './stock-movement.service.js';

describe('StockMovementService', () => {
	const createHarness = () => {
		const tx = {} as DatabaseTransaction;
		const movementRepository = {
			transaction: vi.fn(
				(work: (transaction: DatabaseTransaction) => Promise<unknown>) =>
					work(tx),
			),
			lockIdempotencyKey: vi.fn().mockResolvedValue(undefined),
			getByIdempotencyPrefix: vi.fn().mockResolvedValue([]),
			createMany: vi.fn(),
		};
		const balanceRepository = {
			ensureAndLock: vi.fn(),
			adjustOnHand: vi.fn(),
		};
		const service = new StockMovementService(
			movementRepository as unknown as StockMovementRepository,
			balanceRepository as unknown as StockBalanceRepository,
		);

		return { service, movementRepository, balanceRepository, tx };
	};

	it('registers an entry and increments the physical balance atomically', async () => {
		const harness = createHarness();
		const movement = { id: 'movement-1', movementType: 'IN' };
		harness.balanceRepository.ensureAndLock.mockResolvedValue([
			{ variantId: 'variant-1', quantityOnHand: 0, quantityReserved: 0 },
		]);
		harness.movementRepository.createMany.mockResolvedValue([movement]);

		await expect(
			harness.service.registerEntry({
				locationId: 'location-1',
				idempotencyKey: 'entry-1',
				reason: 'INITIAL_STOCK',
				performedBy: 'operator-1',
				items: [{ variantId: 'variant-1', quantity: 5 }],
			}),
		).resolves.toEqual([movement]);
		expect(harness.balanceRepository.adjustOnHand).toHaveBeenCalledWith(
			'location-1',
			'variant-1',
			5,
			harness.tx,
		);
		expect(harness.movementRepository.createMany).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ movementType: 'IN', quantity: 5 }),
			]),
			harness.tx,
		);
	});

	it('rejects an adjustment out that would consume reserved stock', async () => {
		const harness = createHarness();
		harness.balanceRepository.ensureAndLock.mockResolvedValue([
			{ variantId: 'variant-1', quantityOnHand: 5, quantityReserved: 4 },
		]);

		await expect(
			harness.service.registerAdjustment({
				locationId: 'location-1',
				idempotencyKey: 'adjustment-1',
				reason: 'DAMAGED',
				performedBy: 'operator-1',
				direction: 'OUT',
				items: [{ variantId: 'variant-1', quantity: 2 }],
			}),
		).rejects.toThrow('consume reserved or unavailable stock');
		expect(harness.balanceRepository.adjustOnHand).not.toHaveBeenCalled();
		expect(harness.movementRepository.createMany).not.toHaveBeenCalled();
	});

	it('returns the original movements for an identical idempotent retry', async () => {
		const harness = createHarness();
		const idempotencyPrefix = `stock-change:${createHash('sha256').update('entry-1').digest('hex')}:`;
		const existing = [
			{
				id: 'movement-1',
				locationId: 'location-1',
				variantId: 'variant-1',
				movementType: 'IN',
				quantity: 5,
				reason: 'INITIAL_STOCK',
				performedBy: 'operator-1',
				idempotencyKey: `${idempotencyPrefix}variant-1`,
			},
		];
		harness.movementRepository.getByIdempotencyPrefix.mockResolvedValue(
			existing,
		);

		const result = await harness.service.registerEntry({
			locationId: 'location-1',
			idempotencyKey: 'entry-1',
			reason: 'INITIAL_STOCK',
			performedBy: 'operator-1',
			items: [{ variantId: 'variant-1', quantity: 5 }],
		});

		expect(result).toBe(existing);
		expect(harness.balanceRepository.ensureAndLock).not.toHaveBeenCalled();
		expect(harness.movementRepository.createMany).not.toHaveBeenCalled();
	});

	it('rejects reusing a movement key with a different payload', async () => {
		const harness = createHarness();
		harness.movementRepository.getByIdempotencyPrefix.mockResolvedValue([
			{
				id: 'movement-1',
				locationId: 'location-1',
				variantId: 'variant-1',
				movementType: 'IN',
				quantity: 5,
				reason: 'INITIAL_STOCK',
				performedBy: 'operator-1',
				idempotencyKey: 'some-key',
			},
		]);

		await expect(
			harness.service.registerEntry({
				locationId: 'location-1',
				idempotencyKey: 'entry-1',
				reason: 'OTHER_REASON',
				performedBy: 'operator-1',
				items: [{ variantId: 'variant-1', quantity: 5 }],
			}),
		).rejects.toThrow('different stock change data');
	});
});