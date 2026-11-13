import { Module } from '@nestjs/common';
import { StockMovementRepository } from './stock-movement.repository.js';

@Module({
	providers: [StockMovementRepository],
	exports: [StockMovementRepository],
})
export class StockMovementModule {}