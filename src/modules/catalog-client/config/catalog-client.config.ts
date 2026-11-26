import { ConfigService } from '@nestjs/config';
import { plainToInstance, Type } from 'class-transformer';
import {
	IsInt,
	IsString,
	IsUrl,
	Matches,
	Max,
	Min,
	MinLength,
	validateSync,
} from 'class-validator';
import {
	DEFAULT_CATALOG_TIMEOUT_MS,
	MAX_CATALOG_TIMEOUT_MS,
	MIN_CATALOG_SERVICE_TOKEN_LENGTH,
} from '../constants/catalog-client.constants.js';
import type { CatalogClientOptions } from '../interfaces/catalog-client.interface.js';

class CatalogClientConfigSchema {
	@IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] })
	CATALOG_API_URL!: string;

	@IsString()
	@MinLength(MIN_CATALOG_SERVICE_TOKEN_LENGTH)
	@Matches(/^\S+$/)
	CATALOG_SERVICE_TOKEN!: string;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(MAX_CATALOG_TIMEOUT_MS)
	CATALOG_TIMEOUT_MS!: number;
}

export function getCatalogClientOptions(config: ConfigService): CatalogClientOptions {
	const options = plainToInstance(CatalogClientConfigSchema, {
		CATALOG_API_URL: config.get<string>('CATALOG_API_URL'),
		CATALOG_SERVICE_TOKEN: config.get<string>('CATALOG_SERVICE_TOKEN'),
		CATALOG_TIMEOUT_MS: config.get<string>(
			'CATALOG_TIMEOUT_MS',
			String(DEFAULT_CATALOG_TIMEOUT_MS),
		),
	});
	const errors = validateSync(options);
	if (errors.length > 0) {
		throw new Error(`Invalid Catalog configuration: ${errors.map((error) => error.property).join(', ')}`);
	}

	return {
		baseUrl: options.CATALOG_API_URL,
		token: options.CATALOG_SERVICE_TOKEN,
		timeoutMs: options.CATALOG_TIMEOUT_MS,
	};
}