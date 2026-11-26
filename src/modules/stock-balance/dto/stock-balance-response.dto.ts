import { ApiProperty } from '@nestjs/swagger';

export class StockBalanceResponseDto {
	@ApiProperty({ nullable: true, format: 'uuid', description: 'Identificador del balance; es nulo cuando no existe un registro.' })
	id!: string | null;

	@ApiProperty({ format: 'uuid', description: 'Identificador de la ubicación.' })
	locationId!: string;

	@ApiProperty({ format: 'uuid', description: 'Identificador lógico de la variante.' })
	variantId!: string;

	@ApiProperty({ minimum: 0, description: 'Cantidad física existente.' })
	quantityOnHand!: number;

	@ApiProperty({ minimum: 0, description: 'Cantidad reservada para pedidos.' })
	quantityReserved!: number;

	@ApiProperty({ minimum: 0, description: 'Cantidad disponible: existencia física menos cantidad reservada.' })
	quantityAvailable!: number;

	@ApiProperty({ nullable: true, format: 'date-time', description: 'Fecha de actualización; es nula cuando no existe un balance.' })
	updatedAt!: Date | null;
}