import { Module } from '@nestjs/common';
import { AwesomeApiModule } from '../awesome-api/awesome-api.module';
import { CacheModule } from '../cache/cache.module';
import { GeocodingService } from './geocoding.service';
import { AwesomeApiGeocodingProvider } from './provider/awesome-api-geocoding.provider';

@Module({
  imports: [AwesomeApiModule, CacheModule],
  providers: [AwesomeApiGeocodingProvider, GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}
