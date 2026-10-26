import { Module } from '@nestjs/common';
import { AwesomeApiModule } from '../awesome-api/awesome-api.module';
import { NearbyPostalCodesService } from './nearby-postal-codes.service';
import { AwesomeApiNearbyProvider } from './provider/awesome-api-nearby.provider';
import { NEARBY_POSTAL_CODES_PROVIDER } from './provider/nearby-postal-codes-provider.interface';

@Module({
  imports: [AwesomeApiModule],
  providers: [
    NearbyPostalCodesService,
    {
      provide: NEARBY_POSTAL_CODES_PROVIDER,
      useClass: AwesomeApiNearbyProvider,
    },
  ],
  exports: [NearbyPostalCodesService],
})
export class NearbyPostalCodesModule {}
