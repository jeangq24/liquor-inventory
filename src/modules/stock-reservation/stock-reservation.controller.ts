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

@ApiTags('Stock reservations')
@ApiBearerAuth('internal-service-token')
@ApiHeader({
	name: 'x-actor-permissions',
	required: true,
	description: 'Permissions resolved by the trusted caller after Supabase authorization',
})
@UseGuards(InternalServiceAuthGuard, InternalPermissionGuard)
@Controller('internal/v1/stock/reservations')
export class StockReservationController {
	constructor(private readonly reservationService: StockReservationService) {}

	@Post()
	@RequirePermissions('inventory.stock.reserve')
	@ApiOperation({ summary: 'Reserve stock for an order atomically' })
	@ApiCreatedResponse({ type: StockReservationResponseDto, description: 'Active reservation and reserved items' })
	async reserve(@Body() body: ReserveStockDto) {
		const result = await this.reservationService.reserve(body);
		return this.toResponse(result);
	}

	@Post(':orderId/release')
	@RequirePermissions('inventory.stock.release')
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'Authenticated operator UUID from the trusted caller' })
	@ApiOperation({ summary: 'Release the active reservation for an order' })
	@ApiOkResponse({ type: StockReservationResponseDto, description: 'Released reservation' })
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
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'Authenticated operator UUID from the trusted caller' })
	@ApiOperation({ summary: 'Dispatch the active reservation for an order' })
	@ApiOkResponse({ type: StockReservationResponseDto, description: 'Dispatched reservation' })
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
	@ApiOperation({ summary: 'Get reservation history for an order' })
	@ApiOkResponse({ type: [StockReservationHistoryResponseDto], description: 'Reservation history for the order' })
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