import { createHash } from 'node:crypto';
import {
	BadRequestException,
	ConflictException,
	Injectable,
} from '@nestjs/common';
import type { stockMovements } from '../../infrastructure/database/schema/inventory.schema.js';
import { StockBalanceRepository } from '../stock-balance/stock-balance.repository.js';
import {
	StockMovementRepository,
	type NewStockMovement,
} from './stock-movement.repository.js';

export interface StockChangeItem {
	variantId: string;
	quantity: number;
}

export interface StockChangeInput {
	locationId: string;
	idempotencyKey: string;
	reason: string;
	performedBy: string;
	items: StockChangeItem[];
}

export interface StockAdjustmentInput extends StockChangeInput {
	direction: 'IN' | 'OUT';
}

export type StockChangeResult = Array<typeof stockMovements.$inferSelect>;

@Injectable()
export class StockMovementService {
	constructor(
		private readonly movementRepository: StockMovementRepository,
		private readonly balanceRepository: StockBalanceRepository,
	) {}

	registerEntry(input: StockChangeInput): Promise<StockChangeResult> {
		return this.registerChange(input, 'IN');
	}

	registerAdjustment(
		input: StockAdjustmentInput,
	): Promise<StockChangeResult> {
		return this.registerChange(
			input,
			input.direction === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
		);
	}

	getHistory(filters: Parameters<StockMovementRepository['getHistory']>[0]) {
		return this.movementRepository.getHistory(filters);
	}

	private async registerChange(
		input: StockChangeInput,
		movementType: NewStockMovement['movementType'],
	): Promise<StockChangeResult> {
		this.validateInput(input);
		const items = this.normalizeItems(input.items);
		const prefix = this.idempotencyPrefix(input.idempotencyKey);

		return this.movementRepository.transaction(async (tx) => {
			await this.movementRepository.lockIdempotencyKey(input.idempotencyKey, tx);

			const existing = await this.movementRepository.getByIdempotencyPrefix(
				prefix,
				tx,
			);
			if (existing.length > 0) {
				return this.resolveReplay(existing, input, items, movementType, prefix);
			}

			const balances = await this.balanceRepository.ensureAndLock(
				input.locationId,
				items.map((item) => item.variantId),
				tx,
			);
			const balancesByVariant = new Map(
				balances.map((balance) => [balance.variantId, balance]),
			);

			for (const item of items) {
				const balance = balancesByVariant.get(item.variantId);
				if (!balance) {
					throw new ConflictException(
						`Could not lock stock balance for variant ${item.variantId}`,
					);
				}
				if (
					movementType === 'ADJUSTMENT_OUT' &&
					balance.quantityOnHand - balance.quantityReserved < item.quantity
				) {
					throw new ConflictException(
						`Adjustment would consume reserved or unavailable stock for variant ${item.variantId}`,
					);
				}
			}

			for (const item of items) {
				await this.balanceRepository.adjustOnHand(
					input.locationId,
					item.variantId,
					movementType === 'ADJUSTMENT_OUT' ? -item.quantity : item.quantity,
					tx,
				);
			}

			return this.movementRepository.createMany(
				items.map((item) => ({
					locationId: input.locationId,
					variantId: item.variantId,
					movementType,
					quantity: item.quantity,
					reason: input.reason,
					idempotencyKey: `${prefix}${item.variantId}`,
					performedBy: input.performedBy,
				})),
				tx,
			);
		});
	}

	private resolveReplay(
		existing: StockChangeResult,
		input: StockChangeInput,
		expectedItems: StockChangeItem[],
		movementType: NewStockMovement['movementType'],
		prefix: string,
	): StockChangeResult {
		const movementsByVariant = new Map(
			existing.map((movement) => [movement.variantId, movement]),
		);
		const sameOperation = expectedItems.every((item) => {
			const movement = movementsByVariant.get(item.variantId);
			return (
				movement?.idempotencyKey === `${prefix}${item.variantId}` &&
				movement.locationId === input.locationId &&
				movement.quantity === item.quantity &&
				movement.movementType === movementType &&
				movement.reason === input.reason &&
				movement.performedBy === input.performedBy
			);
		});

		if (!sameOperation || existing.length !== expectedItems.length) {
			throw new ConflictException(
				'Idempotency key was already used with different stock change data',
			);
		}

		return existing;
	}

	private validateInput(input: StockChangeInput) {
		if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 180) {
			throw new BadRequestException(
				'Idempotency key must contain between 1 and 180 characters',
			);
		}
		if (!input.reason.trim() || input.reason.length > 180) {
			throw new BadRequestException('Reason must contain between 1 and 180 characters');
		}
		if (!input.performedBy.trim()) {
			throw new BadRequestException('Operator identity is required');
		}
		if (input.items.length === 0) {
			throw new BadRequestException('At least one stock item is required');
		}

		const variantIds = new Set<string>();
		for (const item of input.items) {
			if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
				throw new BadRequestException('Item quantities must be positive integers');
			}
			if (variantIds.has(item.variantId)) {
				throw new BadRequestException('Variant IDs must not be duplicated');
			}
			variantIds.add(item.variantId);
		}
	}

	private normalizeItems(items: StockChangeItem[]) {
		return [...items].sort((left, right) =>
			left.variantId.localeCompare(right.variantId),
		);
	}

	private idempotencyPrefix(idempotencyKey: string) {
		const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
		return `stock-change:${keyHash}:`;
	}
}