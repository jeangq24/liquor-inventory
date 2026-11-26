import type { CatalogProductStatus } from '../constants/catalog-client.constants.js';

export interface CatalogVariant {
	readonly id: string;
	readonly productId: string;
	readonly productName: string;
	readonly variantName: string;
	readonly sku: string;
	readonly priceCop: string;
	readonly productStatus: CatalogProductStatus;
	readonly isActive: boolean;
	readonly isPurchasable: boolean;
}

export interface CatalogClient {
	getVariant(variantId: string): Promise<CatalogVariant>;
}

export interface CatalogHttpTransport {
	fetch(url: URL, options: RequestInit): Promise<Response>;
}

export interface CatalogClientOptions {
	readonly baseUrl: string;
	readonly token: string;
	readonly timeoutMs: number;
}