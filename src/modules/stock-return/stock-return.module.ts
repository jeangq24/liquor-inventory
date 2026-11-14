import { Module } from '@nestjs/common';
import { StockBalanceModule } from '../stock-balance/stock-balance.module.js';
import { StockMovementModule } from '../stock-movement/stock-movement.module.js';
import { StockReturnController } from './stock-return.controller.js';
import { StockReturnRepository } from './stock-return.repository.js';
import { StockReturnService } from './stock-return.service.js';

@Module({
	imports: [StockBalanceModule, StockMovementModule],
	controllers: [StockReturnController],
	providers: [StockReturnRepository, StockReturnService],
	exports: [StockReturnRepository, StockReturnService],
})
export class StockReturnModule {}