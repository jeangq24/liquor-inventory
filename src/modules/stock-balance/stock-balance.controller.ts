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
	ApiHeader,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
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

@ApiTags('Inventory stock')
@ApiBearerAuth('internal-service-token')
@ApiHeader({
	name: 'x-actor-permissions',
	required: true,
	description: 'Permissions resolved by the trusted caller after Supabase authorization',
})
@UseGuards(InternalServiceAuthGuard, InternalPermissionGuard)
@Controller('internal/v1/stock')
export class StockBalanceController {
	constructor(private readonly balanceService: StockBalanceService) {}

	@Get('availability')
	@RequirePermissions('inventory.stock.read')
	@ApiOperation({ summary: 'Get availability for requested variants at a location' })
	@ApiOkResponse({ type: [StockBalanceResponseDto], description: 'Availability, including zero balances for missing variants' })
	async getAvailability(@Query() query: GetStockAvailabilityDto) {
		const balances = await this.balanceService.getAvailability(
			query.locationId,
			query.variantIds,
		);
		return balances.map((balance) => this.toResponse(balance));
	}

	@Get('balances')
	@RequirePermissions('inventory.stock.read')
	@ApiOperation({ summary: 'Get all stock balances at a location' })
	@ApiOkResponse({ type: [StockBalanceResponseDto], description: 'Stock balances for the requested location' })
	async getByLocation(@Query() query: GetStockByLocationDto) {
		const balances = await this.balanceService.getByLocation(query.locationId);
		return balances.map((balance) => this.toResponse(balance));
	}

	@Get('variants/:variantId')
	@RequirePermissions('inventory.stock.read')
	@ApiOperation({ summary: 'Get stock balances for a variant across locations' })
	@ApiOkResponse({ type: [StockBalanceResponseDto], description: 'Stock balances for the requested variant' })
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