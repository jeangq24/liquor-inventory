import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { InternalPermissionGuard } from './internal-permission.guard.js';
import { InternalServiceAuthGuard } from './internal-service-auth.guard.js';

const createContext = (headers: Record<string, string | undefined>) =>
	({
		switchToHttp: () => ({ getRequest: () => ({ headers }) }),
		getHandler: () => ({}),
		getClass: () => ({}),
	}) as unknown as ExecutionContext;

describe('InternalServiceAuthGuard', () => {
	it('allows a request with the configured bearer token', () => {
		const configService = { get: vi.fn().mockReturnValue('service-secret') };
		const guard = new InternalServiceAuthGuard(
			configService as unknown as ConfigService,
		);

		expect(
			guard.canActivate(
				createContext({ authorization: 'Bearer service-secret' }),
			),
		).toBe(true);
	});

	it('rejects missing and invalid tokens', () => {
		const configService = { get: vi.fn().mockReturnValue('service-secret') };
		const guard = new InternalServiceAuthGuard(
			configService as unknown as ConfigService,
		);

		expect(() => guard.canActivate(createContext({}))).toThrow(
			UnauthorizedException,
		);
		expect(() =>
			guard.canActivate(createContext({ authorization: 'Bearer wrong-token' })),
		).toThrow(UnauthorizedException);
	});
});

describe('InternalPermissionGuard', () => {
	const createGuard = (permissions: string[]) => {
		const reflector = {
			getAllAndOverride: vi.fn().mockReturnValue(permissions),
		};
		return new InternalPermissionGuard(reflector as unknown as Reflector);
	};

	it('allows a request when all required permissions are forwarded', () => {
		const guard = createGuard(['inventory.stock.adjust']);

		expect(
			guard.canActivate(
				createContext({
					'x-actor-permissions': 'inventory.stock.read, inventory.stock.adjust',
				}),
			),
		).toBe(true);
	});

	it('denies a request when a required permission is absent', () => {
		const guard = createGuard(['inventory.stock.return']);

		expect(() =>
			guard.canActivate(
				createContext({ 'x-actor-permissions': 'inventory.stock.read' }),
			),
		).toThrow(ForbiddenException);
	});
});