import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsDate,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { movementTypeEnum } from '../../../infrastructure/database/schema/inventory.schema.js';

export class StockMovementItemDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	variantId!: string;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantity!: number;
}

export class StockChangeDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	locationId!: string;

	@ApiProperty({ minLength: 1, maxLength: 180 })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;

	@ApiProperty({ minLength: 1, maxLength: 180 })
	@IsString()
	@Length(1, 180)
	reason!: string;

	@ApiProperty({ type: [StockMovementItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => StockMovementItemDto)
	items!: StockMovementItemDto[];
}

export class RegisterStockAdjustmentDto extends StockChangeDto {
	@ApiProperty({ enum: ['IN', 'OUT'] })
	@IsIn(['IN', 'OUT'])
	direction!: 'IN' | 'OUT';
}

export class GetStockMovementHistoryDto {
	@ApiPropertyOptional({ format: 'uuid' })
	@IsOptional()
	@IsUUID('4')
	locationId?: string;

	@ApiPropertyOptional({ format: 'uuid' })
	@IsOptional()
	@IsUUID('4')
	variantId?: string;

	@ApiPropertyOptional({ format: 'uuid' })
	@IsOptional()
	@IsUUID('4')
	orderId?: string;

	@ApiPropertyOptional({ format: 'uuid' })
	@IsOptional()
	@IsUUID('4')
	reservationId?: string;

	@ApiPropertyOptional({ format: 'uuid' })
	@IsOptional()
	@IsUUID('4')
	stockReturnId?: string;

	@ApiPropertyOptional({ format: 'uuid' })
	@IsOptional()
	@IsUUID('4')
	performedBy?: string;

	@ApiPropertyOptional({ enum: movementTypeEnum.enumValues })
	@IsOptional()
	@IsIn(movementTypeEnum.enumValues)
	movementType?: (typeof movementTypeEnum.enumValues)[number];

	@ApiPropertyOptional({ format: 'date-time' })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdFrom?: Date;

	@ApiPropertyOptional({ format: 'date-time' })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdTo?: Date;

	@ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 50;

	@ApiPropertyOptional({ minimum: 0, default: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset = 0;
}