import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExternalServiceError } from '../common/errors';
import { AwesomeApiRateLimiter } from './awesome-api-rate-limiter';
import { AwesomeApiHttpResult } from './awesome-api.types';

@Injectable()
export class AwesomeApiClient {
  private readonly logger = new Logger(AwesomeApiClient.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly rateLimiter: AwesomeApiRateLimiter,
  ) {}

  async get<T>(
    path: string,
    query?: Record<string, string | number>,
  ): Promise<AwesomeApiHttpResult<T>> {
    if (!path.startsWith('/') || path.includes('?')) {
      throw new Error('AwesomeAPI path must be a queryless absolute path');
    }

    const apiKey = this.configService.getOrThrow<string>('AWESOME_API_KEY');
    const url = this.requestUrl(path, apiKey, query);
    const timeoutMs = this.configService.getOrThrow<number>(
      'AWESOME_API_TIMEOUT_MS',
    );
    await this.rateLimiter.acquire();
    const startedAt = Date.now();
    let response: { status: number; data: T };

    try {
      response = await firstValueFrom(
        this.httpService.get<T>(url, {
          headers: { 'x-api-key': apiKey },
          timeout: timeoutMs,
          validateStatus: () => true,
        }),
      );
    } catch (error: unknown) {
      const status = isTimeoutError(error) ? 'timeout' : 'unavailable';
      this.logger.error(
        `operation=${path} status=${status} durationMs=${Date.now() - startedAt}`,
      );
      throw new ExternalServiceError(status);
    }

    this.logger.log(
      `operation=${path} status=${response.status} durationMs=${Date.now() - startedAt}`,
    );
    return { status: response.status, data: response.data };
  }

  private requestUrl(
    path: string,
    apiKey: string,
    query?: Record<string, string | number>,
  ): string {
    const url = new URL(`${this.baseUrl()}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) {
      if (name.toLowerCase() === 'token') {
        throw new Error('AwesomeAPI key must not be sent in the URL');
      }
      url.searchParams.append(name, String(value));
    }

    const href = url.toString();
    if (href.includes(apiKey) || href.includes('token=')) {
      throw new Error('AwesomeAPI key must not be sent in the URL');
    }

    return href;
  }

  private baseUrl(): string {
    return this.configService
      .getOrThrow<string>('AWESOME_API_BASE_URL')
      .replace(/\/$/, '');
  }
}

function isTimeoutError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
}
