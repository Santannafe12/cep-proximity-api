import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { throwError, of } from 'rxjs';
import { ExternalServiceError } from '../common/errors/external-service.error';
import { AwesomeApiClient } from './awesome-api.client';

const FIXTURE_API_KEY = 'fixture';

describe('AwesomeApiClient', () => {
  let client: AwesomeApiClient;
  const httpService = {
    get: jest.fn(),
  };
  const config: Record<string, string> = {
    AWESOME_API_BASE_URL: 'https://cep.awesomeapi.com.br',
    AWESOME_API_KEY: FIXTURE_API_KEY,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    config.AWESOME_API_BASE_URL = 'https://cep.awesomeapi.com.br';
    config.AWESOME_API_KEY = FIXTURE_API_KEY;
    httpService.get.mockReturnValue(
      of({ status: 200, data: { lat: '-23.5', lng: '-46.6' } }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
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
      { headers: Record<string, string> },
    ];
    expect(url).toBe(
      'https://cep.awesomeapi.com.br/search?lat=-23.5500806&lng=-46.6340827&d=1&sort=asc&limit=10&page=2&format=json',
    );
    expect(url).not.toContain(FIXTURE_API_KEY);
    expect(url).not.toContain('token=');
    expect(request.headers['x-api-key']).toBe(FIXTURE_API_KEY);
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
});
