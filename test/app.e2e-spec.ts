import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  const previousApiKey = process.env.AWESOME_API_KEY;

  beforeEach(async () => {
    process.env.AWESOME_API_KEY = 'fixture';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (previousApiKey === undefined) {
      delete process.env.AWESOME_API_KEY;
    } else {
      process.env.AWESOME_API_KEY = previousApiKey;
    }
    await app?.close();
  });

  it('GET /health', () => {
    if (!app) {
      throw new Error('Application was not created');
    }

    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
