import { createHash } from 'node:crypto';
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import type {
	stockReservationItems,
	stockReservations,
} from '../../infrastructure/database/schema/inventory.schema.js';
import { StockBalanceRepository } from '../stock-balance/stock-balance.repository.js';
import {
	StockMovementRepository,
	type NewStockMovement,
} from '../stock-movement/stock-movement.repository.js';
import {
	StockReservationRepository,
	type ReservationTransaction,
} from './stock-reservation.repository.js';

export interface ReserveStockInput {
	orderId: string;
	locationId: string;
	idempotencyKey: string;
	items: Array<{ variantId: string; quantity: number }>;
}

export interface ReleaseStockInput {
	idempotencyKey: string;
	reason: string;
	performedBy: string;
}

export interface DispatchStockInput {
	idempotencyKey: string;
	performedBy: string;
}

export interface StockReservationResult {
	reservation: typeof stockReservations.$inferSelect;
	items: Array<typeof stockReservationItems.$inferSelect>;
}

type ReservationStatus = StockReservationResult['reservation']['status'];
type MovementOperation = 'reserve' | 'release' | 'dispatch';

@Injectable()
export class StockReservationService {
	constructor(
		private readonly reservationRepository: StockReservationRepository,
		private readonly balanceRepository: StockBalanceRepository,
		private readonly movementRepository: StockMovementRepository,
	) {}

	async reserve(input: ReserveStockInput): Promise<StockReservationResult> {
		this.validateIdempotencyKey(input.idempotencyKey);
		this.validateItems(input.items);

		const normalizedItems = this.normalizeItems(input.items);
		const operationPrefix = this.movementIdempotencyPrefix(
			'reserve',
			input.idempotencyKey,
		);

		try {
			return await this.reservationRepository.transaction(async (tx) => {
				await this.reservationRepository.lockOrder(input.orderId, tx);

				const existing = await this.reservationRepository.getByIdempotencyKey(
					input.idempotencyKey,
					tx,
				);

				if (existing) {
					return this.resolveReserveReplay(existing, input, normalizedItems, tx);
				}

				const activeReservation =
					await this.reservationRepository.getActiveByOrderForUpdate(
						input.orderId,
						tx,
					);
				if (activeReservation) {
					throw new ConflictException(
						`An active reservation already exists for order ${input.orderId}`,
					);
				}

				const balances = await this.balanceRepository.ensureAndLock(
					input.locationId,
					normalizedItems.map((item) => item.variantId),
					tx,
				);
				const balancesByVariant = new Map(
					balances.map((balance) => [balance.variantId, balance]),
				);

				for (const item of normalizedItems) {
					const balance = balancesByVariant.get(item.variantId);
					if (!balance) {
						throw new ConflictException(
							`Could not lock stock balance for variant ${item.variantId}`,
						);
					}

					if (
						balance.quantityOnHand - balance.quantityReserved <
						item.quantity
					) {
						throw new ConflictException(
							`Insufficient available stock for variant ${item.variantId}`,
						);
					}
				}

				const now = new Date();
				const reservation = await this.reservationRepository.createReservation(
					{
						orderId: input.orderId,
						locationId: input.locationId,
						idempotencyKey: input.idempotencyKey,
						status: 'ACTIVE',
						reservedAt: now,
					},
					tx,
				);
				const items = await this.reservationRepository.createItems(
					normalizedItems.map((item) => ({
						reservationId: reservation.id,
						...item,
					})),
					tx,
				);

				for (const item of items) {
					await this.balanceRepository.adjustReserved(
						input.locationId,
						item.variantId,
						item.quantity,
						tx,
					);
				}

				await this.movementRepository.createMany(
					this.createMovements(
						reservation,
						items,
						'RESERVATION',
						'STOCK_RESERVED',
						operationPrefix,
					),
					tx,
				);

				return { reservation, items };
			});
		} catch (error) {
			if (!this.isUniqueConstraintViolation(error)) {
				throw error;
			}

			const existing = await this.reservationRepository.getByIdempotencyKey(
				input.idempotencyKey,
			);
			if (existing) {
				return this.resolveReserveReplay(existing, input, normalizedItems);
			}

			throw new ConflictException(
				`An active reservation already exists for order ${input.orderId}`,
			);
		}
	}

