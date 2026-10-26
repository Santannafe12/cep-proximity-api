import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { CacheModule } from './cache/cache.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { NearbyPostalCodesModule } from './nearby-postal-codes/nearby-postal-codes.module';
import { PostalCodesModule } from './postal-codes/postal-codes.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.getOrThrow<number>(
              'INBOUND_RATE_LIMIT_WINDOW_MS',
            ),
            limit: configService.getOrThrow<number>('INBOUND_RATE_LIMIT_MAX'),
          },
        ],
      }),
    }),
    CacheModule,
    GeocodingModule,
    NearbyPostalCodesModule,
    PostalCodesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
