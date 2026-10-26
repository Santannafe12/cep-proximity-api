import { GeocodedPostalCode } from '../../awesome-api/awesome-api.types';

export interface GeocodingProvider {
  findByCep(cep: string): Promise<GeocodedPostalCode>;
}

export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
