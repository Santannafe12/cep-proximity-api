import { AWESOME_API_DEFAULT_BASE_URL } from '../awesome-api/awesome-api.types';
import { DEFAULT_REDIS_URL } from '../cache/cache.constants';

type EnvConfig = Record<string, unknown>;

export function validateEnv(config: EnvConfig): EnvConfig {
  return {
    ...config,
    PORT: parsePort(config.PORT),
    REDIS_URL: parseRedisUrl(config.REDIS_URL),
    AWESOME_API_BASE_URL: parseAwesomeApiBaseUrl(config.AWESOME_API_BASE_URL),
    AWESOME_API_KEY: parseAwesomeApiKey(config.AWESOME_API_KEY),
  };
}

function parsePort(rawPort: unknown): number {
  if (rawPort === undefined || rawPort === '') {
    return 3000;
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }

  return port;
}

function parseRedisUrl(rawRedisUrl: unknown): string {
  if (rawRedisUrl === undefined || rawRedisUrl === '') {
    return DEFAULT_REDIS_URL;
  }

  if (typeof rawRedisUrl !== 'string') {
    throw new Error('REDIS_URL must be a redis or rediss URL');
  }

  try {
    const url = new URL(rawRedisUrl);
    if (
      (url.protocol === 'redis:' || url.protocol === 'rediss:') &&
      url.hostname
    ) {
      return rawRedisUrl;
    }
  } catch {
    throw new Error('REDIS_URL must be a redis or rediss URL');
  }

  throw new Error('REDIS_URL must be a redis or rediss URL');
}

function parseAwesomeApiBaseUrl(rawBaseUrl: unknown): string {
  if (rawBaseUrl === undefined || rawBaseUrl === '') {
    return AWESOME_API_DEFAULT_BASE_URL;
  }

  if (typeof rawBaseUrl !== 'string') {
    throw new Error('AWESOME_API_BASE_URL must be an http or https URL');
  }

  try {
    const url = new URL(rawBaseUrl);
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname
    ) {
      return rawBaseUrl.replace(/\/$/, '');
    }
  } catch {
    throw new Error('AWESOME_API_BASE_URL must be an http or https URL');
  }

  throw new Error('AWESOME_API_BASE_URL must be an http or https URL');
}

function parseAwesomeApiKey(rawApiKey: unknown): string {
  if (typeof rawApiKey !== 'string' || rawApiKey.trim() === '') {
    throw new Error('AWESOME_API_KEY is required');
  }

  return rawApiKey.trim();
}
