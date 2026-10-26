import { Inject, Injectable } from '@nestjs/common';
import { NearbyPostalCodeCandidate } from './nearby-postal-code-candidate';
import {
  NEARBY_POSTAL_CODES_PROVIDER,
  NearbyPostalCodesProvider,
} from './provider/nearby-postal-codes-provider.interface';

@Injectable()
export class NearbyPostalCodesService {
  constructor(
    @Inject(NEARBY_POSTAL_CODES_PROVIDER)
    private readonly provider: NearbyPostalCodesProvider,
  ) {}

  findByCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<NearbyPostalCodeCandidate[]> {
    return this.provider.findByCoordinates(latitude, longitude);
  }
}
