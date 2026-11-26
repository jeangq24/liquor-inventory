import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CatalogClientService } from './catalog-client.service.js';
import { getCatalogClientOptions } from './config/catalog-client.config.js';
import {
	CATALOG_CLIENT,
	CATALOG_CLIENT_OPTIONS,
	CATALOG_HTTP_TRANSPORT,
} from './constants/catalog-client.constants.js';
import type { CatalogHttpTransport } from './interfaces/catalog-client.interface.js';

@Module({
	imports: [ConfigModule],
	providers: [
		{
			provide: CATALOG_CLIENT_OPTIONS,
			inject: [ConfigService],
			useFactory: getCatalogClientOptions,
		},
		{
			provide: CATALOG_HTTP_TRANSPORT,
			useValue: {
				fetch: (url: URL, options: RequestInit) => fetch(url, options),
			} satisfies CatalogHttpTransport,
		},
		CatalogClientService,
		{ provide: CATALOG_CLIENT, useExisting: CatalogClientService },
	],
	exports: [CATALOG_CLIENT],
})
export class CatalogClientModule {}