import { Injectable } from '@nestjs/common';
import { AwesomeApiClient } from '../../awesome-api/awesome-api.client';
import { GeocodedPostalCode } from '../../awesome-api/awesome-api.types';
import { InvalidExternalPayloadError } from '../../common/errors/invalid-external-payload.error';
import { InvalidPostalCodeError } from '../../common/errors/invalid-postal-code.error';
import { PostalCodeNotFoundError } from '../../common/errors/postal-code-not-found.error';
import { ExternalServiceError } from '../../common/errors/external-service.error';
import { GeocodingProvider } from './geocoding-provider.interface';

@Injectable()
export class AwesomeApiGeocodingProvider implements GeocodingProvider {
  constructor(private readonly client: AwesomeApiClient) {}

  async findByCep(cep: string): Promise<GeocodedPostalCode> {
    const result = await this.client.get<unknown>(`/json/${cep}`);

    if (result.status === 400) {
      throw new InvalidPostalCodeError();
    }

    if (result.status === 404) {
      throw new PostalCodeNotFoundError();
    }

    if (result.status !== 200) {
      throw new ExternalServiceError(result.status);
    }

    return parseGeocodedPostalCode(cep, result.data);
  }
}

function parseGeocodedPostalCode(
  cep: string,
  payload: unknown,
): GeocodedPostalCode {
  if (typeof payload !== 'object' || payload === null) {
    throw new InvalidExternalPayloadError();
  }

  const record = payload as Record<string, unknown>;
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
