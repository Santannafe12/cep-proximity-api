import { Injectable } from '@nestjs/common';
import { GeocodedPostalCode } from '../awesome-api/awesome-api.types';
import { CacheService } from '../cache/cache.service';
import { InvalidPostalCodeError } from '../common/errors';
import {
  isValidPostalCode,
  normalizePostalCode,
} from '../common/utils/postal-code';
import { AwesomeApiGeocodingProvider } from './provider/awesome-api-geocoding.provider';

export const GEOCODING_CACHE_TTL_SECONDS = 604800;

@Injectable()
export class GeocodingService {
  constructor(
    private readonly provider: AwesomeApiGeocodingProvider,
    private readonly cache: CacheService,
  ) {}

  async findByCep(cep: string): Promise<GeocodedPostalCode> {
    if (!isValidPostalCode(cep)) {
      throw new InvalidPostalCodeError();
    }

    const normalizedCep = normalizePostalCode(cep);
    const cacheKey = `geocoding:${normalizedCep}`;
    const cached = await this.readCache(cacheKey);
    if (cached) {
      return cached;
    }

    const geocoded = await this.provider.findByCep(normalizedCep);
    await this.cache.set(cacheKey, geocoded, GEOCODING_CACHE_TTL_SECONDS);
    return geocoded;
  }

  private async readCache(
    cacheKey: string,
  ): Promise<GeocodedPostalCode | null> {
    const cached = await this.cache.get<unknown>(cacheKey);
    if (!isGeocodedPostalCode(cached)) {
      return null;
    }

    return {
      cep: cached.cep,
      latitude: cached.latitude,
      longitude: cached.longitude,
    };
  }
}

function isGeocodedPostalCode(value: unknown): value is GeocodedPostalCode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.cep === 'string' &&
    typeof record.latitude === 'number' &&
    Number.isFinite(record.latitude) &&
    typeof record.longitude === 'number' &&
    Number.isFinite(record.longitude)
  );
}
