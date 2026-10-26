import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AwesomeApiClient } from './awesome-api.client';

@Module({
  imports: [HttpModule],
  providers: [AwesomeApiClient],
  exports: [AwesomeApiClient],
})
export class AwesomeApiModule {}
