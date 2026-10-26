import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CACHE_KEY_PREFIX, CACHE_SCAN_COUNT } from './cache.constants';

export class CacheUnavailableError extends Error {
  readonly operation: string;

  constructor(operation: string, cause?: unknown) {
    super(`Redis ${operation} failed`);
    this.name = 'CacheUnavailableError';
    this.operation = operation;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
    });
    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis client error: ${error.message}`);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const physicalKey = this.toPhysicalKey(key);

    try {
      const raw = await this.client.get(physicalKey);
      if (raw === null) {
        return null;
      }

      return JSON.parse(raw) as T;
    } catch (error: unknown) {
      this.logFailure('read', error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.assertTtl(ttlSeconds);
    const physicalKey = this.toPhysicalKey(key);
    const payload = JSON.stringify(value);

    try {
      await this.client.set(physicalKey, payload, 'EX', ttlSeconds);
    } catch (error: unknown) {
      this.logFailure('write', error);
    }
  }

  async delete(key: string): Promise<void> {
    const physicalKey = this.toPhysicalKey(key);

    try {
      await this.client.del(physicalKey);
    } catch (error: unknown) {
      this.logFailure('delete', error);
      throw new CacheUnavailableError('delete', error);
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    const physicalKeys = keys.map((key) => this.toPhysicalKey(key));

    try {
      await this.client.del(...physicalKeys);
    } catch (error: unknown) {
      this.logFailure('deleteMany', error);
      throw new CacheUnavailableError('deleteMany', error);
    }
  }

  async clearByPrefix(logicalPrefix: string): Promise<number> {
    const matchPrefix = `${CACHE_KEY_PREFIX}${logicalPrefix}`;
    const pattern = `${matchPrefix}*`;
    let cursor = '0';
    let deleted = 0;

    try {
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          CACHE_SCAN_COUNT,
        );
        cursor = nextCursor;
        const ownKeys = keys.filter((key) => key.startsWith(matchPrefix));

        if (ownKeys.length > 0) {
          deleted += await this.client.del(...ownKeys);
        }
      } while (cursor !== '0');
    } catch (error: unknown) {
      if (error instanceof CacheUnavailableError) {
        throw error;
      }

      this.logFailure('clearByPrefix', error);
      throw new CacheUnavailableError('clearByPrefix', error);
    }

    return deleted;
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  private toPhysicalKey(key: string): string {
    if (key.trim() === '') {
      throw new Error('Cache key must not be empty');
    }

    return `${CACHE_KEY_PREFIX}${key}`;
  }

  private assertTtl(ttlSeconds: number): void {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('Cache TTL must be a positive integer number of seconds');
    }
  }

  private logFailure(operation: string, error: unknown): void {
    const message =
      error instanceof Error ? error.message : 'Unknown Redis error';
    this.logger.error(`Redis ${operation} failed: ${message}`);
  }
}
