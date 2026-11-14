import { Module } from '@nestjs/common';
import { StockBalanceModule } from '../stock-balance/stock-balance.module.js';
import { StockMovementModule } from '../stock-movement/stock-movement.module.js';
import { StockReservationController } from './stock-reservation.controller.js';
import { StockReservationRepository } from './stock-reservation.repository.js';
import { StockReservationService } from './stock-reservation.service.js';

@Module({
	imports: [StockBalanceModule, StockMovementModule],
	controllers: [StockReservationController],
	providers: [StockReservationRepository, StockReservationService],
	exports: [StockReservationRepository, StockReservationService],
})
export class StockReservationModule {}