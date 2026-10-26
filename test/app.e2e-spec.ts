import { HttpService } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { throwError } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  CacheService,
  CacheUnavailableError,
} from './../src/cache/cache.service';
import { ApiExceptionFilter } from './../src/common/filters/api-exception.filter';
import { ExternalServiceError } from './../src/common/errors/external-service.error';
import { PostalCodeNotFoundError } from './../src/common/errors/postal-code-not-found.error';
import {
  EARTH_RADIUS_KM,
  haversineDistanceKm,
  roundHalfUpToTwoDecimals,
} from './../src/common/utils/haversine';
import { formatPostalCode } from './../src/common/utils/postal-code';
import { GEOCODING_PROVIDER } from './../src/geocoding/provider/geocoding-provider.interface';
import { NEARBY_POSTAL_CODES_PROVIDER } from './../src/nearby-postal-codes/provider/nearby-postal-codes-provider.interface';
import { NEARBY_CACHE_TTL_SECONDS } from './../src/postal-codes/postal-codes.service';
import { AppModule } from './../src/app.module';

const origin = { latitude: -23.55, longitude: -46.63 };
const samePlace = { ...origin };
const close = moveNorth(origin, 0.2);
const tied = moveNorth(origin, 0.35);
const medium = moveNorth(origin, 0.5);
const farther = moveNorth(origin, 0.8);
const outside = moveNorth(origin, 2);

