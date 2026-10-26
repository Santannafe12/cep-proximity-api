import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExternalServiceError } from '../common/errors/external-service.error';
import { AwesomeApiHttpResult } from './awesome-api.types';

@Injectable()
export class AwesomeApiClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async get<T>(path: string): Promise<AwesomeApiHttpResult<T>> {
    if (!path.startsWith('/') || path.includes('?')) {
      throw new Error('AwesomeAPI path must be a queryless absolute path');
    }

    const apiKey = this.configService.getOrThrow<string>('AWESOME_API_KEY');
    const url = `${this.baseUrl()}${path}`;
    if (url.includes(apiKey) || url.includes('token=')) {
      throw new Error('AwesomeAPI key must not be sent in the URL');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(url, {
          headers: { 'x-api-key': apiKey },
          validateStatus: () => true,
        }),
      );

      return { status: response.status, data: response.data };
    } catch {
      throw new ExternalServiceError();
    }
  }

  private baseUrl(): string {
    return this.configService
      .getOrThrow<string>('AWESOME_API_BASE_URL')
      .replace(/\/$/, '');
  }
}
