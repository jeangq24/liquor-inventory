import {
	BadGatewayException,
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
	CATALOG_CLIENT_OPTIONS,
	CATALOG_HTTP_TRANSPORT,
	CatalogProductStatus,
	MAX_CATALOG_PRICE_COP,
	MAX_CATALOG_PRODUCT_NAME_LENGTH,
	MAX_CATALOG_SKU_LENGTH,
	MAX_CATALOG_VARIANT_NAME_LENGTH,
} from './constants/catalog-client.constants.js';
import type {
	CatalogClient,
	CatalogClientOptions,
	CatalogHttpTransport,
	CatalogVariant,
} from './interfaces/catalog-client.interface.js';

@Injectable()
export class CatalogClientService implements CatalogClient {
	private readonly baseUrl: string;
	private readonly token: string;
	private readonly timeoutMs: number;

	constructor(
		@Inject(CATALOG_CLIENT_OPTIONS) options: CatalogClientOptions,
		@Inject(CATALOG_HTTP_TRANSPORT)
		private readonly transport: CatalogHttpTransport,
	) {
		this.baseUrl = options.baseUrl;
		this.token = options.token;
		this.timeoutMs = options.timeoutMs;
	}

	async getVariant(variantId: string): Promise<CatalogVariant> {
		if (!isUUID(variantId, '4')) {
			throw new BadRequestException('Catalog variant ID must be a UUID v4');
		}

		let response: Response;
		try {
			response = await this.transport.fetch(
				new URL(`/internal/v1/variants/${encodeURIComponent(variantId)}`, this.baseUrl),
				{
					method: 'GET',
					headers: { authorization: `Bearer ${this.token}` },
					signal: AbortSignal.timeout(this.timeoutMs),
				},
			);
		} catch (error: unknown) {
			throw new ServiceUnavailableException('Catalog service is unavailable', {
				cause: error,
			});
		}

		if (response.status === 404) {
			throw new NotFoundException(`Catalog variant ${variantId} was not found`);
		}
		if (!response.ok) {
			throw new BadGatewayException(
				`Catalog service rejected the request with status ${response.status}`,
			);
		}

		let payload: unknown;
		try {
			payload = await response.json();
		} catch (error: unknown) {
			throw new BadGatewayException('Catalog returned invalid JSON', { cause: error });
		}

		return this.parseVariant(payload, variantId);
	}

	private parseVariant(payload: unknown, variantId: string): CatalogVariant {
		if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
			throw new BadGatewayException('Catalog returned an invalid variant');
		}

		const data = payload as Record<string, unknown>;
		if (
			data.id !== variantId ||
			typeof data.productId !== 'string' ||
			!isUUID(data.productId, '4') ||
			typeof data.productName !== 'string' ||
			!data.productName.trim() ||
			data.productName.length > MAX_CATALOG_PRODUCT_NAME_LENGTH ||
			typeof data.variantName !== 'string' ||
			!data.variantName.trim() ||
			data.variantName.length > MAX_CATALOG_VARIANT_NAME_LENGTH ||
			typeof data.sku !== 'string' ||
			!data.sku.trim() ||
			data.sku.length > MAX_CATALOG_SKU_LENGTH ||
			typeof data.priceCop !== 'string' ||
			!/^[1-9][0-9]{0,18}$/.test(data.priceCop) ||
			BigInt(data.priceCop) > MAX_CATALOG_PRICE_COP ||
			typeof data.isActive !== 'boolean' ||
			typeof data.isPurchasable !== 'boolean' ||
			!Object.values(CatalogProductStatus).some((status) => status === data.productStatus) ||
			data.isPurchasable !==
				(data.isActive && data.productStatus === CatalogProductStatus.PUBLISHED)
		) {
			throw new BadGatewayException('Catalog returned an invalid variant');
		}

		return {
			id: variantId,
			productId: data.productId,
			productName: data.productName,
			variantName: data.variantName,
			sku: data.sku,
			priceCop: data.priceCop,
			productStatus: data.productStatus as CatalogProductStatus,
			isActive: data.isActive,
			isPurchasable: data.isPurchasable,
		};
	}
}