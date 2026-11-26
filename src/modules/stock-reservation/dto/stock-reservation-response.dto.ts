import { ApiProperty } from '@nestjs/swagger';
import { reservationStatusEnum } from '../../../infrastructure/database/schema/inventory.schema.js';

export class StockReservationItemResponseDto {
	@ApiProperty({ format: 'uuid', description: 'Identificador lógico de la variante.' })
	variantId!: string;

	@ApiProperty({ minimum: 1, description: 'Cantidad de unidades reservadas.' })
	quantity!: number;
}

export class StockReservationResponseDto {
	@ApiProperty({ format: 'uuid', description: 'Identificador de la reserva.' })
	reservationId!: string;

	@ApiProperty({ format: 'uuid', description: 'Identificador lógico del pedido.' })
	orderId!: string;

	@ApiProperty({ format: 'uuid', description: 'Identificador de la ubicación.' })
	locationId!: string;

	@ApiProperty({ enum: reservationStatusEnum.enumValues, description: 'Estado actual de la reserva.' })
	status!: (typeof reservationStatusEnum.enumValues)[number];

	@ApiProperty({ type: [StockReservationItemResponseDto], description: 'Detalle de variantes y cantidades de la reserva.' })
	items!: StockReservationItemResponseDto[];
}

export class StockReservationHistoryResponseDto extends StockReservationResponseDto {
	@ApiProperty({ format: 'date-time', nullable: true, description: 'Fecha de reserva, cuando se registró.' })
	reservedAt!: Date | null;

	@ApiProperty({ format: 'date-time', nullable: true, description: 'Fecha de liberación, si corresponde.' })
	releasedAt!: Date | null;

	@ApiProperty({ format: 'date-time', nullable: true, description: 'Fecha de despacho, si corresponde.' })
	dispatchedAt!: Date | null;

	@ApiProperty({ format: 'date-time', description: 'Fecha de creación de la reserva.' })
	createdAt!: Date;

	@ApiProperty({ format: 'date-time', description: 'Fecha de la última actualización de la reserva.' })
	updatedAt!: Date;
}