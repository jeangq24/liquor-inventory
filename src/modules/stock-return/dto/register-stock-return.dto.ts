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
	@ApiProperty({ format: 'uuid', description: 'UUID v4 de la variante recibida.' })
	@IsUUID('4')
	variantId!: string;

	@ApiProperty({ minimum: 1, description: 'Cantidad entera positiva de unidades recibidas.' })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantityReceived!: number;

	@ApiProperty({ minimum: 0, description: 'Unidades aptas para reintegrar; no puede superar la cantidad recibida.' })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	quantityRestockable!: number;

	@ApiPropertyOptional({ maxLength: 180, description: 'Motivo o condición de las unidades de la variante.' })
	@IsOptional()
	@IsString()
	@Length(1, 180)
	reason?: string;
}

export class RegisterStockReturnDto {
	@ApiProperty({ format: 'uuid', description: 'UUID v4 del pedido asociado.' })
	@IsUUID('4')
	orderId!: string;

	@ApiProperty({ format: 'uuid', description: 'UUID v4 de la ubicación que recibe la devolución.' })
	@IsUUID('4')
	locationId!: string;

	@ApiPropertyOptional({ format: 'uuid', description: 'UUID v4 del intento de entrega asociado, si corresponde.' })
	@IsOptional()
	@IsUUID('4')
	deliveryAttemptId?: string;

	@ApiProperty({ minLength: 1, maxLength: 180, description: 'Clave estable de la devolución para sus reintentos.' })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;

	@ApiProperty({ minLength: 1, maxLength: 180, description: 'Motivo general de la devolución.' })
	@IsString()
	@Length(1, 180)
	reason!: string;

	@ApiProperty({ type: [RegisterStockReturnItemDto], description: 'Detalle de unidades recibidas; debe incluir al menos un elemento.' })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => RegisterStockReturnItemDto)
	items!: RegisterStockReturnItemDto[];
}

export class GetStockReturnsQueryDto {
	@ApiProperty({ format: 'uuid', description: 'UUID v4 del pedido.' })
	@IsUUID('4')
	orderId!: string;
}