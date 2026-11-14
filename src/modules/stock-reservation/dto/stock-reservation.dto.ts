import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsInt,
	IsString,
	IsUUID,
	Length,
	Min,
	ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReserveStockItemDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	variantId!: string;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantity!: number;
}

export class ReserveStockDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	orderId!: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	locationId!: string;

	@ApiProperty({ minLength: 1, maxLength: 180 })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;

	@ApiProperty({ type: [ReserveStockItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => ReserveStockItemDto)
	items!: ReserveStockItemDto[];
}

export class ReleaseStockDto {
	@ApiProperty({ minLength: 1, maxLength: 180 })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;

	@ApiProperty({ minLength: 1, maxLength: 180 })
	@IsString()
	@Length(1, 180)
	reason!: string;
}

export class DispatchStockDto {
	@ApiProperty({ minLength: 1, maxLength: 180 })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;
}

export class GetReservationsByOrderDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	orderId!: string;
}