import { Module } from '@nestjs/common';
import { InternalSecurityModule } from './common/security/internal-security.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { StockBalanceModule } from './modules/stock-balance/stock-balance.module.js';
import { StockMovementModule } from './modules/stock-movement/stock-movement.module.js';
import { StockReservationModule } from './modules/stock-reservation/stock-reservation.module.js';
import { StockReturnModule } from './modules/stock-return/stock-return.module.js';

@Module({
  imports: [
    DatabaseModule,
    InternalSecurityModule,
    StockBalanceModule,
    StockMovementModule,
    StockReservationModule,
    StockReturnModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
