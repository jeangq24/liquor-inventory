import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Length,
	Min,
	ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterStockReturnItemDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	variantId!: string;

	@ApiProperty({ minimum: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantityReceived!: number;

	@ApiProperty({ minimum: 0 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	quantityRestockable!: number;

	@ApiPropertyOptional({ maxLength: 180 })
	@IsOptional()
	@IsString()
	@Length(1, 180)
	reason?: string;
}

export class RegisterStockReturnDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	orderId!: string;

	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	locationId!: string;

	@ApiPropertyOptional({ format: 'uuid' })
	@IsOptional()
	@IsUUID('4')
	deliveryAttemptId?: string;

	@ApiProperty({ minLength: 1, maxLength: 180 })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;

	@ApiProperty({ minLength: 1, maxLength: 180 })
	@IsString()
	@Length(1, 180)
	reason!: string;

	@ApiProperty({ type: [RegisterStockReturnItemDto] })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => RegisterStockReturnItemDto)
	items!: RegisterStockReturnItemDto[];
}

export class GetStockReturnsQueryDto {
	@ApiProperty({ format: 'uuid' })
	@IsUUID('4')
	orderId!: string;
}