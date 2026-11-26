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
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiHeader,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
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

@ApiTags('Movimientos de inventario')
@ApiBearerAuth('internal-service-token')
@ApiUnauthorizedResponse({ description: 'Falta la credencial interna o el contexto del actor, o no son válidos.' })
@ApiForbiddenResponse({ description: 'El solicitante no dispone del permiso requerido.' })
@ApiBadRequestResponse({ description: 'Los datos de la solicitud no son válidos.' })
@ApiHeader({
	name: 'x-actor-permissions',
	required: true,
	description: 'Permisos separados por comas, resueltos por el servicio confiable tras la autorización.',
})
@UseGuards(InternalServiceAuthGuard, InternalPermissionGuard)
@Controller('internal/v1/stock/movements')
export class StockMovementController {
	constructor(private readonly movementService: StockMovementService) {}

	@Post('entries')
	@RequirePermissions('inventory.stock.adjust')
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'UUID v4 del operador proporcionado por el servicio confiable.' })
	@ApiOperation({ summary: 'Registrar una entrada física de existencias' })
	@ApiCreatedResponse({ type: [StockMovementResponseDto], description: 'Movimientos de entrada registrados.' })
	@ApiConflictResponse({ description: 'La clave de idempotencia ya se utilizó con otros datos o no se pudo bloquear el balance.' })
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
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'UUID v4 del operador proporcionado por el servicio confiable.' })
	@ApiOperation({ summary: 'Registrar un ajuste justificado de existencias' })
	@ApiCreatedResponse({ type: [StockMovementResponseDto], description: 'Movimientos de ajuste registrados.' })
	@ApiConflictResponse({ description: 'El ajuste excede las existencias disponibles o la clave de idempotencia ya se utilizó con otros datos.' })
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
	@ApiOperation({ summary: 'Consultar el historial de movimientos de inventario' })
	@ApiOkResponse({ type: [StockMovementResponseDto], description: 'Historial de movimientos según los filtros solicitados.' })
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