import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CacheService } from '../cache/cache.service';
import { InvalidPostalCodeError } from '../common/errors/invalid-postal-code.error';
import { PostalCodeNotFoundError } from '../common/errors/postal-code-not-found.error';
import {
  GeocodingService,
  GEOCODING_CACHE_TTL_SECONDS,
} from './geocoding.service';
import { GEOCODING_PROVIDER } from './provider/geocoding-provider.interface';

describe('GeocodingService', () => {
  let service: GeocodingService;
  const provider = {
    findByCep: jest.fn(),
  };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
  };
  const geocoded = {
    cep: '01001000',
    latitude: -23.5500806,
    longitude: -46.6340827,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    provider.findByCep.mockResolvedValue(geocoded);

    const moduleRef = await Test.createTestingModule({
      providers: [
        GeocodingService,
        { provide: GEOCODING_PROVIDER, useValue: provider },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(GeocodingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores a miss for seven days and does not keep address fields', async () => {
    await expect(service.findByCep('01001-000')).resolves.toEqual(geocoded);

    expect(provider.findByCep).toHaveBeenCalledWith('01001000');
    expect(cache.get).toHaveBeenCalledWith('geocoding:01001000');
    expect(cache.set).toHaveBeenCalledWith(
      'geocoding:01001000',
      geocoded,
      GEOCODING_CACHE_TTL_SECONDS,
    );
    expect(GEOCODING_CACHE_TTL_SECONDS).toBe(604800);
    expect(Object.keys(geocoded).sort()).toEqual([
      'cep',
      'latitude',
      'longitude',
    ]);
  });

  it('returns a cache hit without calling the provider', async () => {
    cache.get.mockResolvedValue({ ...geocoded, address: 'Praça da Sé' });

    await expect(service.findByCep('01001000')).resolves.toEqual(geocoded);
    expect(provider.findByCep).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('treats a malformed cache entry as a miss', async () => {
    cache.get.mockResolvedValue({ cep: '01001000', address: 'Praça da Sé' });

    await expect(service.findByCep('01001000')).resolves.toEqual(geocoded);
    expect(provider.findByCep).toHaveBeenCalledWith('01001000');
  });

  it('rejects an invalid postal code before cache and HTTP', async () => {
    await expect(service.findByCep('36.000-000')).rejects.toBeInstanceOf(
      InvalidPostalCodeError,
    );
    expect(cache.get).not.toHaveBeenCalled();
    expect(provider.findByCep).not.toHaveBeenCalled();
  });

  it('continues the lookup when the cache read fails', async () => {
    cache.get.mockRejectedValue(new Error('connection refused'));

    await expect(service.findByCep('01001000')).resolves.toEqual(geocoded);
    expect(provider.findByCep).toHaveBeenCalledTimes(1);
  });

  it('returns the geocoding result when the cache write fails', async () => {
    cache.set.mockRejectedValue(new Error('connection refused'));

    await expect(service.findByCep('01001000')).resolves.toEqual(geocoded);
  });

  it('does not cache an external not-found response', async () => {
    provider.findByCep.mockRejectedValue(new PostalCodeNotFoundError());

    await expect(service.findByCep('00000000')).rejects.toBeInstanceOf(
      PostalCodeNotFoundError,
    );
    expect(cache.set).not.toHaveBeenCalled();
  });
});
