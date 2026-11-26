import { Transform } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetStockAvailabilityDto {
	@ApiProperty({ type: [String], description: 'Entre 1 y 100 UUID v4 de variantes, en parámetros repetidos o separados por comas.' })
	@Transform(({ value }: { value: unknown }) => {
		if (Array.isArray(value)) {
			return value.flatMap((entry) =>
				typeof entry === 'string' ? entry.split(',') : [],
			);
		}
		return typeof value === 'string' ? value.split(',') : value;
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(100)
	@IsUUID('4', { each: true })
	variantIds!: string[];

	@ApiProperty({ description: 'UUID v4 de la ubicación.' })
	@IsUUID('4')
	locationId!: string;
}

export class GetStockByLocationDto {
	@ApiProperty({ description: 'UUID v4 de la ubicación.' })
	@IsUUID('4')
	locationId!: string;
}

export class GetStockByVariantDto {
	@ApiProperty({ description: 'UUID v4 de la variante.' })
	@IsUUID('4')
	variantId!: string;
}