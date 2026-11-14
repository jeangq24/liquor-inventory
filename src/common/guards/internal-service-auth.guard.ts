import { timingSafeEqual } from 'node:crypto';
import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface InternalRequest {
	headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class InternalServiceAuthGuard implements CanActivate {
	constructor(private readonly configService: ConfigService) {}

	canActivate(context: ExecutionContext): boolean {
		const configuredToken = this.configService.get<string>('INTERNAL_API_TOKEN');
		const request = context.switchToHttp().getRequest<InternalRequest>();
		const authorization = request.headers.authorization;

		if (!configuredToken || typeof authorization !== 'string') {
			throw new UnauthorizedException('Internal service authentication required');
		}

		const match = /^Bearer\s+(.+)$/i.exec(authorization);
		if (!match?.[1]) {
			throw new UnauthorizedException('Internal service authentication required');
		}

		const expected = Buffer.from(configuredToken);
		const received = Buffer.from(match[1]);
		if (
			expected.length !== received.length ||
			!timingSafeEqual(expected, received)
		) {
			throw new UnauthorizedException('Invalid internal service token');
		}

		return true;
	}
}