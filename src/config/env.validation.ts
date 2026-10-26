import { AWESOME_API_DEFAULT_BASE_URL } from '../awesome-api/awesome-api.types';

export const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export const DEFAULT_AWESOME_API_TIMEOUT_MS = 5000;

export const DEFAULT_AWESOME_API_RATE_LIMIT_MAX = 5;

export const DEFAULT_AWESOME_API_RATE_LIMIT_WINDOW_MS = 1000;

export const DEFAULT_INBOUND_RATE_LIMIT_MAX = 30;

export const DEFAULT_INBOUND_RATE_LIMIT_WINDOW_MS = 60000;

type EnvConfig = Record<string, unknown>;

export function validateEnv(config: EnvConfig): EnvConfig {
  return {
    ...config,
    PORT: parsePort(config.PORT),
    REDIS_URL: parseRedisUrl(config.REDIS_URL),
    AWESOME_API_BASE_URL: parseAwesomeApiBaseUrl(config.AWESOME_API_BASE_URL),
    AWESOME_API_KEY: parseAwesomeApiKey(config.AWESOME_API_KEY),
    AWESOME_API_TIMEOUT_MS: parseAwesomeApiTimeout(
      config.AWESOME_API_TIMEOUT_MS,
    ),
    INBOUND_RATE_LIMIT_MAX: parsePositiveInteger(
      config.INBOUND_RATE_LIMIT_MAX,
      DEFAULT_INBOUND_RATE_LIMIT_MAX,
      'INBOUND_RATE_LIMIT_MAX',
    ),
    INBOUND_RATE_LIMIT_WINDOW_MS: parsePositiveInteger(
      config.INBOUND_RATE_LIMIT_WINDOW_MS,
      DEFAULT_INBOUND_RATE_LIMIT_WINDOW_MS,
      'INBOUND_RATE_LIMIT_WINDOW_MS',
    ),
    AWESOME_API_RATE_LIMIT_MAX: parsePositiveInteger(
      config.AWESOME_API_RATE_LIMIT_MAX,
      DEFAULT_AWESOME_API_RATE_LIMIT_MAX,
      'AWESOME_API_RATE_LIMIT_MAX',
    ),
    AWESOME_API_RATE_LIMIT_WINDOW_MS: parsePositiveInteger(
      config.AWESOME_API_RATE_LIMIT_WINDOW_MS,
      DEFAULT_AWESOME_API_RATE_LIMIT_WINDOW_MS,
      'AWESOME_API_RATE_LIMIT_WINDOW_MS',
    ),
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

function parseAwesomeApiTimeout(rawTimeout: unknown): number {
  if (rawTimeout === undefined || rawTimeout === '') {
    return DEFAULT_AWESOME_API_TIMEOUT_MS;
  }

  const timeout =
    typeof rawTimeout === 'number' ? rawTimeout : Number(rawTimeout);
  if (!Number.isInteger(timeout) || timeout < 1) {
    throw new Error('AWESOME_API_TIMEOUT_MS must be a positive integer');
  }

  return timeout;
}

function parsePositiveInteger(
  raw: unknown,
  fallback: number,
  name: string,
): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function parseAwesomeApiKey(rawApiKey: unknown): string {
  if (typeof rawApiKey !== 'string' || rawApiKey.trim() === '') {
    throw new Error('AWESOME_API_KEY is required');
  }

  return rawApiKey.trim();
}
