import {
	Body,
	Controller,
	Get,
	ParseUUIDPipe,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiHeader,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { InternalPermissionGuard } from '../../common/guards/internal-permission.guard.js';
import { InternalServiceAuthGuard } from '../../common/guards/internal-service-auth.guard.js';
import { ActorId } from '../../common/security/actor-id.decorator.js';
import { RequirePermissions } from '../../common/security/require-permissions.decorator.js';
import {
	GetStockMovementHistoryDto,
	RegisterStockAdjustmentDto,
	StockChangeDto,
} from './dto/stock-movement.dto.js';
import { StockMovementResponseDto } from './dto/stock-movement-response.dto.js';
import { StockMovementService } from './stock-movement.service.js';

@ApiTags('Stock movements')
@ApiBearerAuth('internal-service-token')
@ApiHeader({
	name: 'x-actor-permissions',
	required: true,
	description: 'Permissions resolved by the trusted caller after Supabase authorization',
})
@UseGuards(InternalServiceAuthGuard, InternalPermissionGuard)
@Controller('internal/v1/stock/movements')
export class StockMovementController {
	constructor(private readonly movementService: StockMovementService) {}

	@Post('entries')
	@RequirePermissions('inventory.stock.adjust')
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'Authenticated operator UUID from the trusted caller' })
	@ApiOperation({ summary: 'Register a physical stock entry' })
	@ApiCreatedResponse({ type: [StockMovementResponseDto], description: 'Created immutable IN movements' })
	async registerEntry(
		@Body() body: StockChangeDto,
		@ActorId(new ParseUUIDPipe({ version: '4' })) actorId: string,
	) {
		const movements = await this.movementService.registerEntry({
			locationId: body.locationId,
			idempotencyKey: body.idempotencyKey,
			reason: body.reason,
			items: body.items.map((item) => ({
				variantId: item.variantId,
				quantity: item.quantity,
			})),
			performedBy: actorId,
		});
		return movements.map((movement) => this.toResponse(movement));
	}

	@Post('adjustments')
	@RequirePermissions('inventory.stock.adjust')
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'Authenticated operator UUID from the trusted caller' })
	@ApiOperation({ summary: 'Register a justified stock adjustment' })
	@ApiCreatedResponse({ type: [StockMovementResponseDto], description: 'Created immutable adjustment movements' })
	async registerAdjustment(
		@Body() body: RegisterStockAdjustmentDto,
		@ActorId(new ParseUUIDPipe({ version: '4' })) actorId: string,
	) {
		const movements = await this.movementService.registerAdjustment({
			locationId: body.locationId,
			idempotencyKey: body.idempotencyKey,
			reason: body.reason,
			direction: body.direction,
			items: body.items.map((item) => ({
				variantId: item.variantId,
				quantity: item.quantity,
			})),
			performedBy: actorId,
		});
		return movements.map((movement) => this.toResponse(movement));
	}

	@Get()
	@RequirePermissions('inventory.movements.read')
	@ApiOperation({ summary: 'Query immutable stock movement history' })
	@ApiOkResponse({ type: [StockMovementResponseDto], description: 'Filtered stock movement history' })
	async getHistory(@Query() filters: GetStockMovementHistoryDto) {
		const movements = await this.movementService.getHistory(filters);
		return movements.map((movement) => this.toResponse(movement));
	}

	private toResponse(movement: Awaited<ReturnType<StockMovementService['getHistory']>>[number]) {
		return {
			id: movement.id,
			locationId: movement.locationId,
			variantId: movement.variantId,
			reservationId: movement.reservationId,
			stockReturnId: movement.stockReturnId,
			orderId: movement.orderId,
			movementType: movement.movementType,
			quantity: movement.quantity,
			reason: movement.reason,
			performedBy: movement.performedBy,
			createdAt: movement.createdAt,
		};
	}
}