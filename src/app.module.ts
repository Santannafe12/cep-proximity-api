import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { CacheModule } from './cache/cache.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    CacheModule,
    GeocodingModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
