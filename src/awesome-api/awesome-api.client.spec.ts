import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { throwError, of } from 'rxjs';
import { DEFAULT_AWESOME_API_TIMEOUT_MS } from '../config/env.validation';
import { ExternalServiceError } from '../common/errors';
import { AwesomeApiClient } from './awesome-api.client';
import { AwesomeApiRateLimiter } from './awesome-api-rate-limiter';

const FIXTURE_API_KEY = 'fixture';

describe('AwesomeApiClient', () => {
  let client: AwesomeApiClient;
  const httpService = {
    get: jest.fn(),
  };
  const config: Record<string, string | number> = {
    AWESOME_API_BASE_URL: 'https://cep.awesomeapi.com.br',
    AWESOME_API_KEY: FIXTURE_API_KEY,
    AWESOME_API_TIMEOUT_MS: 5000,
    AWESOME_API_RATE_LIMIT_MAX: 5,
    AWESOME_API_RATE_LIMIT_WINDOW_MS: 1000,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    config.AWESOME_API_BASE_URL = 'https://cep.awesomeapi.com.br';
    config.AWESOME_API_KEY = FIXTURE_API_KEY;
    config.AWESOME_API_TIMEOUT_MS = 5000;
    config.AWESOME_API_RATE_LIMIT_MAX = 5;
    config.AWESOME_API_RATE_LIMIT_WINDOW_MS = 1000;
    httpService.get.mockReturnValue(
      of({ status: 200, data: { lat: '-23.5', lng: '-46.6' } }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        AwesomeApiRateLimiter,
        AwesomeApiClient,
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => config[key],
          },
        },
      ],
    }).compile();

    client = moduleRef.get(AwesomeApiClient);
  });

  it('sends the search query without the key', async () => {
    await client.get('/search', {
      lat: -23.5500806,
      lng: -46.6340827,
      d: 1,
      sort: 'asc',
      limit: 10,
      page: 2,
      format: 'json',
    });

    const [url, request] = httpService.get.mock.calls[0] as [
      string,
      { headers: Record<string, string>; timeout: number },
    ];
    expect(url).toBe(
      'https://cep.awesomeapi.com.br/search?lat=-23.5500806&lng=-46.6340827&d=1&sort=asc&limit=10&page=2&format=json',
    );
    expect(url).not.toContain(FIXTURE_API_KEY);
    expect(url).not.toContain('token=');
    expect(request.headers['x-api-key']).toBe(FIXTURE_API_KEY);
    expect(request.timeout).toBe(5000);
  });

  it('times out that call and hides the failure', async () => {
    const errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    httpService.get.mockReturnValue(
      throwError(() =>
        Object.assign(new Error(`timeout ${FIXTURE_API_KEY}`), {
          code: 'ECONNABORTED',
        }),
      ),
    );

    try {
      await expect(client.get('/json/01001000')).rejects.toThrow(
        'External service request failed',
      );
      expect(httpService.get).toHaveBeenCalledTimes(1);
      const [, request] = httpService.get.mock.calls[0] as [
        string,
        { timeout: number },
      ];
      expect(request.timeout).toBe(5000);
      const logged = errorLog.mock.calls
        .map((call) => String(call[0]))
        .join(' ');
      expect(logged).toContain('operation=/json/01001000');
      expect(logged).toContain('status=timeout');
      expect(logged).toContain('durationMs=');
      expect(logged).not.toContain(FIXTURE_API_KEY);
      expect(logged).not.toContain('x-api-key');
    } finally {
      errorLog.mockRestore();
    }
  });

  it('hides transport failures without the request configuration', async () => {
    httpService.get.mockReturnValue(
      throwError(() => new Error(`down ${FIXTURE_API_KEY}`)),
    );

    await expect(client.get('/json/01001000')).rejects.toEqual(
      expect.any(ExternalServiceError),
    );
    await expect(client.get('/json/01001000')).rejects.toThrow(
      'External service request failed',
    );
  });

  it('shares one outbound lock and keeps the HTTP timeout outside the wait', async () => {
    config.AWESOME_API_RATE_LIMIT_MAX = 1;
    config.AWESOME_API_RATE_LIMIT_WINDOW_MS =
      DEFAULT_AWESOME_API_TIMEOUT_MS + 3000;
    config.AWESOME_API_TIMEOUT_MS = DEFAULT_AWESOME_API_TIMEOUT_MS;
    jest.useFakeTimers();

    try {
      await client.get('/json/01001000');
      expect(httpService.get).toHaveBeenCalledTimes(1);

      let settled = false;
      const second = client.get('/search').then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      await jest.advanceTimersByTimeAsync(DEFAULT_AWESOME_API_TIMEOUT_MS);
      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(settled).toBe(false);

      await jest.advanceTimersByTimeAsync(3000);
      await second;
      expect(httpService.get).toHaveBeenCalledTimes(2);

      const [geocodingUrl] = httpService.get.mock.calls[0] as [string];
      const [searchUrl, searchRequest] = httpService.get.mock.calls[1] as [
        string,
        { timeout: number },
      ];
      expect(geocodingUrl).toContain('/json/01001000');
      expect(searchUrl).toContain('/search');
      expect(searchRequest.timeout).toBe(DEFAULT_AWESOME_API_TIMEOUT_MS);
    } finally {
      jest.useRealTimers();
    }
  });
});
