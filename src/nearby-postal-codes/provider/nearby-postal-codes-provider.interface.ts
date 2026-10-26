import { NearbyPostalCodeCandidate } from '../nearby-postal-code-candidate';

export interface NearbyPostalCodesProvider {
  findByCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<NearbyPostalCodeCandidate[]>;
}

export const NEARBY_POSTAL_CODES_PROVIDER = Symbol(
  'NEARBY_POSTAL_CODES_PROVIDER',
);
