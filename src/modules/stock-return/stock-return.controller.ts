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
import { RegisterStockReturnDto } from './dto/register-stock-return.dto.js';
import { StockReturnResponseDto } from './dto/stock-return-response.dto.js';
import { StockReturnService } from './stock-return.service.js';

@ApiTags('Stock returns')
@ApiBearerAuth('internal-service-token')
@ApiHeader({
	name: 'x-actor-permissions',
	required: true,
	description: 'Permissions resolved by the trusted caller after Supabase authorization',
})
@UseGuards(InternalServiceAuthGuard, InternalPermissionGuard)
@Controller('internal/v1/stock/returns')
export class StockReturnController {
	constructor(private readonly returnService: StockReturnService) {}

	@Post()
	@RequirePermissions('inventory.stock.return')
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'Authenticated receiver UUID from the trusted caller' })
	@ApiOperation({ summary: 'Register and process a physically verified return' })
	@ApiCreatedResponse({ type: StockReturnResponseDto, description: 'Processed return with received and restockable quantities' })
	async registerReturn(
		@Body() body: RegisterStockReturnDto,
		@ActorId(new ParseUUIDPipe({ version: '4' })) actorId: string,
	) {
		const result = await this.returnService.registerReturn({
			orderId: body.orderId,
			locationId: body.locationId,
			deliveryAttemptId: body.deliveryAttemptId,
			idempotencyKey: body.idempotencyKey,
			reason: body.reason,
			items: body.items.map((item) => ({
				variantId: item.variantId,
				quantityReceived: item.quantityReceived,
				quantityRestockable: item.quantityRestockable,
				reason: item.reason,
			})),
			receivedBy: actorId,
		});
		return {
			returnId: result.stockReturn.id,
			orderId: result.stockReturn.orderId,
			locationId: result.stockReturn.locationId,
			deliveryAttemptId: result.stockReturn.deliveryAttemptId,
			status: result.stockReturn.status,
			reason: result.stockReturn.reason,
			receivedBy: result.stockReturn.receivedBy,
			receivedAt: result.stockReturn.receivedAt,
			processedAt: result.stockReturn.processedAt,
			items: result.items.map((item) => ({
				variantId: item.variantId,
				quantityReceived: item.quantityReceived,
				quantityRestockable: item.quantityRestockable,
				reason: item.reason,
			})),
		};
	}

	@Get('orders/:orderId')
	@RequirePermissions('inventory.stock.read')
	@ApiOperation({ summary: 'Get verified returns for an order' })
	@ApiOkResponse({ type: [StockReturnResponseDto], description: 'Return history for the order' })
	async getByOrder(
		@Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
	) {
		const results = await this.returnService.getByOrder(orderId);
		return results.map(({ stockReturn, items }) => ({
			returnId: stockReturn.id,
			orderId: stockReturn.orderId,
			locationId: stockReturn.locationId,
			deliveryAttemptId: stockReturn.deliveryAttemptId,
			status: stockReturn.status,
			reason: stockReturn.reason,
			receivedBy: stockReturn.receivedBy,
			receivedAt: stockReturn.receivedAt,
			processedAt: stockReturn.processedAt,
			items: items.map((item) => ({
				variantId: item.variantId,
				quantityReceived: item.quantityReceived,
				quantityRestockable: item.quantityRestockable,
				reason: item.reason,
			})),
		}));
	}
}