import { DEFAULT_REDIS_URL } from '../cache/cache.constants';

type EnvConfig = Record<string, unknown>;

export function validateEnv(config: EnvConfig): EnvConfig {
  return {
    ...config,
    PORT: parsePort(config.PORT),
    REDIS_URL: parseRedisUrl(config.REDIS_URL),
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
