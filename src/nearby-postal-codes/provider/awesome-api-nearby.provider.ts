import { Injectable } from '@nestjs/common';
import { AwesomeApiClient } from '../../awesome-api/awesome-api.client';
import { ExternalServiceError } from '../../common/errors/external-service.error';
import { InvalidExternalPayloadError } from '../../common/errors/invalid-external-payload.error';
import { normalizePostalCode } from '../../common/utils/postal-code';
import { NearbyPostalCodeCandidate } from '../nearby-postal-code-candidate';
import { NearbyPostalCodesProvider } from './nearby-postal-codes-provider.interface';

const SEARCH_PAGE_SIZE = 10;
const MAX_SEARCH_PAGES = 500;

@Injectable()
export class AwesomeApiNearbyProvider implements NearbyPostalCodesProvider {
  constructor(private readonly client: AwesomeApiClient) {}

  async findByCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<NearbyPostalCodeCandidate[]> {
    const candidates: NearbyPostalCodeCandidate[] = [];
    const seen = new Set<string>();
    let total: number | undefined;
    let previousPageIdentity: string | undefined;

    for (let page = 1; page <= MAX_SEARCH_PAGES; page += 1) {
      const result = await this.client.get<unknown>('/search', {
        lat: latitude,
        lng: longitude,
        d: 1,
        sort: 'asc',
        limit: SEARCH_PAGE_SIZE,
        page,
        format: 'json',
      });

      if (result.status !== 200) {
        throw new ExternalServiceError(result.status);
      }

      const parsed = parseSearchPage(result.data);
      if (parsed.found !== undefined && total === undefined) {
        if (Math.ceil(parsed.found / SEARCH_PAGE_SIZE) > MAX_SEARCH_PAGES) {
          throw new ExternalServiceError();
        }
        total = parsed.found;
      }

      const pageIdentity = identityOf(parsed.items);
      if (
        previousPageIdentity !== undefined &&
        pageIdentity === previousPageIdentity &&
        parsed.items.length > 0
      ) {
        throw new ExternalServiceError();
      }
      previousPageIdentity = pageIdentity;

      for (const item of parsed.items) {
        const identity = candidateIdentity(item);
        if (seen.has(identity)) {
          continue;
        }
        seen.add(identity);
        candidates.push(item);
      }

      const lastPage =
        parsed.items.length < SEARCH_PAGE_SIZE ||
        (total !== undefined && page >= Math.ceil(total / SEARCH_PAGE_SIZE));
      if (lastPage) {
        return candidates;
      }
    }

    throw new ExternalServiceError();
  }
}

function parseSearchPage(payload: unknown): {
  found?: number;
  items: NearbyPostalCodeCandidate[];
} {
  if (typeof payload !== 'object' || payload === null) {
    throw new InvalidExternalPayloadError();
  }

  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.results)) {
    throw new InvalidExternalPayloadError();
  }

  return {
    found: readFound(record.found),
    items: record.results.map((item) => parseCandidate(item)),
  };
}

function readFound(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new InvalidExternalPayloadError();
  }

  return value;
}

function parseCandidate(value: unknown): NearbyPostalCodeCandidate {
  if (typeof value !== 'object' || value === null) {
    throw new InvalidExternalPayloadError();
  }

  const record = value as Record<string, unknown>;
  if (typeof record.cep !== 'string') {
    throw new InvalidExternalPayloadError();
  }

  let cep: string;
  try {
    cep = normalizePostalCode(record.cep);
  } catch {
    throw new InvalidExternalPayloadError();
  }

  const latitude = readCoordinate(record.lat);
  const longitude = readCoordinate(record.lng);
  if (latitude === null || longitude === null) {
    throw new InvalidExternalPayloadError();
  }

  return { cep, latitude, longitude };
}

function readCoordinate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function identityOf(items: NearbyPostalCodeCandidate[]): string {
  const firstCep = items[0]?.cep ?? '';
  const set = items.map((item) => candidateIdentity(item)).sort();
  return `${firstCep}\n${set.join('\n')}`;
}

function candidateIdentity(item: NearbyPostalCodeCandidate): string {
  return `${item.cep}|${item.latitude}|${item.longitude}`;
}
