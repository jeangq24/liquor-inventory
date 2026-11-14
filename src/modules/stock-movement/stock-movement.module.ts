import { Module } from '@nestjs/common';
import { StockBalanceModule } from '../stock-balance/stock-balance.module.js';
import { StockMovementController } from './stock-movement.controller.js';
import { StockMovementRepository } from './stock-movement.repository.js';
import { StockMovementService } from './stock-movement.service.js';

@Module({
	controllers: [StockMovementController],
	imports: [StockBalanceModule],
	providers: [StockMovementRepository, StockMovementService],
	exports: [StockMovementRepository, StockMovementService],
})
export class StockMovementModule {}