import { Module } from '@nestjs/common';
import { StockBalanceController } from './stock-balance.controller.js';
import { StockBalanceRepository } from './stock-balance.repository.js';
import { StockBalanceService } from './stock-balance.service.js';

@Module({
	controllers: [StockBalanceController],
	providers: [StockBalanceRepository, StockBalanceService],
	exports: [StockBalanceRepository, StockBalanceService],
})
export class StockBalanceModule {}