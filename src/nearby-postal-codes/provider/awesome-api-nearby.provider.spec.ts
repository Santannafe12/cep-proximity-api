import { Test } from '@nestjs/testing';
import { AwesomeApiClient } from '../../awesome-api/awesome-api.client';
import { DEFAULT_AWESOME_API_TIMEOUT_MS } from '../../config/env.validation';
import {
  ExternalServiceError,
  InvalidExternalPayloadError,
} from '../../common/errors';
import { AwesomeApiNearbyProvider } from './awesome-api-nearby.provider';

type SearchQuery = {
  lat: number;
  lng: number;
  d: number;
  sort: string;
  limit: number;
  page: number;
  format: string;
};

describe('AwesomeApiNearbyProvider', () => {
  let provider: AwesomeApiNearbyProvider;
  const client = {
    get: jest.fn(),
  };
  const latitude = -23.5500806;
  const longitude = -46.6340827;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AwesomeApiNearbyProvider,
        { provide: AwesomeApiClient, useValue: client },
      ],
    }).compile();

    provider = moduleRef.get(AwesomeApiNearbyProvider);
  });

  it('walks three pages in order when found is 25', async () => {
    const pagesRequested: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    client.get.mockImplementation(async (_path: string, query: SearchQuery) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      pagesRequested.push(query.page);
      await Promise.resolve();
      inFlight -= 1;

      const start = (query.page - 1) * 10;
      const size = query.page === 3 ? 5 : 10;
      return ok(
        25,
        Array.from({ length: size }, (_, offset) =>
          rawItem(cepAt(start + offset), offset % 2 === 0),
        ),
      );
    });

    const candidates = await provider.findByCoordinates(latitude, longitude);

    expect(pagesRequested).toEqual([1, 2, 3]);
    expect(maxInFlight).toBe(1);
    expect(candidates).toHaveLength(25);
    expect(candidates[0]).toEqual({
      cep: '10000000',
      latitude,
      longitude,
    });
    expect(candidates[24]).toEqual({
      cep: '10000024',
      latitude,
      longitude,
    });
    expect(client.get).toHaveBeenCalledTimes(3);
    for (const page of [1, 2, 3]) {
      expect(client.get).toHaveBeenNthCalledWith(page, '/search', {
        lat: latitude,
        lng: longitude,
        d: 1,
        sort: 'asc',
        limit: 10,
        page,
        format: 'json',
      });
    }
  });

  it('keeps paging when the pages together last longer than one request timeout', async () => {
    const pageDelayMs = Math.floor(DEFAULT_AWESOME_API_TIMEOUT_MS / 2) + 1;
    jest.useFakeTimers();
    try {
      client.get.mockImplementation((_path: string, query: SearchQuery) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            const start = (query.page - 1) * 10;
            const size = query.page === 3 ? 5 : 10;
            resolve(
              ok(
                25,
                Array.from({ length: size }, (_, offset) =>
                  rawItem(cepAt(start + offset)),
                ),
              ),
            );
          }, pageDelayMs);
        });
      });

      const pending = provider.findByCoordinates(latitude, longitude);
      await jest.advanceTimersByTimeAsync(pageDelayMs);
      await jest.advanceTimersByTimeAsync(pageDelayMs);
      await jest.advanceTimersByTimeAsync(pageDelayMs);

      await expect(pending).resolves.toHaveLength(25);
      expect(client.get).toHaveBeenCalledTimes(3);
      expect(pageDelayMs * 3).toBeGreaterThan(DEFAULT_AWESOME_API_TIMEOUT_MS);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops on a short page when the payload has no found', async () => {
    client.get.mockImplementation((_path: string, query: SearchQuery) => {
      if (query.page === 1) {
        return ok(
          undefined,
          Array.from({ length: 10 }, (_, offset) => rawItem(cepAt(offset))),
        );
      }
      if (query.page === 2) {
        return ok(undefined, [
          rawItem('01001-000'),
          rawItem('01310100'),
          rawItem('01310200'),
        ]);
      }
      throw new Error('page 3 must not be requested');
    });

    const candidates = await provider.findByCoordinates(latitude, longitude);
    expect(candidates).toHaveLength(13);
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(candidates[10]).toEqual({
      cep: '01001000',
      latitude,
      longitude,
    });
  });

  it('accepts an empty page without found', async () => {
    client.get.mockResolvedValue(ok(undefined, []));

    await expect(
      provider.findByCoordinates(latitude, longitude),
    ).resolves.toEqual([]);
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it('fails the whole search when page 2 is unauthorized', async () => {
    client.get.mockImplementation((_path: string, query: SearchQuery) => {
      if (query.page === 1) {
        return ok(
          25,
          Array.from({ length: 10 }, (_, offset) => rawItem(cepAt(offset))),
        );
      }
      return { status: 401, data: { code: 'unauthorized' } };
    });

    await expect(
      provider.findByCoordinates(latitude, longitude),
    ).rejects.toBeInstanceOf(ExternalServiceError);
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  it('invalidates the search when an item has no numeric coordinate', async () => {
    client.get.mockImplementation((_path: string, query: SearchQuery) => {
      if (query.page === 1) {
        return ok(
          20,
          Array.from({ length: 10 }, (_, offset) => rawItem(cepAt(offset))),
        );
      }
      return ok(20, [{ cep: '01310999', lng: '-46.6340827' }]);
    });

    await expect(
      provider.findByCoordinates(latitude, longitude),
    ).rejects.toBeInstanceOf(InvalidExternalPayloadError);
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  it('fails when the next page repeats the previous page', async () => {
    const page = Array.from({ length: 10 }, (_, offset) =>
      rawItem(cepAt(offset)),
    );
    client.get.mockResolvedValue(ok(30, page));

    await expect(
      provider.findByCoordinates(latitude, longitude),
    ).rejects.toBeInstanceOf(ExternalServiceError);
    expect(client.get).toHaveBeenCalledTimes(2);
  });
});

function cepAt(index: number): string {
  return String(10000000 + index);
}

function rawItem(cep: string, includeDistance = true): Record<string, unknown> {
  const item: Record<string, unknown> = {
    cep,
    lat: '-23.5500806',
    lng: '-46.6340827',
    address: 'Praça da Sé',
  };
  if (includeDistance) {
    item.distance_km = 0.12;
  }
  return item;
}

function ok(
  found: number | undefined,
  results: Record<string, unknown>[],
): { status: number; data: Record<string, unknown> } {
  const data: Record<string, unknown> = { results };
  if (found !== undefined) {
    data.found = found;
  }
  return { status: 200, data };
}
