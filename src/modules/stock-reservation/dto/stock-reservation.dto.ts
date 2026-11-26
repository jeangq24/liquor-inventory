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
	@ApiProperty({ format: 'uuid', description: 'UUID v4 de la variante.' })
	@IsUUID('4')
	variantId!: string;

	@ApiProperty({ minimum: 1, description: 'Cantidad entera positiva que se reserva.' })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantity!: number;
}

export class ReserveStockDto {
	@ApiProperty({ format: 'uuid', description: 'UUID v4 del pedido.' })
	@IsUUID('4')
	orderId!: string;

	@ApiProperty({ format: 'uuid', description: 'UUID v4 de la ubicación.' })
	@IsUUID('4')
	locationId!: string;

	@ApiProperty({ minLength: 1, maxLength: 180, description: 'Clave estable de la solicitud para sus reintentos.' })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;

	@ApiProperty({ type: [ReserveStockItemDto], description: 'Variantes a reservar; debe incluir al menos un elemento.' })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => ReserveStockItemDto)
	items!: ReserveStockItemDto[];
}

export class ReleaseStockDto {
	@ApiProperty({ minLength: 1, maxLength: 180, description: 'Clave estable de liberación para sus reintentos.' })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;

	@ApiProperty({ minLength: 1, maxLength: 180, description: 'Motivo de la liberación.' })
	@IsString()
	@Length(1, 180)
	reason!: string;
}

export class DispatchStockDto {
	@ApiProperty({ minLength: 1, maxLength: 180, description: 'Clave estable de despacho para sus reintentos.' })
	@IsString()
	@Length(1, 180)
	idempotencyKey!: string;
}

export class GetReservationsByOrderDto {
	@ApiProperty({ format: 'uuid', description: 'UUID v4 del pedido.' })
	@IsUUID('4')
	orderId!: string;
}