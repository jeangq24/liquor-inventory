import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { StockBalanceModule } from './modules/stock-balance/stock-balance.module.js';
import { StockReservationModule } from './modules/stock-reservation/stock-reservation.module.js';

@Module({
  imports: [DatabaseModule, StockBalanceModule, StockReservationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
