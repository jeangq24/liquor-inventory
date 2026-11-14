import type { DatabaseTransaction } from '../../infrastructure/database/database.types.js';
import { StockBalanceRepository } from '../stock-balance/stock-balance.repository.js';
import { StockMovementRepository } from '../stock-movement/stock-movement.repository.js';
import { StockReturnRepository } from './stock-return.repository.js';
import { StockReturnService } from './stock-return.service.js';

describe('StockReturnService', () => {
	const createHarness = () => {
		const tx = {} as DatabaseTransaction;
		const returnRepository = {
			transaction: vi.fn(
				(work: (transaction: DatabaseTransaction) => Promise<unknown>) =>
					work(tx),
			),
			lockIdempotencyKey: vi.fn().mockResolvedValue(undefined),
			getByIdempotencyKey: vi.fn().mockResolvedValue(undefined),
			getItems: vi.fn(),
			create: vi.fn(),
			createItems: vi.fn(),
			markProcessed: vi.fn(),
			getByOrder: vi.fn(),
		};
		const balanceRepository = {
			ensureAndLock: vi.fn(),
			adjustOnHand: vi.fn(),
		};
		const movementRepository = { createMany: vi.fn() };
		const service = new StockReturnService(
			returnRepository as unknown as StockReturnRepository,
			balanceRepository as unknown as StockBalanceRepository,
			movementRepository as unknown as StockMovementRepository,
		);

		return { service, returnRepository, balanceRepository, movementRepository, tx };
	};

	it('restocks only verified sellable quantities and records an IN movement', async () => {
		const harness = createHarness();
		const stockReturn = {
			id: 'return-1',
			orderId: 'order-1',
			locationId: 'location-1',
			idempotencyKey: 'return-1',
			reason: 'DELIVERY_FAILED',
			receivedBy: 'operator-1',
			status: 'RECEIVED',
			deliveryAttemptId: null,
		};
		const items = [
			{
				id: 'return-item-1',
				stockReturnId: stockReturn.id,
				variantId: 'variant-1',
				quantityReceived: 2,
				quantityRestockable: 1,
				reason: null,
			},
		];
		const processedReturn = { ...stockReturn, status: 'PROCESSED' };
		harness.returnRepository.create.mockResolvedValue(stockReturn);
		harness.returnRepository.createItems.mockResolvedValue(items);
		harness.returnRepository.markProcessed.mockResolvedValue(processedReturn);
		harness.balanceRepository.ensureAndLock.mockResolvedValue([
			{ variantId: 'variant-1', quantityOnHand: 3, quantityReserved: 0 },
		]);

		await expect(
			harness.service.registerReturn({
				orderId: 'order-1',
				locationId: 'location-1',
				idempotencyKey: 'return-1',
				reason: 'DELIVERY_FAILED',
				receivedBy: 'operator-1',
				items: [
					{
						variantId: 'variant-1',
						quantityReceived: 2,
						quantityRestockable: 1,
					},
				],
			}),
		).resolves.toEqual({ stockReturn: processedReturn, items });
		expect(harness.balanceRepository.adjustOnHand).toHaveBeenCalledWith(
			'location-1',
			'variant-1',
			1,
			harness.tx,
		);
		expect(harness.movementRepository.createMany).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ movementType: 'IN', quantity: 1 }),
			]),
			harness.tx,
		);
	});

	it('records damaged items without changing the balance or creating a movement', async () => {
		const harness = createHarness();
		const stockReturn = {
			id: 'return-1',
			orderId: 'order-1',
			locationId: 'location-1',
			idempotencyKey: 'return-1',
			reason: 'DAMAGED',
			receivedBy: 'operator-1',
			status: 'RECEIVED',
			deliveryAttemptId: null,
		};
		const items = [
			{
				id: 'return-item-1',
				stockReturnId: stockReturn.id,
				variantId: 'variant-1',
				quantityReceived: 1,
				quantityRestockable: 0,
				reason: 'BROKEN',
			},
		];
		const processedReturn = { ...stockReturn, status: 'PROCESSED' };
		harness.returnRepository.create.mockResolvedValue(stockReturn);
		harness.returnRepository.createItems.mockResolvedValue(items);
		harness.returnRepository.markProcessed.mockResolvedValue(processedReturn);

		await harness.service.registerReturn({
			orderId: 'order-1',
			locationId: 'location-1',
			idempotencyKey: 'return-1',
			reason: 'DAMAGED',
			receivedBy: 'operator-1',
			items: [
				{
					variantId: 'variant-1',
					quantityReceived: 1,
					quantityRestockable: 0,
					reason: 'BROKEN',
				},
			],
		});

		expect(harness.balanceRepository.ensureAndLock).not.toHaveBeenCalled();
		expect(harness.balanceRepository.adjustOnHand).not.toHaveBeenCalled();
		expect(harness.movementRepository.createMany).not.toHaveBeenCalled();
		expect(harness.returnRepository.markProcessed).toHaveBeenCalledWith(
			stockReturn.id,
			harness.tx,
		);
	});

	it('returns the original processed return for an identical retry', async () => {
		const harness = createHarness();
		const processedReturn = {
			id: 'return-1',
			orderId: 'order-1',
			locationId: 'location-1',
			idempotencyKey: 'return-1',
			reason: 'DELIVERY_FAILED',
			receivedBy: 'operator-1',
			status: 'PROCESSED',
			deliveryAttemptId: null,
		};
		const items = [
			{
				id: 'return-item-1',
				stockReturnId: processedReturn.id,
				variantId: 'variant-1',
				quantityReceived: 2,
				quantityRestockable: 1,
				reason: null,
			},
		];
		harness.returnRepository.getByIdempotencyKey.mockResolvedValue(
			processedReturn,
		);
		harness.returnRepository.getItems.mockResolvedValue(items);

		await expect(
			harness.service.registerReturn({
				orderId: 'order-1',
				locationId: 'location-1',
				idempotencyKey: 'return-1',
				reason: 'DELIVERY_FAILED',
				receivedBy: 'operator-1',
				items: [
					{
						variantId: 'variant-1',
						quantityReceived: 2,
						quantityRestockable: 1,
					},
				],
			}),
		).resolves.toEqual({ stockReturn: processedReturn, items });
		expect(harness.balanceRepository.ensureAndLock).not.toHaveBeenCalled();
		expect(harness.movementRepository.createMany).not.toHaveBeenCalled();
	});

	it('rejects reusing a return key with different quantities', async () => {
		const harness = createHarness();
		const processedReturn = {
			id: 'return-1',
			orderId: 'order-1',
			locationId: 'location-1',
			idempotencyKey: 'return-1',
			reason: 'DELIVERY_FAILED',
			receivedBy: 'operator-1',
			status: 'PROCESSED',
			deliveryAttemptId: null,
		};
		harness.returnRepository.getByIdempotencyKey.mockResolvedValue(
			processedReturn,
		);
		harness.returnRepository.getItems.mockResolvedValue([
			{
				id: 'return-item-1',
				stockReturnId: processedReturn.id,
				variantId: 'variant-1',
				quantityReceived: 1,
				quantityRestockable: 1,
				reason: null,
			},
		]);

		await expect(
			harness.service.registerReturn({
				orderId: 'order-1',
				locationId: 'location-1',
				idempotencyKey: 'return-1',
				reason: 'DELIVERY_FAILED',
				receivedBy: 'operator-1',
				items: [
					{
						variantId: 'variant-1',
						quantityReceived: 2,
						quantityRestockable: 2,
					},
				],
			}),
		).rejects.toThrow('different return data');
	});
});