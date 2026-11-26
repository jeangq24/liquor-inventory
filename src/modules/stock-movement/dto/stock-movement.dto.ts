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
	@ApiProperty({ format: 'uuid', description: 'UUID v4 de la variante.' })
	@IsUUID('4')
	variantId!: string;

	@ApiProperty({ minimum: 1, description: 'Cantidad entera positiva de unidades.' })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantity!: number;
}

export class StockChangeDto {
	@ApiProperty({ format: 'uuid', description: 'UUID v4 de la ubicación.' })
	@IsUUID('4')
	locationId!: string;

	@ApiProperty({ minLength: 1, maxLength: 180, description: 'Clave estable de la operación para sus reintentos.' })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;

	@ApiProperty({ minLength: 1, maxLength: 180, description: 'Motivo de la operación.' })
	@IsString()
	@Length(1, 180)
	reason!: string;

	@ApiProperty({ type: [StockMovementItemDto], description: 'Variantes y cantidades de la operación; debe incluir al menos un elemento.' })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => StockMovementItemDto)
	items!: StockMovementItemDto[];
}

export class RegisterStockAdjustmentDto extends StockChangeDto {
	@ApiProperty({ enum: ['IN', 'OUT'], description: 'Dirección del ajuste: entrada o salida.' })
	@IsIn(['IN', 'OUT'])
	direction!: 'IN' | 'OUT';
}

export class GetStockMovementHistoryDto {
	@ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por UUID v4 de ubicación.' })
	@IsOptional()
	@IsUUID('4')
	locationId?: string;

	@ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por UUID v4 de variante.' })
	@IsOptional()
	@IsUUID('4')
	variantId?: string;

	@ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por UUID v4 de pedido.' })
	@IsOptional()
	@IsUUID('4')
	orderId?: string;

	@ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por UUID v4 de reserva.' })
	@IsOptional()
	@IsUUID('4')
	reservationId?: string;

	@ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por UUID v4 de devolución.' })
	@IsOptional()
	@IsUUID('4')
	stockReturnId?: string;

	@ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por UUID v4 del responsable.' })
	@IsOptional()
	@IsUUID('4')
	performedBy?: string;

	@ApiPropertyOptional({ enum: movementTypeEnum.enumValues, description: 'Filtrar por tipo de movimiento.' })
	@IsOptional()
	@IsIn(movementTypeEnum.enumValues)
	movementType?: (typeof movementTypeEnum.enumValues)[number];

	@ApiPropertyOptional({ format: 'date-time', description: 'Fecha inicial inclusiva del movimiento.' })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdFrom?: Date;

	@ApiPropertyOptional({ format: 'date-time', description: 'Fecha final inclusiva del movimiento.' })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	createdTo?: Date;

	@ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50, description: 'Número máximo de movimientos por consulta.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 50;

	@ApiPropertyOptional({ minimum: 0, default: 0, description: 'Número de movimientos que se omiten antes de la página.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset = 0;
}