	async release(
		orderId: string,
		input: ReleaseStockInput,
	): Promise<StockReservationResult> {
		this.validateIdempotencyKey(input.idempotencyKey);
		if (!input.reason.trim()) {
			throw new BadRequestException('Release reason is required');
		}
		if (!input.performedBy.trim()) {
			throw new BadRequestException('Operator identity is required');
		}

		const operationPrefix = this.movementIdempotencyPrefix(
			'release',
			input.idempotencyKey,
		);

		return this.reservationRepository.transaction(async (tx) => {
			await this.reservationRepository.lockOrder(orderId, tx);

			const replay = await this.resolveMovementReplay(
				orderId,
				'release',
				'RELEASED',
				operationPrefix,
				input.reason,
				input.performedBy,
				tx,
			);
			if (replay) {
				return replay;
			}

			const reservation = await this.reservationRepository.getActiveByOrderForUpdate(
				orderId,
				tx,
			);
			if (!reservation) {
				const replayAfterLock = await this.resolveMovementReplay(
					orderId,
					'release',
					'RELEASED',
					operationPrefix,
					input.reason,
					input.performedBy,
					tx,
				);
				if (replayAfterLock) {
					return replayAfterLock;
				}
				throw await this.noActiveReservation(orderId, tx);
			}

			const items = await this.reservationRepository.getItems(reservation.id, tx);
			const balances = await this.lockReservationBalances(
				reservation.locationId,
				items,
				tx,
			);
			const balancesByVariant = new Map(
				balances.map((balance) => [balance.variantId, balance]),
			);

			for (const item of items) {
				const balance = balancesByVariant.get(item.variantId);
				if (!balance || balance.quantityReserved < item.quantity) {
					throw new ConflictException(
						`Reserved quantity is inconsistent for variant ${item.variantId}`,
					);
				}
			}

			for (const item of items) {
				await this.balanceRepository.adjustReserved(
					reservation.locationId,
					item.variantId,
					-item.quantity,
					tx,
				);
			}

			const [updatedReservation] = await this.reservationRepository.updateStatus(
				reservation.id,
				'RELEASED',
				tx,
			);
			if (!updatedReservation) {
				throw new ConflictException('Reservation could not be released');
			}

			await this.movementRepository.createMany(
				this.createMovements(
					updatedReservation,
					items,
					'RELEASE',
					input.reason,
					operationPrefix,
					input.performedBy,
				),
				tx,
			);

			return { reservation: updatedReservation, items };
		});
	}

	async dispatch(
		orderId: string,
		input: DispatchStockInput,
	): Promise<StockReservationResult> {
		this.validateIdempotencyKey(input.idempotencyKey);
		if (!input.performedBy.trim()) {
			throw new BadRequestException('Operator identity is required');
		}

		const operationPrefix = this.movementIdempotencyPrefix(
			'dispatch',
			input.idempotencyKey,
		);

		return this.reservationRepository.transaction(async (tx) => {
			await this.reservationRepository.lockOrder(orderId, tx);

			const replay = await this.resolveMovementReplay(
				orderId,
				'dispatch',
				'DISPATCHED',
				operationPrefix,
				'ORDER_DISPATCHED',
				input.performedBy,
				tx,
			);
			if (replay) {
				return replay;
			}

			const reservation = await this.reservationRepository.getActiveByOrderForUpdate(
				orderId,
				tx,
			);
			if (!reservation) {
				const replayAfterLock = await this.resolveMovementReplay(
					orderId,
					'dispatch',
					'DISPATCHED',
					operationPrefix,
					'ORDER_DISPATCHED',
					input.performedBy,
					tx,
				);
				if (replayAfterLock) {
					return replayAfterLock;
				}
				throw await this.noActiveReservation(orderId, tx);
			}

			const items = await this.reservationRepository.getItems(reservation.id, tx);
			const balances = await this.lockReservationBalances(
				reservation.locationId,
				items,
				tx,
			);
			const balancesByVariant = new Map(
				balances.map((balance) => [balance.variantId, balance]),
			);

			for (const item of items) {
				const balance = balancesByVariant.get(item.variantId);
				if (
					!balance ||
					balance.quantityReserved < item.quantity ||
					balance.quantityOnHand < item.quantity
				) {
					throw new ConflictException(
						`Reserved stock is insufficient for variant ${item.variantId}`,
					);
				}
			}

			for (const item of items) {
				await this.balanceRepository.decrementForDispatch(
					reservation.locationId,
					item.variantId,
					item.quantity,
					tx,
				);
			}

			const [updatedReservation] = await this.reservationRepository.updateStatus(
				reservation.id,
				'DISPATCHED',
				tx,
			);
			if (!updatedReservation) {
				throw new ConflictException('Reservation could not be dispatched');
			}

			await this.movementRepository.createMany(
				this.createMovements(
					updatedReservation,
					items,
					'OUT',
					'ORDER_DISPATCHED',
					operationPrefix,
					input.performedBy,
				),
				tx,
			);

			return { reservation: updatedReservation, items };
		});
	}

	getByOrder(orderId: string) {
		return this.reservationRepository.getByOrder(orderId).then((reservations) =>
			Promise.all(
				reservations.map(async (reservation) => ({
					reservation,
					items: await this.reservationRepository.getItems(reservation.id),
				})),
			),
		);
	}

