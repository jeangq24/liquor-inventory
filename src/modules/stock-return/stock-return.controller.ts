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
import { RegisterStockReturnDto } from './dto/register-stock-return.dto.js';
import { StockReturnResponseDto } from './dto/stock-return-response.dto.js';
import { StockReturnService } from './stock-return.service.js';

@ApiTags('Devoluciones de inventario')
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
@Controller('internal/v1/stock/returns')
export class StockReturnController {
	constructor(private readonly returnService: StockReturnService) {}

	@Post()
	@RequirePermissions('inventory.stock.return')
	@ApiHeader({ name: 'x-actor-id', required: true, description: 'UUID v4 de quien recibe la devolución, proporcionado por el servicio confiable.' })
	@ApiOperation({ summary: 'Registrar y procesar una devolución verificada físicamente' })
	@ApiCreatedResponse({ type: StockReturnResponseDto, description: 'Devolución procesada con cantidades recibidas y reintegrables.' })
	@ApiConflictResponse({ description: 'La clave de idempotencia ya se utilizó con otros datos o la devolución no pudo procesarse.' })
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
	@ApiOperation({ summary: 'Consultar las devoluciones verificadas de un pedido' })
	@ApiParam({ name: 'orderId', description: 'Identificador UUID v4 del pedido.' })
	@ApiOkResponse({ type: [StockReturnResponseDto], description: 'Historial de devoluciones del pedido.' })
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