import { Injectable } from '@nestjs/common';
import { StockBalanceRepository } from './stock-balance.repository.js';

export interface StockAvailability {
	id: string | null;
	locationId: string;
	variantId: string;
	quantityOnHand: number;
	quantityReserved: number;
	quantityAvailable: number;
	updatedAt: Date | null;
}

@Injectable()
export class StockBalanceService {
	constructor(private readonly balanceRepository: StockBalanceRepository) {}

	getByVariant(variantId: string) {
		return this.balanceRepository.getByVariant(variantId);
	}

	async getAvailable(variantId: string, locationId: string) {
		const [balance] = await this.balanceRepository.getAvailability(locationId, [variantId]);
		return balance ?? this.emptyAvailability(variantId, locationId);
	}

	async getAvailability(locationId: string, variantIds: string[]) {
		const balances = await this.balanceRepository.getAvailability(
			locationId,
			[...new Set(variantIds)],
		);
		const balancesByVariant = new Map(
			balances.map((balance) => [balance.variantId, balance]),
		);

		return [...new Set(variantIds)].map(
			(variantId) =>
				balancesByVariant.get(variantId) ??
				this.emptyAvailability(variantId, locationId),
		);
	}

	getByLocation(locationId: string) {
		return this.balanceRepository.getByLocation(locationId);
	}

	private emptyAvailability(
		variantId: string,
		locationId: string,
	): StockAvailability {
		return {
			id: null,
			locationId,
			variantId,
			quantityOnHand: 0,
			quantityReserved: 0,
			quantityAvailable: 0,
			updatedAt: null,
		};
	}
}