	private async resolveReserveReplay(
		reservation: StockReservationResult['reservation'],
		input: ReserveStockInput,
		expectedItems: ReserveStockInput['items'],
		tx?: ReservationTransaction,
	): Promise<StockReservationResult> {
		const items = await this.reservationRepository.getItems(reservation.id, tx);
		const sameItems = this.normalizeItems(items).every(
			(item, index) =>
				item.variantId === expectedItems[index]?.variantId &&
				item.quantity === expectedItems[index]?.quantity,
		);

		if (
			reservation.orderId !== input.orderId ||
			reservation.locationId !== input.locationId ||
			!sameItems ||
			items.length !== expectedItems.length
		) {
			throw new ConflictException(
				'Idempotency key was already used with a different reservation request',
			);
		}

		return { reservation, items };
	}

	private async resolveMovementReplay(
		orderId: string,
		operation: Exclude<MovementOperation, 'reserve'>,
		status: Extract<ReservationStatus, 'RELEASED' | 'DISPATCHED'>,
		prefix: string,
		reason: string,
		performedBy: string | null,
		tx: ReservationTransaction,
	): Promise<StockReservationResult | undefined> {
		const movements = await this.movementRepository.getByIdempotencyPrefix(
			prefix,
			tx,
		);
		if (movements.length === 0) {
			return undefined;
		}

		const reservationId = movements[0]?.reservationId;
		if (
			!reservationId ||
			movements.some((movement) => movement.reservationId !== reservationId)
		) {
			throw new ConflictException('Idempotency key conflicts with another operation');
		}

		const reservation = await this.reservationRepository.getById(
			reservationId,
			tx,
		);
		if (!reservation || reservation.orderId !== orderId || reservation.status !== status) {
			throw new ConflictException('Idempotency key conflicts with another operation');
		}

		const items = await this.reservationRepository.getItems(reservation.id, tx);
		const movementsByVariant = new Map(
			movements.map((movement) => [movement.variantId, movement]),
		);
		const expectedMovementType = operation === 'release' ? 'RELEASE' : 'OUT';
		const matchingMovements = items.every((item) => {
			const movement = movementsByVariant.get(item.variantId);
			return (
				movement?.idempotencyKey === `${prefix}${item.id}` &&
				movement.quantity === item.quantity &&
				movement.movementType === expectedMovementType &&
				movement.reason === reason &&
				(movement.performedBy ?? null) === performedBy
			);
		});

		if (!matchingMovements || items.length !== movements.length) {
			throw new ConflictException(
				'Idempotency key was already used with different operation data',
			);
		}

		return { reservation, items };
	}

	private async lockReservationBalances(
		locationId: string,
		items: Array<typeof stockReservationItems.$inferSelect>,
		tx: ReservationTransaction,
	) {
		if (items.length === 0) {
			throw new ConflictException('Reservation has no items');
		}

		const balances = await this.balanceRepository.lockExisting(
			locationId,
			items.map((item) => item.variantId),
			tx,
		);
		if (balances.length !== items.length) {
			throw new ConflictException('Reservation stock balances are incomplete');
		}

		return balances;
	}

	private async noActiveReservation(
		orderId: string,
		tx: ReservationTransaction,
	) {
		const reservations = await this.reservationRepository.getByOrder(orderId, tx);
		if (reservations.length === 0) {
			return new NotFoundException(`No reservation found for order ${orderId}`);
		}

		return new ConflictException(
			`Order ${orderId} does not have an active reservation`,
		);
	}

	private createMovements(
		reservation: StockReservationResult['reservation'],
		items: Array<typeof stockReservationItems.$inferSelect>,
		movementType: NewStockMovement['movementType'],
		reason: string,
		prefix: string,
		performedBy: string | null = null,
	): NewStockMovement[] {
		return items.map((item) => ({
			locationId: reservation.locationId,
			variantId: item.variantId,
			reservationId: reservation.id,
			orderId: reservation.orderId,
			movementType,
			quantity: item.quantity,
			reason,
			idempotencyKey: `${prefix}${item.id}`,
			performedBy,
		}));
	}

	private validateItems(items: ReserveStockInput['items']) {
		if (items.length === 0) {
			throw new BadRequestException('At least one stock item is required');
		}

		const variantIds = new Set<string>();
		for (const item of items) {
			if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
				throw new BadRequestException('Item quantities must be positive integers');
			}
			if (variantIds.has(item.variantId)) {
				throw new BadRequestException('Variant IDs must not be duplicated');
			}
			variantIds.add(item.variantId);
		}
	}

	private validateIdempotencyKey(idempotencyKey: string) {
		if (!idempotencyKey.trim() || idempotencyKey.length > 180) {
			throw new BadRequestException(
				'Idempotency key must contain between 1 and 180 characters',
			);
		}
	}

	private normalizeItems(
		items: Array<{ variantId: string; quantity: number }>,
	) {
		return [...items].sort((left, right) =>
			left.variantId.localeCompare(right.variantId),
		);
	}

	private movementIdempotencyPrefix(
		operation: MovementOperation,
		idempotencyKey: string,
	) {
		const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
		return `${operation}:${keyHash}:`;
	}

	private isUniqueConstraintViolation(error: unknown): boolean {
		return (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			error.code === '23505'
		);
	}
}