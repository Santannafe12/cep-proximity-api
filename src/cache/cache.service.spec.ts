import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { CACHE_KEY_PREFIX, CACHE_SCAN_COUNT } from './cache.constants';
import { CacheService, CacheUnavailableError } from './cache.service';

const mockClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
  flushdb: jest.fn(),
  flushall: jest.fn(),
  status: 'wait',
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockClient);
});

describe('CacheService', () => {
  let service: CacheService;
  let moduleRef: TestingModule;
  let errorLog: jest.SpiedFunction<Logger['error']>;

  beforeEach(async () => {
    jest.clearAllMocks();
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    moduleRef = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => 'redis://localhost:6379',
          },
        },
      ],
    }).compile();

    service = moduleRef.get(CacheService);
  });

  afterEach(async () => {
    errorLog.mockRestore();
    await moduleRef.close();
  });

  it('reads a hit from the prefixed key and parses JSON', async () => {
    mockClient.get.mockResolvedValue(JSON.stringify({ latitude: 1 }));

    await expect(
      service.get<{ latitude: number }>('geocoding:01001000'),
    ).resolves.toEqual({
      latitude: 1,
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      `${CACHE_KEY_PREFIX}geocoding:01001000`,
    );
  });

  it('returns null on a cache miss', async () => {
    mockClient.get.mockResolvedValue(null);

    await expect(service.get('missing')).resolves.toBeNull();
  });

  it('returns a miss and logs when Redis fails during read', async () => {
    mockClient.get.mockRejectedValue(new Error('connection refused'));

    await expect(service.get('geocoding:01001000')).resolves.toBeNull();
    expect(errorLog).toHaveBeenCalled();
  });

  it('returns a miss when the stored JSON is invalid', async () => {
    mockClient.get.mockResolvedValue('{');

    await expect(service.get('broken')).resolves.toBeNull();
  });

  it('writes JSON with the required TTL', async () => {
    mockClient.set.mockResolvedValue('OK');

    await service.set('nearby-ceps:01001000', [{ cep: '01001000' }], 21600);

    expect(mockClient.set).toHaveBeenCalledWith(
      `${CACHE_KEY_PREFIX}nearby-ceps:01001000`,
      JSON.stringify([{ cep: '01001000' }]),
      'EX',
      21600,
    );
  });

  it('does not throw when Redis fails during write', async () => {
    mockClient.set.mockRejectedValue(new Error('connection refused'));

    await expect(
      service.set('nearby-ceps:01001000', [], 60),
    ).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalled();
  });

  it('rejects a missing TTL before calling Redis', async () => {
    await expect(service.set('key', 'value', 0)).rejects.toThrow(
      'Cache TTL must be a positive integer number of seconds',
    );
    expect(mockClient.set).not.toHaveBeenCalled();
  });

  it('deletes a prefixed key', async () => {
    mockClient.del.mockResolvedValue(1);

    await service.delete('geocoding:01001000');

    expect(mockClient.del).toHaveBeenCalledWith(
      `${CACHE_KEY_PREFIX}geocoding:01001000`,
    );
  });

  it('throws a typed error when delete fails', async () => {
    mockClient.del.mockRejectedValue(new Error('connection refused'));

    await expect(service.delete('geocoding:01001000')).rejects.toBeInstanceOf(
      CacheUnavailableError,
    );
  });

  it('deletes many prefixed keys', async () => {
    mockClient.del.mockResolvedValue(2);

    await service.deleteMany(['geocoding:01001000', 'nearby-ceps:01001000']);

    expect(mockClient.del).toHaveBeenCalledWith(
      `${CACHE_KEY_PREFIX}geocoding:01001000`,
      `${CACHE_KEY_PREFIX}nearby-ceps:01001000`,
    );
  });

  it('throws a typed error when deleteMany fails', async () => {
    mockClient.del.mockRejectedValue(new Error('connection refused'));

    await expect(
      service.deleteMany(['geocoding:01001000']),
    ).rejects.toBeInstanceOf(CacheUnavailableError);
  });

  it('clears only keys under the application prefix and never flushes the database', async () => {
    mockClient.scan.mockResolvedValueOnce([
      '12',
      [`${CACHE_KEY_PREFIX}geocoding:1`, 'other-app:geocoding:1'],
    ]);
    mockClient.scan.mockResolvedValueOnce([
      '0',
      [`${CACHE_KEY_PREFIX}geocoding:2`],
    ]);
    mockClient.del.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    await expect(service.clearByPrefix('geocoding:')).resolves.toBe(2);

    expect(mockClient.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      `${CACHE_KEY_PREFIX}geocoding:*`,
      'COUNT',
      CACHE_SCAN_COUNT,
    );
    expect(mockClient.del).toHaveBeenNthCalledWith(
      1,
      `${CACHE_KEY_PREFIX}geocoding:1`,
    );
    expect(mockClient.del).toHaveBeenNthCalledWith(
      2,
      `${CACHE_KEY_PREFIX}geocoding:2`,
    );
    expect(mockClient.flushdb).not.toHaveBeenCalled();
    expect(mockClient.flushall).not.toHaveBeenCalled();
  });

  it('throws a typed error when clearByPrefix fails', async () => {
    mockClient.scan.mockRejectedValue(new Error('connection refused'));

    await expect(service.clearByPrefix('geocoding:')).rejects.toBeInstanceOf(
      CacheUnavailableError,
    );
    expect(mockClient.flushdb).not.toHaveBeenCalled();
  });

  it('opens Redis lazily with the configured URL', () => {
    const RedisMock = Redis as unknown as jest.Mock;

    expect(RedisMock).toHaveBeenCalledWith('redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
    });
  });
});