describe('API (e2e)', () => {
  let app: INestApplication<App> | undefined;
  const previousApiKey = process.env.AWESOME_API_KEY;
  const geocoding = { findByCep: jest.fn() };
  const nearby = { findByCoordinates: jest.fn() };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    deleteMany: jest.fn(),
    clearByPrefix: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.AWESOME_API_KEY = 'fixture';
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    cache.deleteMany.mockResolvedValue(0);
    cache.clearByPrefix.mockResolvedValue(0);
    geocoding.findByCep.mockResolvedValue({
      cep: '01001000',
      latitude: origin.latitude,
      longitude: origin.longitude,
    });
    nearby.findByCoordinates.mockResolvedValue([]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CacheService)
      .useValue(cache)
      .overrideProvider(GEOCODING_PROVIDER)
      .useValue(geocoding)
      .overrideProvider(NEARBY_POSTAL_CODES_PROVIDER)
      .useValue(nearby)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
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
    return request(server())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('returns 429 after the inbound limit and still serves health', async () => {
    const first = await request(server()).get('/ceps-proximos/36.000-000');
    const limitedRead = await request(server()).get(
      '/ceps-proximos/36.000-000',
    );
    const deleted = await request(server()).delete('/cache/ceps/01001000');
    const limitedDelete = await request(server()).delete(
      '/cache/ceps/01001000',
    );
    const health = await request(server()).get('/health');

    expect(first.status).toBe(400);
    expect(limitedRead.status).toBe(429);
    expect(deleted.status).toBe(200);
    expect(limitedDelete.status).toBe(429);
    expect(limitedDelete.body).toEqual({
      statusCode: 429,
      message: 'ThrottlerException: Too Many Requests',
    });
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
  });

  it('treats the next lookup as a miss after deleting one postal code', async () => {
    const stored = new Map<string, unknown>([
      ['nearby-ceps:01001000', [{ cep: '99999-999', distancia_km: 0.1 }]],
      [
        'geocoding:01001000',
        {
          cep: '01001000',
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
      ],
    ]);
    cache.get.mockImplementation((key: string) =>
      Promise.resolve(stored.get(key) ?? null),
    );
    cache.deleteMany.mockImplementation((keys: string[]) => {
      let removed = 0;
      for (const key of keys) {
        if (stored.delete(key)) {
          removed += 1;
        }
      }
      return Promise.resolve(removed);
    });
    nearby.findByCoordinates.mockResolvedValue([candidate('01310100', close)]);

    const deleted = await request(server()).delete('/cache/ceps/01001-000');
    const response = await request(server()).get('/ceps-proximos/01001-000');

    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ removed: 2 });
    expect(cache.deleteMany).toHaveBeenCalledWith([
      'geocoding:01001000',
      'nearby-ceps:01001000',
    ]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([listed('01310100', close)]);
    expect(geocoding.findByCep).toHaveBeenCalledWith('01001000');
    expect(nearby.findByCoordinates).toHaveBeenCalled();
  });

  it('DELETE /cache/ceps/:cep returns 400 for an invalid postal code', async () => {
    const response = await request(server()).delete('/cache/ceps/36.000-000');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      message: 'Invalid postal code',
    });
    expect(cache.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 503 when Redis fails during cache invalidation', async () => {
    cache.deleteMany.mockRejectedValue(new CacheUnavailableError('deleteMany'));

    const response = await request(server()).delete('/cache/ceps/01001000');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      statusCode: 503,
      message: 'Redis deleteMany failed',
    });
  });

  it('DELETE /cache/ceps reports how many application keys were removed', async () => {
    cache.clearByPrefix.mockResolvedValue(3);

    const response = await request(server()).delete('/cache/ceps');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ removed: 3 });
    expect(cache.clearByPrefix).toHaveBeenCalledWith('');
  });

  it('GET /ceps-proximos/:cep filters, deduplicates, orders and excludes the queried CEP', async () => {
    nearby.findByCoordinates.mockResolvedValue([
      candidate('01001000', origin),
      candidate('01310999', samePlace),
      candidate('01310200', farther),
      candidate('20040002', outside),
      candidate('01311000', tied),
      candidate('01310200', medium),
      candidate('01310100', close),
      candidate('01310000', tied),
    ]);

    const response = await request(server()).get('/ceps-proximos/01001-000');

    const expected = [
      listed('01310999', samePlace),
      listed('01310100', close),
      listed('01310000', tied),
      listed('01311000', tied),
      listed('01310200', medium),
    ];
    expect(response.status).toBe(200);
    expect(response.body).toEqual(expected);
    expect(JSON.stringify(response.body)).not.toContain('01001-000');
    expect(JSON.stringify(response.body)).not.toContain('20040-002');
    expect(geocoding.findByCep).toHaveBeenCalledWith('01001000');
    expect(nearby.findByCoordinates).toHaveBeenCalledWith(
      origin.latitude,
      origin.longitude,
    );
    expect(cache.set).toHaveBeenCalledWith(
      'nearby-ceps:01001000',
      expected,
      NEARBY_CACHE_TTL_SECONDS,
    );
  });

  it('GET /ceps-proximos/:cep returns an empty list when only the queried CEP remains', async () => {
    nearby.findByCoordinates.mockResolvedValue([candidate('01001000', origin)]);

    const response = await request(server()).get('/ceps-proximos/01001000');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(cache.set).toHaveBeenCalledWith(
      'nearby-ceps:01001000',
      [],
      NEARBY_CACHE_TTL_SECONDS,
    );
  });

  it('GET /ceps-proximos/:cep returns a nearby cache hit without calling providers', async () => {
    const cached = [{ cep: '01310-100', distancia_km: 0.42 }];
    cache.get.mockImplementation((key: string) => {
      if (key === 'nearby-ceps:01001000') {
        return cached;
      }
      return null;
    });

    const response = await request(server()).get('/ceps-proximos/01001000');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(cached);
    expect(geocoding.findByCep).not.toHaveBeenCalled();
    expect(nearby.findByCoordinates).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('GET /ceps-proximos/:cep returns 400 for an invalid postal code', async () => {
    const response = await request(server()).get('/ceps-proximos/36.000-000');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      message: 'Invalid postal code',
    });
    expect(cache.get).not.toHaveBeenCalled();
    expect(geocoding.findByCep).not.toHaveBeenCalled();
  });

  it('GET /ceps-proximos/:cep returns 404 when the postal code does not exist', async () => {
    geocoding.findByCep.mockRejectedValue(new PostalCodeNotFoundError());

    const response = await request(server()).get('/ceps-proximos/00000000');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      statusCode: 404,
      message: 'Postal code was not found',
    });
    expect(nearby.findByCoordinates).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('GET /ceps-proximos/:cep returns 503 when the external search fails', async () => {
    nearby.findByCoordinates.mockRejectedValue(new ExternalServiceError());

    const response = await request(server()).get('/ceps-proximos/01001000');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      statusCode: 503,
      message: 'External service request failed',
    });
    expect(cache.set).not.toHaveBeenCalledWith(
      'nearby-ceps:01001000',
      expect.anything(),
      expect.anything(),
    );
  });

  it('GET /ceps-proximos/:cep returns 503 when one AwesomeAPI call times out', async () => {
    const http = {
      get: jest.fn().mockReturnValue(
        throwError(() =>
          Object.assign(new Error('timeout fixture'), {
            code: 'ECONNABORTED',
          }),
        ),
      ),
    };
    const timeoutCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CacheService)
      .useValue(timeoutCache)
      .overrideProvider(HttpService)
      .useValue(http)
      .compile();
    const timeoutApp: INestApplication<App> = moduleRef.createNestApplication();
    timeoutApp.useGlobalFilters(new ApiExceptionFilter());

    try {
      await timeoutApp.init();
      const response = await request(timeoutApp.getHttpServer()).get(
        '/ceps-proximos/01001000',
      );

      expect(http.get).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        statusCode: 503,
        message: 'External service request failed',
      });
      expect(timeoutCache.set).not.toHaveBeenCalled();
    } finally {
      await timeoutApp.close();
    }
  });

  it('GET /ceps-proximos/:cep returns 500 without a stack when something unexpected fails', async () => {
    geocoding.findByCep.mockRejectedValue(new Error('boom-stack-secret'));

    const response = await request(server()).get('/ceps-proximos/01001000');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(nearby.findByCoordinates).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  function server() {
    if (!app) {
      throw new Error('Application was not created');
    }
    return app.getHttpServer();
  }
});

function candidate(
  cep: string,
  coordinate: { latitude: number; longitude: number },
) {
  return { cep, ...coordinate };
}

function listed(
  cep: string,
  coordinate: { latitude: number; longitude: number },
) {
  return {
    cep: formatPostalCode(cep),
    distancia_km: roundHalfUpToTwoDecimals(
      haversineDistanceKm(origin, coordinate),
    ),
  };
}

function moveNorth(
  coordinate: { latitude: number; longitude: number },
  distanceKm: number,
) {
  const deltaLatitude = (distanceKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  return {
    latitude: coordinate.latitude + deltaLatitude,
    longitude: coordinate.longitude,
  };
}
