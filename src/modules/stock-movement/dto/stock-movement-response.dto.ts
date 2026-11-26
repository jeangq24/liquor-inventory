import { ApiProperty } from '@nestjs/swagger';
import { movementTypeEnum } from '../../../infrastructure/database/schema/inventory.schema.js';

export class StockMovementResponseDto {
	@ApiProperty({ format: 'uuid', description: 'Identificador del movimiento.' })
	id!: string;

	@ApiProperty({ format: 'uuid', description: 'Identificador de la ubicación.' })
	locationId!: string;

	@ApiProperty({ format: 'uuid', description: 'Identificador lógico de la variante.' })
	variantId!: string;

	@ApiProperty({ nullable: true, format: 'uuid', description: 'Identificador de la reserva asociada, si existe.' })
	reservationId!: string | null;

	@ApiProperty({ nullable: true, format: 'uuid', description: 'Identificador de la devolución asociada, si existe.' })
	stockReturnId!: string | null;

	@ApiProperty({ nullable: true, format: 'uuid', description: 'Identificador lógico del pedido asociado, si existe.' })
	orderId!: string | null;

	@ApiProperty({ enum: movementTypeEnum.enumValues, description: 'Tipo de movimiento de inventario.' })
	movementType!: (typeof movementTypeEnum.enumValues)[number];

	@ApiProperty({ minimum: 1, description: 'Cantidad positiva de unidades del movimiento.' })
	quantity!: number;

	@ApiProperty({ description: 'Motivo registrado para el movimiento.' })
	reason!: string;

	@ApiProperty({ nullable: true, format: 'uuid', description: 'Identificador lógico del responsable, cuando se registró.' })
	performedBy!: string | null;

	@ApiProperty({ format: 'date-time', description: 'Fecha de creación del movimiento.' })
	createdAt!: Date;
}