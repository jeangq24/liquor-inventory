import { ApiProperty } from '@nestjs/swagger';
import { stockReturnStatusEnum } from '../../../infrastructure/database/schema/inventory.schema.js';

export class StockReturnItemResponseDto {
	@ApiProperty({ format: 'uuid', description: 'Identificador lógico de la variante recibida.' })
	variantId!: string;

	@ApiProperty({ minimum: 1, description: 'Cantidad de unidades recibidas.' })
	quantityReceived!: number;

	@ApiProperty({ minimum: 0, description: 'Cantidad de unidades aptas para reintegrar.' })
	quantityRestockable!: number;

	@ApiProperty({ nullable: true, description: 'Motivo o condición de las unidades, si se registró.' })
	reason!: string | null;
}

export class StockReturnResponseDto {
	@ApiProperty({ format: 'uuid', description: 'Identificador de la devolución.' })
	returnId!: string;

	@ApiProperty({ format: 'uuid', description: 'Identificador lógico del pedido.' })
	orderId!: string;

	@ApiProperty({ format: 'uuid', description: 'Identificador de la ubicación de recepción.' })
	locationId!: string;

	@ApiProperty({ format: 'uuid', nullable: true, description: 'Identificador lógico del intento de entrega, si se registró.' })
	deliveryAttemptId!: string | null;

	@ApiProperty({ enum: stockReturnStatusEnum.enumValues, description: 'Estado de la devolución.' })
	status!: (typeof stockReturnStatusEnum.enumValues)[number];

	@ApiProperty({ description: 'Motivo general de la devolución.' })
	reason!: string;

	@ApiProperty({ format: 'uuid', nullable: true, description: 'Identificador lógico de quien recibió la devolución.' })
	receivedBy!: string | null;

	@ApiProperty({ format: 'date-time', description: 'Fecha de recepción de la devolución.' })
	receivedAt!: Date;

	@ApiProperty({ format: 'date-time', nullable: true, description: 'Fecha de procesamiento, si corresponde.' })
	processedAt!: Date | null;

	@ApiProperty({ type: [StockReturnItemResponseDto], description: 'Detalle de unidades recibidas y reintegrables.' })
	items!: StockReturnItemResponseDto[];
}