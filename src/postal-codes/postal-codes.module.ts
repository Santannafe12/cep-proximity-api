import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { NearbyPostalCodesModule } from '../nearby-postal-codes/nearby-postal-codes.module';
import { PostalCodesController } from './postal-codes.controller';
import { PostalCodesService } from './postal-codes.service';

@Module({
  imports: [CacheModule, GeocodingModule, NearbyPostalCodesModule],
  controllers: [PostalCodesController],
  providers: [PostalCodesService],
})
export class PostalCodesModule {}
