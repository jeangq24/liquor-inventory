import { ApiProperty } from '@nestjs/swagger';
import { stockReturnStatusEnum } from '../../../infrastructure/database/schema/inventory.schema.js';

export class StockReturnItemResponseDto {
	@ApiProperty({ format: 'uuid' })
	variantId!: string;

	@ApiProperty({ minimum: 1 })
	quantityReceived!: number;

	@ApiProperty({ minimum: 0 })
	quantityRestockable!: number;

	@ApiProperty({ nullable: true })
	reason!: string | null;
}

export class StockReturnResponseDto {
	@ApiProperty({ format: 'uuid' })
	returnId!: string;

	@ApiProperty({ format: 'uuid' })
	orderId!: string;

	@ApiProperty({ format: 'uuid' })
	locationId!: string;

	@ApiProperty({ format: 'uuid', nullable: true })
	deliveryAttemptId!: string | null;

	@ApiProperty({ enum: stockReturnStatusEnum.enumValues })
	status!: (typeof stockReturnStatusEnum.enumValues)[number];

	@ApiProperty()
	reason!: string;

	@ApiProperty({ format: 'uuid', nullable: true })
	receivedBy!: string | null;

	@ApiProperty({ format: 'date-time' })
	receivedAt!: Date;

	@ApiProperty({ format: 'date-time', nullable: true })
	processedAt!: Date | null;

	@ApiProperty({ type: [StockReturnItemResponseDto] })
	items!: StockReturnItemResponseDto[];
}