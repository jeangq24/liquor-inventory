import type { DatabaseTransaction } from '../../infrastructure/database/database.types.js';
import { StockBalanceRepository } from '../stock-balance/stock-balance.repository.js';
import { StockMovementRepository } from '../stock-movement/stock-movement.repository.js';
import { StockReservationRepository } from './stock-reservation.repository.js';
import { StockReservationService } from './stock-reservation.service.js';

describe('StockReservationService', () => {
	const createHarness = () => {
		const tx = {} as DatabaseTransaction;
		const reservationRepository = {
			transaction: vi.fn(
				(work: (transaction: DatabaseTransaction) => Promise<unknown>) =>
					work(tx),
			),
			lockOrder: vi.fn().mockResolvedValue(undefined),
			getByIdempotencyKey: vi.fn().mockResolvedValue(undefined),
			getActiveByOrderForUpdate: vi.fn(),
			getByOrder: vi.fn().mockResolvedValue([]),
			getById: vi.fn(),
			getItems: vi.fn(),
			createReservation: vi.fn(),
			createItems: vi.fn(),
			updateStatus: vi.fn(),
		};
		const balanceRepository = {
			ensureAndLock: vi.fn(),
			lockExisting: vi.fn(),
			adjustReserved: vi.fn(),
			decrementForDispatch: vi.fn(),
		};
		const movementRepository = {
			createMany: vi.fn(),
			getByIdempotencyPrefix: vi.fn().mockResolvedValue([]),
		};
		const service = new StockReservationService(
			reservationRepository as unknown as StockReservationRepository,
			balanceRepository as unknown as StockBalanceRepository,
			movementRepository as unknown as StockMovementRepository,
		);

		return {
			service,
			reservationRepository,
			balanceRepository,
			movementRepository,
			tx,
		};
	};

	it('reserves all requested items in one transaction', async () => {
		const harness = createHarness();
		const reservation = {
			id: 'reservation-1',
			orderId: 'order-1',
			locationId: 'location-1',
			status: 'ACTIVE',
		};
		const items = [
			{
				id: 'reservation-item-1',
				reservationId: reservation.id,
				variantId: 'variant-1',
				quantity: 2,
			},
		];
		harness.balanceRepository.ensureAndLock.mockResolvedValue([
			{
				variantId: 'variant-1',
				quantityOnHand: 5,
				quantityReserved: 1,
			},
		]);
		harness.reservationRepository.createReservation.mockResolvedValue(reservation);
		harness.reservationRepository.createItems.mockResolvedValue(items);
		harness.reservationRepository.getByIdempotencyKey.mockResolvedValue(
			undefined,
		);

		await expect(
			harness.service.reserve({
				orderId: 'order-1',
				locationId: 'location-1',
				idempotencyKey: 'reserve-order-1-1',
				items: [{ variantId: 'variant-1', quantity: 2 }],
			}),
		).resolves.toEqual({ reservation, items });
		expect(harness.reservationRepository.transaction).toHaveBeenCalledOnce();
		expect(harness.balanceRepository.adjustReserved).toHaveBeenCalledWith(
			'location-1',
			'variant-1',
			2,
			harness.tx,
		);
		expect(harness.movementRepository.createMany).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ movementType: 'RESERVATION', quantity: 2 }),
			]),
			harness.tx,
		);
	});

	it('returns the original reservation for an identical idempotent retry', async () => {
		const harness = createHarness();
		const reservation = {
			id: 'reservation-1',
			orderId: 'order-1',
			locationId: 'location-1',
			status: 'ACTIVE',
		};
		const items = [
			{
				id: 'reservation-item-1',
				reservationId: reservation.id,
				variantId: 'variant-1',
				quantity: 2,
			},
		];
		harness.reservationRepository.getByIdempotencyKey.mockResolvedValue(
			reservation,
		);
		harness.reservationRepository.getItems.mockResolvedValue(items);

		await expect(
			harness.service.reserve({
				orderId: 'order-1',
				locationId: 'location-1',
				idempotencyKey: 'reserve-order-1-1',
				items: [{ variantId: 'variant-1', quantity: 2 }],
			}),
		).resolves.toEqual({ reservation, items });
		expect(harness.balanceRepository.ensureAndLock).not.toHaveBeenCalled();
		expect(harness.movementRepository.createMany).not.toHaveBeenCalled();
	});

	it('rejects reusing a reservation key with different items', async () => {
		const harness = createHarness();
		const reservation = {
			id: 'reservation-1',
			orderId: 'order-1',
			locationId: 'location-1',
			status: 'ACTIVE',
		};
		harness.reservationRepository.getByIdempotencyKey.mockResolvedValue(
			reservation,
		);
		harness.reservationRepository.getItems.mockResolvedValue([
			{
				id: 'reservation-item-1',
				reservationId: reservation.id,
				variantId: 'variant-1',
				quantity: 1,
			},
		]);

		await expect(
			harness.service.reserve({
				orderId: 'order-1',
				locationId: 'location-1',
				idempotencyKey: 'reserve-order-1-1',
				items: [{ variantId: 'variant-1', quantity: 2 }],
			}),
		).rejects.toThrow('different reservation request');
	});

	it('does not write anything when stock is insufficient', async () => {
		const harness = createHarness();
		harness.balanceRepository.ensureAndLock.mockResolvedValue([
			{
				variantId: 'variant-1',
				quantityOnHand: 2,
				quantityReserved: 1,
			},
		]);

		await expect(
			harness.service.reserve({
				orderId: 'order-1',
				locationId: 'location-1',
				idempotencyKey: 'reserve-order-1-1',
				items: [{ variantId: 'variant-1', quantity: 2 }],
			}),
		).rejects.toThrow('Insufficient available stock');
		expect(harness.reservationRepository.createReservation).not.toHaveBeenCalled();
		expect(harness.balanceRepository.adjustReserved).not.toHaveBeenCalled();
		expect(harness.movementRepository.createMany).not.toHaveBeenCalled();
	});

	it('rejects another reservation while an order already has an active one', async () => {
		const harness = createHarness();
		harness.reservationRepository.getActiveByOrderForUpdate.mockResolvedValue({
			id: 'existing-reservation',
	});

		await expect(
			harness.service.reserve({
				orderId: 'order-1',
				locationId: 'location-1',
				idempotencyKey: 'reserve-order-1-2',
				items: [{ variantId: 'variant-1', quantity: 1 }],
			}),
		).rejects.toThrow('An active reservation already exists');
		expect(harness.balanceRepository.ensureAndLock).not.toHaveBeenCalled();
	});

	it('releases reserved quantities and records RELEASE movements', async () => {
		const harness = createHarness();
		const activeReservation = {
			id: 'reservation-1',
			orderId: 'order-1',
			locationId: 'location-1',
			status: 'ACTIVE',
		};
		const releasedReservation = { ...activeReservation, status: 'RELEASED' };
		const items = [
			{
				id: 'reservation-item-1',
				reservationId: activeReservation.id,
				variantId: 'variant-1',
				quantity: 2,
			},
		];
		harness.reservationRepository.getActiveByOrderForUpdate.mockResolvedValue(
			activeReservation,
		);
		harness.reservationRepository.getItems.mockResolvedValue(items);
		harness.balanceRepository.lockExisting.mockResolvedValue([
			{ variantId: 'variant-1', quantityReserved: 3 },
		]);
		harness.reservationRepository.updateStatus.mockResolvedValue([
			releasedReservation,
		]);

		await expect(
			harness.service.release('order-1', {
				idempotencyKey: 'release-reservation-1',
				reason: 'ORDER_CANCELLED',
			}),
		).resolves.toEqual({ reservation: releasedReservation, items });
		expect(harness.balanceRepository.adjustReserved).toHaveBeenCalledWith(
			'location-1',
			'variant-1',
			-2,
			harness.tx,
		);
		expect(harness.movementRepository.createMany).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ movementType: 'RELEASE', quantity: 2 }),
			]),
			harness.tx,
		);
	});

	it('decrements on-hand and reserved quantities when dispatching', async () => {
		const harness = createHarness();
		const activeReservation = {
			id: 'reservation-1',
			orderId: 'order-1',
			locationId: 'location-1',
			status: 'ACTIVE',
		};
		const dispatchedReservation = { ...activeReservation, status: 'DISPATCHED' };
		const items = [
			{
				id: 'reservation-item-1',
				reservationId: activeReservation.id,
				variantId: 'variant-1',
				quantity: 2,
			},
		];
		harness.reservationRepository.getActiveByOrderForUpdate.mockResolvedValue(
			activeReservation,
		);
		harness.reservationRepository.getItems.mockResolvedValue(items);
		harness.balanceRepository.lockExisting.mockResolvedValue([
			{
				variantId: 'variant-1',
				quantityReserved: 2,
				quantityOnHand: 2,
			},
		]);
		harness.reservationRepository.updateStatus.mockResolvedValue([
			dispatchedReservation,
		]);

		await expect(
			harness.service.dispatch('order-1', {
				idempotencyKey: 'dispatch-reservation-1',
				performedBy: 'operator-1',
			}),
		).resolves.toEqual({ reservation: dispatchedReservation, items });
		expect(harness.balanceRepository.decrementForDispatch).toHaveBeenCalledWith(
			'location-1',
			'variant-1',
			2,
			harness.tx,
		);
		expect(harness.movementRepository.createMany).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ movementType: 'OUT', quantity: 2 }),
			]),
			harness.tx,
		);
	});
});