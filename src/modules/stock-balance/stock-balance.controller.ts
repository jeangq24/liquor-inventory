import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Query,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiHeader,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InternalPermissionGuard } from '../../common/guards/internal-permission.guard.js';
import { InternalServiceAuthGuard } from '../../common/guards/internal-service-auth.guard.js';
import { RequirePermissions } from '../../common/security/require-permissions.decorator.js';
import { GetStockAvailabilityDto, GetStockByLocationDto } from './dto/get-stock-availability.dto.js';
import { StockBalanceResponseDto } from './dto/stock-balance-response.dto.js';
import { StockBalanceService } from './stock-balance.service.js';

interface StockBalanceLike {
	id: string | null;
	locationId: string;
	variantId: string;
	quantityOnHand: number;
	quantityReserved: number;
	quantityAvailable?: number;
	updatedAt: Date | null;
}

interface StockBalanceResponse extends StockBalanceLike {
	quantityAvailable: number;
}

@ApiTags('Existencias')
@ApiBearerAuth('internal-service-token')
@ApiUnauthorizedResponse({ description: 'Falta la credencial interna o no es válida.' })
@ApiForbiddenResponse({ description: 'El solicitante no dispone del permiso requerido.' })
@ApiBadRequestResponse({ description: 'Los parámetros de la solicitud no son válidos.' })
@ApiHeader({
	name: 'x-actor-permissions',
	required: true,
	description: 'Permisos separados por comas, resueltos por el servicio confiable tras la autorización.',
})
@UseGuards(InternalServiceAuthGuard, InternalPermissionGuard)
@Controller('internal/v1/stock')
export class StockBalanceController {
	constructor(private readonly balanceService: StockBalanceService) {}

	@Get('availability')
	@RequirePermissions('inventory.stock.read')
	@ApiOperation({ summary: 'Consultar la disponibilidad de variantes en una ubicación' })
	@ApiOkResponse({ type: [StockBalanceResponseDto], description: 'Disponibilidad; las variantes sin balance se devuelven con cantidades en cero.' })
	async getAvailability(@Query() query: GetStockAvailabilityDto) {
		const balances = await this.balanceService.getAvailability(
			query.locationId,
			query.variantIds,
		);
		return balances.map((balance) => this.toResponse(balance));
	}

	@Get('balances')
	@RequirePermissions('inventory.stock.read')
	@ApiOperation({ summary: 'Consultar los balances de una ubicación' })
	@ApiOkResponse({ type: [StockBalanceResponseDto], description: 'Balances de la ubicación solicitada.' })
	async getByLocation(@Query() query: GetStockByLocationDto) {
		const balances = await this.balanceService.getByLocation(query.locationId);
		return balances.map((balance) => this.toResponse(balance));
	}

	@Get('variants/:variantId')
	@RequirePermissions('inventory.stock.read')
	@ApiOperation({ summary: 'Consultar los balances de una variante en las ubicaciones' })
	@ApiParam({ name: 'variantId', description: 'Identificador UUID v4 de la variante.' })
	@ApiOkResponse({ type: [StockBalanceResponseDto], description: 'Balances de la variante solicitada.' })
	async getByVariant(@Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string) {
		const balances = await this.balanceService.getByVariant(variantId);
		return balances.map((balance) => this.toResponse(balance));
	}

	private toResponse(balance: StockBalanceLike): StockBalanceResponse {
		return {
			id: balance.id,
			locationId: balance.locationId,
			variantId: balance.variantId,
			quantityOnHand: balance.quantityOnHand,
			quantityReserved: balance.quantityReserved,
			quantityAvailable:
				balance.quantityAvailable ??
				(balance.quantityOnHand - balance.quantityReserved),
			updatedAt: balance.updatedAt,
		};
	}
}