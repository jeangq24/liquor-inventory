import { Global, Module } from '@nestjs/common';
import { InternalPermissionGuard } from '../guards/internal-permission.guard.js';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard.js';

@Global()
@Module({
	providers: [InternalServiceAuthGuard, InternalPermissionGuard],
	exports: [InternalServiceAuthGuard, InternalPermissionGuard],
})
export class InternalSecurityModule {}