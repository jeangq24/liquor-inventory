import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@ApiTags('Servicio')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar la respuesta inicial del servicio' })
  @ApiOkResponse({ type: String, description: 'Respuesta de texto del servicio.' })
  getHello(): string {
    return this.appService.getHello();
  }
}
