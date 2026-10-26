import { Module } from '@nestjs/common';
import { AwesomeApiModule } from '../awesome-api/awesome-api.module';
import { AwesomeApiNearbyProvider } from './provider/awesome-api-nearby.provider';

@Module({
  imports: [AwesomeApiModule],
  providers: [AwesomeApiNearbyProvider],
  exports: [AwesomeApiNearbyProvider],
})
export class NearbyPostalCodesModule {}
