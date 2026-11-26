import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.DATABASE_URL ??= 'postgresql://localhost:5432/licoresyaaa_test';
    process.env.INTERNAL_API_TOKEN = 'e2e-internal-token';
    vi.stubEnv('CATALOG_API_URL', 'http://localhost:3002');
    vi.stubEnv('CATALOG_SERVICE_TOKEN', 'e2e-catalog-service-token-000000000');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('rejects internal inventory requests without service authentication', () => {
    return request(app.getHttpServer())
      .get('/internal/v1/stock/availability')
      .expect(401);
  });

  it('rejects internal inventory requests without the required permission', () => {
    return request(app.getHttpServer())
      .get('/internal/v1/stock/availability')
      .set('Authorization', 'Bearer e2e-internal-token')
      .expect(403);
  });

  it('validates internal request DTOs before calling a service', () => {
    return request(app.getHttpServer())
      .post('/internal/v1/stock/movements/entries')
      .set('Authorization', 'Bearer e2e-internal-token')
      .set('x-actor-permissions', 'inventory.stock.adjust')
      .set('x-actor-id', 'b2f3e5b3-c972-4e8c-a2d9-03d158d80c22')
      .send({ unexpected: true })
      .expect(400);
  });

  it('serves the generated OpenAPI document', () => {
    return request(app.getHttpServer())
      .get('/docs-json')
      .expect(200)
      .expect((response) => {
        expect(response.body.info.title).toBe('API de inventario de LicoresYaaa');
        expect(response.body.info.description).toBe('API interna para existencias, reservas, movimientos y devoluciones.');
        expect(response.body.paths['/internal/v1/stock/availability']).toBeDefined();
        expect(response.body.paths['/internal/v1/stock/availability'].get.summary).toBe(
          'Consultar la disponibilidad de variantes en una ubicación',
        );
        const entryOperation = response.body.paths['/internal/v1/stock/movements/entries'].post;
        expect(entryOperation.security).toEqual([
          { 'internal-service-token': [] },
        ]);
        expect(entryOperation.parameters.map((parameter: { name: string }) => parameter.name)).toContain(
          'x-actor-id',
        );
        expect(response.body.paths['/internal/v1/stock/returns']).toBeDefined();
        expect(response.body.paths['/internal/v1/stock/reservations/{orderId}/release'].post.responses['201'].description).toBe(
          'Reserva liberada.',
        );
        expect(response.body.components.schemas.RegisterStockReturnItemDto.properties.quantityRestockable.description).toBe(
          'Unidades aptas para reintegrar; no puede superar la cantidad recibida.',
        );
      });
  });

  it('serves the Swagger interface', () => {
    return request(app.getHttpServer())
      .get('/docs')
      .expect('Content-Type', /html/)
      .expect(200);
  });

  it('serves the Swagger initialization script', () => {
    return request(app.getHttpServer())
      .get('/docs/swagger-ui-init.js')
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
});
