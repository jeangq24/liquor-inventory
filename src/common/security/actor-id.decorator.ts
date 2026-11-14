import {
	createParamDecorator,
	ExecutionContext,
	UnauthorizedException,
} from '@nestjs/common';

interface InternalRequest {
	headers: Record<string, string | string[] | undefined>;
}

export const ActorId = createParamDecorator(
	(_data: unknown, context: ExecutionContext): string => {
		const request = context.switchToHttp().getRequest<InternalRequest>();
		const actorId = request.headers['x-actor-id'];
		if (typeof actorId !== 'string') {
			throw new UnauthorizedException('Trusted actor context is required');
		}
		return actorId;
	},
);