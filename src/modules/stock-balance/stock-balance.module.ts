import { Module } from '@nestjs/common';
import { StockBalanceRepository } from './stock-balance.repository.js';

@Module({
	providers: [StockBalanceRepository],
	exports: [StockBalanceRepository],
})
export class StockBalanceModule {}