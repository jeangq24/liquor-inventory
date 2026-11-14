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
        expect(response.body.paths['/internal/v1/stock/availability']).toBeDefined();
        const entryOperation = response.body.paths['/internal/v1/stock/movements/entries'].post;
        expect(entryOperation.security).toEqual([
          { 'internal-service-token': [] },
        ]);
        expect(entryOperation.parameters.map((parameter: { name: string }) => parameter.name)).toContain(
          'x-actor-id',
        );
        expect(response.body.paths['/internal/v1/stock/returns']).toBeDefined();
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
