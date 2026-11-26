import { ConfigService } from '@nestjs/config';
import { DEFAULT_CATALOG_TIMEOUT_MS } from '../constants/catalog-client.constants.js';
import { getCatalogClientOptions } from './catalog-client.config.js';

describe('Catalog client configuration', () => {
	const validConfig = {
		CATALOG_API_URL: 'http://localhost:3002',
		CATALOG_SERVICE_TOKEN: 'test-catalog-service-token-00000000',
	};

	it('uses a bounded default timeout for valid settings', () => {
		const options = getCatalogClientOptions(new ConfigService(validConfig));
		expect(options.baseUrl).toBe(validConfig.CATALOG_API_URL);
		expect(options.timeoutMs).toBe(DEFAULT_CATALOG_TIMEOUT_MS);
	});

	it.each([
		{ CATALOG_API_URL: 'not-a-url' },
		{ CATALOG_SERVICE_TOKEN: '' },
		{ CATALOG_SERVICE_TOKEN: 'short' },
		{ CATALOG_TIMEOUT_MS: '0' },
		{ CATALOG_TIMEOUT_MS: '999999999999' },
		{ CATALOG_TIMEOUT_MS: 'invalid' },
	])('rejects invalid settings without exposing secrets', (overrides) => {
		const secret = validConfig.CATALOG_SERVICE_TOKEN;
		const config = new ConfigService({ ...validConfig, ...overrides });
		expect(() => getCatalogClientOptions(config)).toThrow('Invalid Catalog configuration');
		try {
			getCatalogClientOptions(config);
		} catch (error: unknown) {
			expect(String(error)).not.toContain(secret);
		}
	});
});