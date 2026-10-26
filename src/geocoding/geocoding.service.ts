import { Inject, Injectable, Logger } from '@nestjs/common';
import { GeocodedPostalCode } from '../awesome-api/awesome-api.types';
import { CacheService } from '../cache/cache.service';
import { InvalidPostalCodeError } from '../common/errors/invalid-postal-code.error';
import {
  isValidPostalCode,
  normalizePostalCode,
} from '../common/utils/postal-code';
import {
  GEOCODING_PROVIDER,
  GeocodingProvider,
} from './provider/geocoding-provider.interface';

export const GEOCODING_CACHE_TTL_SECONDS = 604800;

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    @Inject(GEOCODING_PROVIDER)
    private readonly provider: GeocodingProvider,
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
    await this.writeCache(cacheKey, geocoded);
    return geocoded;
  }

  private async readCache(
    cacheKey: string,
  ): Promise<GeocodedPostalCode | null> {
    try {
      const cached = await this.cache.get<unknown>(cacheKey);
      if (!isGeocodedPostalCode(cached)) {
        return null;
      }

      return {
        cep: cached.cep,
        latitude: cached.latitude,
        longitude: cached.longitude,
      };
    } catch (error: unknown) {
      this.logger.error(`Geocoding cache read failed: ${errorText(error)}`);
      return null;
    }
  }

  private async writeCache(
    cacheKey: string,
    geocoded: GeocodedPostalCode,
  ): Promise<void> {
    try {
      await this.cache.set(cacheKey, geocoded, GEOCODING_CACHE_TTL_SECONDS);
    } catch (error: unknown) {
      this.logger.error(`Geocoding cache write failed: ${errorText(error)}`);
    }
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown cache error';
}
