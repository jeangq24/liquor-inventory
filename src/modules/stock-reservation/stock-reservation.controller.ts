import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiHeader,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InternalPermissionGuard } from '../../common/guards/internal-permission.guard.js';
import { InternalServiceAuthGuard } from '../../common/guards/internal-service-auth.guard.js';
import { ActorId } from '../../common/security/actor-id.decorator.js';
import { RequirePermissions } from '../../common/security/require-permissions.decorator.js';
import {
	DispatchStockDto,
	ReleaseStockDto,
	ReserveStockDto,
} from './dto/stock-reservation.dto.js';
import {
	StockReservationHistoryResponseDto,
	StockReservationResponseDto,
} from './dto/stock-reservation-response.dto.js';
import {
	StockReservationService,
	type StockReservationResult,
} from './stock-reservation.service.js';

@ApiTags('Reservas de existencias')
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
@Controller('internal/v1/stock/reservations')
export class StockReservationController {
	constructor(private readonly reservationService: StockReservationService) {}

	@Post()
	@RequirePermissions('inventory.stock.reserve')
	@ApiOperation({ summary: 'Reservar existencias de un pedido de forma atómica' })
	@ApiCreatedResponse({ type: StockReservationResponseDto, description: 'Reserva y cantidades asociadas.' })
	@ApiConflictResponse({ description: 'No hay existencias suficientes, existe una reserva activa o la clave se usó con otros datos.' })
	async reserve(@Body() body: ReserveStockDto) {
		const result = await this.reservationService.reserve(body);
		return this.toResponse(result);
	}

	@Post(':orderId/release')
	@RequirePermissions('inventory.stock.release')
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'UUID v4 del operador proporcionado por el servicio confiable.' })
	@ApiParam({ name: 'orderId', description: 'Identificador UUID v4 del pedido.' })
	@ApiOperation({ summary: 'Liberar la reserva activa de un pedido' })
	@ApiCreatedResponse({ type: StockReservationResponseDto, description: 'Reserva liberada.' })
	@ApiNotFoundResponse({ description: 'No se encontró una reserva para el pedido.' })
	@ApiConflictResponse({ description: 'No hay una reserva activa, el balance es inconsistente o la clave se usó con otros datos.' })
	async release(
		@Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
		@Body() body: ReleaseStockDto,
		@ActorId(new ParseUUIDPipe({ version: '4' })) actorId: string,
	) {
		const result = await this.reservationService.release(orderId, {
			idempotencyKey: body.idempotencyKey,
			reason: body.reason,
			performedBy: actorId,
		});
		return this.toResponse(result);
	}

	@Post(':orderId/dispatch')
	@RequirePermissions('inventory.stock.dispatch')
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'UUID v4 del operador proporcionado por el servicio confiable.' })
	@ApiParam({ name: 'orderId', description: 'Identificador UUID v4 del pedido.' })
	@ApiOperation({ summary: 'Despachar la reserva activa de un pedido' })
	@ApiCreatedResponse({ type: StockReservationResponseDto, description: 'Reserva despachada.' })
	@ApiNotFoundResponse({ description: 'No se encontró una reserva para el pedido.' })
	@ApiConflictResponse({ description: 'No hay una reserva activa, las cantidades son insuficientes o la clave se usó con otros datos.' })
	async dispatch(
		@Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
		@Body() body: DispatchStockDto,
		@ActorId(new ParseUUIDPipe({ version: '4' })) actorId: string,
	) {
		const result = await this.reservationService.dispatch(orderId, {
			idempotencyKey: body.idempotencyKey,
			performedBy: actorId,
		});
		return this.toResponse(result);
	}

	@Get('orders/:orderId')
	@RequirePermissions('inventory.stock.read')
	@ApiOperation({ summary: 'Consultar el historial de reservas de un pedido' })
	@ApiParam({ name: 'orderId', description: 'Identificador UUID v4 del pedido.' })
	@ApiOkResponse({ type: [StockReservationHistoryResponseDto], description: 'Historial de reservas del pedido.' })
	async getByOrder(
		@Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
	) {
		const reservations = await this.reservationService.getByOrder(orderId);
		return reservations.map(({ reservation, items }) => ({
			reservationId: reservation.id,
			orderId: reservation.orderId,
			locationId: reservation.locationId,
			status: reservation.status,
			items: items.map((item) => ({
				variantId: item.variantId,
				quantity: item.quantity,
			})),
			reservedAt: reservation.reservedAt,
			releasedAt: reservation.releasedAt,
			dispatchedAt: reservation.dispatchedAt,
			createdAt: reservation.createdAt,
			updatedAt: reservation.updatedAt,
		}));
	}

	private toResponse(result: StockReservationResult): StockReservationResponseDto {
		return {
			reservationId: result.reservation.id,
			orderId: result.reservation.orderId,
			locationId: result.reservation.locationId,
			status: result.reservation.status,
			items: result.items.map((item) => ({
				variantId: item.variantId,
				quantity: item.quantity,
			})),
		};
	}
}