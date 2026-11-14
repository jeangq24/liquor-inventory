import { Transform } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetStockAvailabilityDto {
	@ApiProperty({ type: [String], description: 'Variant UUIDs, repeated or comma-separated' })
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

	@ApiProperty()
	@IsUUID('4')
	locationId!: string;
}

export class GetStockByLocationDto {
	@ApiProperty()
	@IsUUID('4')
	locationId!: string;
}

export class GetStockByVariantDto {
	@ApiProperty()
	@IsUUID('4')
	variantId!: string;
}