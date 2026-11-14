import { ApiProperty } from '@nestjs/swagger';
import { reservationStatusEnum } from '../../../infrastructure/database/schema/inventory.schema.js';

export class StockReservationItemResponseDto {
	@ApiProperty({ format: 'uuid' })
	variantId!: string;

	@ApiProperty({ minimum: 1 })
	quantity!: number;
}

export class StockReservationResponseDto {
	@ApiProperty({ format: 'uuid' })
	reservationId!: string;

	@ApiProperty({ format: 'uuid' })
	orderId!: string;

	@ApiProperty({ format: 'uuid' })
	locationId!: string;

	@ApiProperty({ enum: reservationStatusEnum.enumValues })
	status!: (typeof reservationStatusEnum.enumValues)[number];

	@ApiProperty({ type: [StockReservationItemResponseDto] })
	items!: StockReservationItemResponseDto[];
}

export class StockReservationHistoryResponseDto extends StockReservationResponseDto {
	@ApiProperty({ format: 'date-time', nullable: true })
	reservedAt!: Date | null;

	@ApiProperty({ format: 'date-time', nullable: true })
	releasedAt!: Date | null;

	@ApiProperty({ format: 'date-time', nullable: true })
	dispatchedAt!: Date | null;

	@ApiProperty({ format: 'date-time' })
	createdAt!: Date;

	@ApiProperty({ format: 'date-time' })
	updatedAt!: Date;
}