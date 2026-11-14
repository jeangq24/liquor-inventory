import { ApiProperty } from '@nestjs/swagger';
import { movementTypeEnum } from '../../../infrastructure/database/schema/inventory.schema.js';

export class StockMovementResponseDto {
	@ApiProperty({ format: 'uuid' })
	id!: string;

	@ApiProperty({ format: 'uuid' })
	locationId!: string;

	@ApiProperty({ format: 'uuid' })
	variantId!: string;

	@ApiProperty({ nullable: true, format: 'uuid' })
	reservationId!: string | null;

	@ApiProperty({ nullable: true, format: 'uuid' })
	stockReturnId!: string | null;

	@ApiProperty({ nullable: true, format: 'uuid' })
	orderId!: string | null;

	@ApiProperty({ enum: movementTypeEnum.enumValues })
	movementType!: (typeof movementTypeEnum.enumValues)[number];

	@ApiProperty({ minimum: 1 })
	quantity!: number;

	@ApiProperty()
	reason!: string;

	@ApiProperty({ nullable: true, format: 'uuid' })
	performedBy!: string | null;

	@ApiProperty({ format: 'date-time' })
	createdAt!: Date;
}