import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { CATALOG_CLIENT } from './constants/catalog-client.constants.js';
import { CatalogProductStatus } from './constants/catalog-client.constants.js';
import { CatalogClientModule } from './catalog-client.module.js';
import { CatalogClientService } from './catalog-client.service.js';
import type { CatalogClient } from './interfaces/catalog-client.interface.js';

describe('CatalogClientService', () => {
	const variantId = 'a9bd7a99-f700-4b79-bcdd-b2d850e5f87d';
	const variant = {
		id: variantId,
		productId: '4ba4e69b-52a0-4790-8d90-bdb636b568c2',
		productName: 'Whisky',
		variantName: '750 ml',
		sku: 'WHISKY-750',
		priceCop: '120000',
		productStatus: CatalogProductStatus.PUBLISHED,
		isActive: true,
		isPurchasable: true,
	};
	const config = {
		baseUrl: 'http://catalog.local',
		token: 'test-service-token',
		timeoutMs: 1000,
	};

	it('fetches and validates the internal Catalog contract', async () => {
		const transport = { fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(variant))) };
		const service = new CatalogClientService(config, transport);

		await expect(service.getVariant(variantId)).resolves.toEqual(variant);
		expect(transport.fetch).toHaveBeenCalledWith(
			new URL(`/internal/v1/variants/${variantId}`, 'http://catalog.local'),
			expect.objectContaining({
				method: 'GET',
				headers: { authorization: 'Bearer test-service-token' },
				signal: expect.any(AbortSignal),
			}),
		);
	});

	it('allows inactive variants for historical inventory operations', async () => {
		const inactiveVariant = { ...variant, isActive: false, isPurchasable: false };
		const transport = { fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(inactiveVariant))) };
		const service = new CatalogClientService(config, transport);

		await expect(service.getVariant(variantId)).resolves.toEqual(inactiveVariant);
	});

	it('rejects missing variants', async () => {
		const transport = { fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })) };
		const service = new CatalogClientService(config, transport);

		await expect(service.getVariant(variantId)).rejects.toMatchObject({ status: 404 });
	});

	it('fails closed on malformed or inconsistent responses', async () => {
		const transport = { fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...variant, isPurchasable: false }))) };
		const service = new CatalogClientService(config, transport);

		await expect(service.getVariant(variantId)).rejects.toMatchObject({ status: 502 });
	});

	it('reports Catalog transport failures as unavailable', async () => {
		const transport = { fetch: vi.fn().mockRejectedValue(new Error('timeout')) };
		const service = new CatalogClientService(config, transport);

		await expect(service.getVariant(variantId)).rejects.toMatchObject({ status: 503 });
	});

	it('rejects invalid input without calling Catalog', async () => {
		const transport = { fetch: vi.fn() };
		const service = new CatalogClientService(config, transport);

		await expect(service.getVariant('invalid')).rejects.toMatchObject({ status: 400 });
		expect(transport.fetch).not.toHaveBeenCalled();
	});

	it('rejects a response for a different variant', async () => {
		const transport = {
			fetch: vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ ...variant, id: variant.productId })),
			),
		};
		const service = new CatalogClientService(config, transport);

		await expect(service.getVariant(variantId)).rejects.toMatchObject({ status: 502 });
	});

	it('rejects malformed JSON and unsuccessful service responses', async () => {
		const transport = {
			fetch: vi.fn()
				.mockResolvedValueOnce(new Response('not json'))
				.mockResolvedValueOnce(new Response(null, { status: 401 })),
		};
		const service = new CatalogClientService(config, transport);

		await expect(service.getVariant(variantId)).rejects.toMatchObject({ status: 502 });
		await expect(service.getVariant(variantId)).rejects.toMatchObject({ status: 502 });
	});

	it('injects the client and calls the real HTTP transport', async () => {
		const token = 'local-test-catalog-token-0000000000';
		const handler = vi.fn((request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => {
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end(JSON.stringify(variant));
		});
		const server = createServer(handler);
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const address = server.address() as AddressInfo;
		try {
			const module = await Test.createTestingModule({ imports: [CatalogClientModule] })
				.overrideProvider(ConfigService)
				.useValue(new ConfigService({
					CATALOG_API_URL: `http://127.0.0.1:${address.port}`,
					CATALOG_SERVICE_TOKEN: token,
				}))
				.compile();
			try {
				const client = module.get<CatalogClient>(CATALOG_CLIENT);
				await expect(client.getVariant(variantId)).resolves.toEqual(variant);
				const request = handler.mock.calls[0]?.[0];
				expect(request?.url).toBe(`/internal/v1/variants/${variantId}`);
				expect(request?.headers.authorization).toBe(`Bearer ${token}`);
			} finally {
				await module.close();
			}
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		}
	});
});