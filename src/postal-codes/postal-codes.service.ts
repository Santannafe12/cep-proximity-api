import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import {
  ExternalServiceError,
  InvalidExternalPayloadError,
  InvalidPostalCodeError,
  PostalCodeNotFoundError,
} from '../common/errors';
import {
  haversineDistanceKm,
  isWithinSearchRadius,
  roundHalfUpToTwoDecimals,
} from '../common/utils/haversine';
import {
  formatPostalCode,
  isValidPostalCode,
  normalizePostalCode,
} from '../common/utils/postal-code';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NearbyPostalCodeCandidate } from '../nearby-postal-codes/nearby-postal-code-candidate';
import { AwesomeApiNearbyProvider } from '../nearby-postal-codes/provider/awesome-api-nearby.provider';
import { NearbyPostalCodeResponse } from './dto/nearby-postal-code.response';

export const NEARBY_CACHE_TTL_SECONDS = 21600;

@Injectable()
export class PostalCodesService {
  private readonly logger = new Logger(PostalCodesService.name);

  constructor(
    private readonly geocoding: GeocodingService,
    private readonly nearbyPostalCodes: AwesomeApiNearbyProvider,
    private readonly cache: CacheService,
  ) {}

  async findNearby(cep: string): Promise<NearbyPostalCodeResponse[]> {
    if (!isValidPostalCode(cep)) {
      throw new InvalidPostalCodeError();
    }

    const normalizedCep = normalizePostalCode(cep);
    const cacheKey = `nearby-ceps:${normalizedCep}`;
    const cached = await this.cache.get<unknown>(cacheKey);
    if (isNearbyResponseList(cached)) {
      return cached.map((item) => ({
        cep: item.cep,
        distancia_km: item.distancia_km,
      }));
    }

    const startedAt = Date.now();
    let results: NearbyPostalCodeResponse[];
    try {
      const origin = await this.geocoding.findByCep(normalizedCep);
      const candidates = await this.nearbyPostalCodes.findByCoordinates(
        origin.latitude,
        origin.longitude,
      );
      results = rankCandidates(
        normalizedCep,
        { latitude: origin.latitude, longitude: origin.longitude },
        candidates,
      );
      await this.cache.set(cacheKey, results, NEARBY_CACHE_TTL_SECONDS);
    } catch (error: unknown) {
      this.logger.error(outcome(normalizedCep, statusOf(error), startedAt));
      throw error;
    }

    this.logger.log(outcome(normalizedCep, '200', startedAt));
    return results;
  }
}

function outcome(cep: string, status: string, startedAt: number): string {
  return `cep=${cep} operation=ceps-proximos status=${status} durationMs=${Date.now() - startedAt}`;
}

function statusOf(error: unknown): string {
  if (error instanceof ExternalServiceError) {
    return String(error.externalStatus);
  }
  if (error instanceof PostalCodeNotFoundError) {
    return '404';
  }
  if (error instanceof InvalidPostalCodeError) {
    return '400';
  }
  if (error instanceof InvalidExternalPayloadError) {
    return 'invalid-payload';
  }
  return 'unexpected';
}

function rankCandidates(
  originCep: string,
  origin: { latitude: number; longitude: number },
  candidates: NearbyPostalCodeCandidate[],
): NearbyPostalCodeResponse[] {
  const nearestByCep = new Map<string, number>();

  for (const candidate of candidates) {
    if (candidate.cep === originCep) {
      continue;
    }

    const distance = haversineDistanceKm(origin, {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    });
    if (!isWithinSearchRadius(distance)) {
      continue;
    }

    const current = nearestByCep.get(candidate.cep);
    if (current === undefined || distance < current) {
      nearestByCep.set(candidate.cep, distance);
    }
  }

  return [...nearestByCep.entries()]
    .sort(([leftCep, leftDistance], [rightCep, rightDistance]) => {
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      if (leftCep < rightCep) {
        return -1;
      }
      if (leftCep > rightCep) {
        return 1;
      }
      return 0;
    })
    .map(([cep, distance]) => ({
      cep: formatPostalCode(cep),
      distancia_km: roundHalfUpToTwoDecimals(distance),
    }));
}

function isNearbyResponseList(
  value: unknown,
): value is NearbyPostalCodeResponse[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }
      const record = item as Record<string, unknown>;
      return (
        typeof record.cep === 'string' &&
        typeof record.distancia_km === 'number' &&
        Number.isFinite(record.distancia_km)
      );
    })
  );
}
