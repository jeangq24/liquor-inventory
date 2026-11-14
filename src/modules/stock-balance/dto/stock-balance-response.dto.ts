import { ApiProperty } from '@nestjs/swagger';

export class StockBalanceResponseDto {
	@ApiProperty({ nullable: true, format: 'uuid' })
	id!: string | null;

	@ApiProperty({ format: 'uuid' })
	locationId!: string;

	@ApiProperty({ format: 'uuid' })
	variantId!: string;

	@ApiProperty({ minimum: 0 })
	quantityOnHand!: number;

	@ApiProperty({ minimum: 0 })
	quantityReserved!: number;

	@ApiProperty({ minimum: 0 })
	quantityAvailable!: number;

	@ApiProperty({ nullable: true, format: 'date-time' })
	updatedAt!: Date | null;
}