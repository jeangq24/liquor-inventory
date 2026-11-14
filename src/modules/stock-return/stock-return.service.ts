import { createHash } from 'node:crypto';
import {
	BadRequestException,
	ConflictException,
	Injectable,
} from '@nestjs/common';
import type {
	stockReturnItems,
	stockReturns,
} from '../../infrastructure/database/schema/inventory.schema.js';
import { StockBalanceRepository } from '../stock-balance/stock-balance.repository.js';
import { StockMovementRepository } from '../stock-movement/stock-movement.repository.js';
import { StockReturnRepository } from './stock-return.repository.js';

export interface RegisterStockReturnItem {
	variantId: string;
	quantityReceived: number;
	quantityRestockable: number;
	reason?: string;
}

export interface RegisterStockReturnInput {
	orderId: string;
	locationId: string;
	deliveryAttemptId?: string;
	idempotencyKey: string;
	reason: string;
	items: RegisterStockReturnItem[];
	receivedBy: string;
}

export interface StockReturnResult {
	stockReturn: typeof stockReturns.$inferSelect;
	items: Array<typeof stockReturnItems.$inferSelect>;
}

@Injectable()
export class StockReturnService {
	constructor(
		private readonly returnRepository: StockReturnRepository,
		private readonly balanceRepository: StockBalanceRepository,
		private readonly movementRepository: StockMovementRepository,
	) {}

	async registerReturn(
		input: RegisterStockReturnInput,
	): Promise<StockReturnResult> {
		this.validateInput(input);
		const items = this.normalizeItems(input.items);
		const movementPrefix = this.movementIdempotencyPrefix(input.idempotencyKey);

		return this.returnRepository.transaction(async (tx) => {
			await this.returnRepository.lockIdempotencyKey(input.idempotencyKey, tx);

			const existing = await this.returnRepository.getByIdempotencyKey(
				input.idempotencyKey,
				tx,
			);
			if (existing) {
				return this.resolveReplay(existing, input, items, tx);
			}

			const stockReturn = await this.returnRepository.create(
				{
					orderId: input.orderId,
					locationId: input.locationId,
					deliveryAttemptId: input.deliveryAttemptId,
					idempotencyKey: input.idempotencyKey,
					reason: input.reason,
					receivedBy: input.receivedBy,
					status: 'RECEIVED',
				},
				tx,
			);
			const returnItems = await this.returnRepository.createItems(
				items.map((item) => ({
					stockReturnId: stockReturn.id,
					variantId: item.variantId,
					quantityReceived: item.quantityReceived,
					quantityRestockable: item.quantityRestockable,
					reason: item.reason,
				})),
				tx,
			);

			const restockableItems = returnItems.filter(
				(item) => item.quantityRestockable > 0,
			);
			if (restockableItems.length > 0) {
				await this.balanceRepository.ensureAndLock(
					input.locationId,
					restockableItems.map((item) => item.variantId),
					tx,
				);

				for (const item of restockableItems) {
					await this.balanceRepository.adjustOnHand(
						input.locationId,
						item.variantId,
						item.quantityRestockable,
						tx,
					);
				}

				await this.movementRepository.createMany(
					restockableItems.map((item) => ({
						locationId: input.locationId,
						variantId: item.variantId,
						stockReturnId: stockReturn.id,
						orderId: input.orderId,
						movementType: 'IN' as const,
						quantity: item.quantityRestockable,
						reason: item.reason ?? input.reason,
						idempotencyKey: `${movementPrefix}${item.variantId}`,
						performedBy: input.receivedBy,
					})),
					tx,
				);
			}

			const processedReturn = await this.returnRepository.markProcessed(
				stockReturn.id,
				tx,
			);
			if (!processedReturn) {
				throw new ConflictException('Stock return could not be processed');
			}

			return { stockReturn: processedReturn, items: returnItems };
		});
	}

	async getByOrder(orderId: string) {
		const returns = await this.returnRepository.getByOrder(orderId);
		return Promise.all(
			returns.map(async (stockReturn) => ({
				stockReturn,
				items: await this.returnRepository.getItems(stockReturn.id),
			})),
		);
	}

	private async resolveReplay(
		stockReturn: StockReturnResult['stockReturn'],
		input: RegisterStockReturnInput,
		expectedItems: RegisterStockReturnItem[],
		tx: Parameters<
			Parameters<StockReturnRepository['transaction']>[0]
		>[0],
	): Promise<StockReturnResult> {
		const items = await this.returnRepository.getItems(stockReturn.id, tx);
		const persistedItems = items.map((item) => ({
			variantId: item.variantId,
			quantityReceived: item.quantityReceived,
			quantityRestockable: item.quantityRestockable,
			reason: item.reason ?? undefined,
		}));
		const sameItems = this.normalizeItems(persistedItems).every(
			(item, index) =>
				item.variantId === expectedItems[index]?.variantId &&
				item.quantityReceived === expectedItems[index]?.quantityReceived &&
				item.quantityRestockable === expectedItems[index]?.quantityRestockable &&
				(item.reason ?? undefined) === expectedItems[index]?.reason,
		);

		if (
			stockReturn.orderId !== input.orderId ||
			stockReturn.locationId !== input.locationId ||
			stockReturn.deliveryAttemptId !== (input.deliveryAttemptId ?? null) ||
			stockReturn.reason !== input.reason ||
			stockReturn.receivedBy !== input.receivedBy ||
			stockReturn.status !== 'PROCESSED' ||
			!sameItems ||
			items.length !== expectedItems.length
		) {
			throw new ConflictException(
				'Idempotency key was already used with different return data',
			);
		}

		return { stockReturn, items };
	}

	private validateInput(input: RegisterStockReturnInput) {
		if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 180) {
			throw new BadRequestException(
				'Idempotency key must contain between 1 and 180 characters',
			);
		}
		if (!input.reason.trim() || input.reason.length > 180) {
			throw new BadRequestException('Return reason is required');
		}
		if (!input.receivedBy.trim()) {
			throw new BadRequestException('Receiver identity is required');
		}
		if (input.items.length === 0) {
			throw new BadRequestException('At least one returned item is required');
		}

		const variantIds = new Set<string>();
		for (const item of input.items) {
			if (
				!Number.isSafeInteger(item.quantityReceived) ||
				item.quantityReceived <= 0 ||
				!Number.isSafeInteger(item.quantityRestockable) ||
				item.quantityRestockable < 0 ||
				item.quantityRestockable > item.quantityReceived
			) {
				throw new BadRequestException('Return quantities are invalid');
			}
			if (variantIds.has(item.variantId)) {
				throw new BadRequestException('Variant IDs must not be duplicated');
			}
			variantIds.add(item.variantId);
		}
	}

	private normalizeItems<T extends RegisterStockReturnItem>(items: T[]): T[] {
		return [...items].sort((left, right) =>
			left.variantId.localeCompare(right.variantId),
		);
	}

	private movementIdempotencyPrefix(idempotencyKey: string) {
		const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
		return `stock-return:${keyHash}:`;
	}
}