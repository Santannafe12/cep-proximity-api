import { Module } from '@nestjs/common';
import { AwesomeApiModule } from '../awesome-api/awesome-api.module';
import { CacheModule } from '../cache/cache.module';
import { GeocodingService } from './geocoding.service';
import { AwesomeApiGeocodingProvider } from './provider/awesome-api-geocoding.provider';
import { GEOCODING_PROVIDER } from './provider/geocoding-provider.interface';

@Module({
  imports: [AwesomeApiModule, CacheModule],
  providers: [
    GeocodingService,
    {
      provide: GEOCODING_PROVIDER,
      useClass: AwesomeApiGeocodingProvider,
    },
  ],
  exports: [GeocodingService],
})
export class GeocodingModule {}
