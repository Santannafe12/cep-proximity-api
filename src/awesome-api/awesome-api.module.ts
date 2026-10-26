import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AwesomeApiClient } from './awesome-api.client';
import { AwesomeApiRateLimiter } from './awesome-api-rate-limiter';

@Module({
  imports: [HttpModule],
  providers: [AwesomeApiRateLimiter, AwesomeApiClient],
  exports: [AwesomeApiClient],
})
export class AwesomeApiModule {}
