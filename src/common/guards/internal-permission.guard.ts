import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS } from '../security/require-permissions.decorator.js';

interface InternalRequest {
	headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class InternalPermissionGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredPermissions =
			this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
				context.getHandler(),
				context.getClass(),
			]) ?? [];
		if (requiredPermissions.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest<InternalRequest>();
		const permissionHeader = request.headers['x-actor-permissions'];
		const actorPermissions = new Set(
			(typeof permissionHeader === 'string' ? permissionHeader : '')
				.split(',')
				.map((permission) => permission.trim())
				.filter(Boolean),
		);

		if (!requiredPermissions.every((permission) => actorPermissions.has(permission))) {
			throw new ForbiddenException('Actor is missing a required inventory permission');
		}

		return true;
	}
}