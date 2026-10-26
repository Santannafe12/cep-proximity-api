import { validateEnv } from './env.validation';

const configuredEnv = (overrides: Record<string, unknown> = {}) =>
  validateEnv({ AWESOME_API_KEY: 'fixture', ...overrides });

describe('validateEnv', () => {
  it('defaults PORT when it is missing', () => {
    expect(configuredEnv().PORT).toBe(3000);
  });

  it('defaults PORT when it is empty', () => {
    expect(configuredEnv({ PORT: '' }).PORT).toBe(3000);
  });

  it('accepts a numeric port string', () => {
    expect(configuredEnv({ PORT: '4000' }).PORT).toBe(4000);
  });

  it('rejects a port outside the valid range', () => {
    expect(() => configuredEnv({ PORT: '70000' })).toThrow(
      'PORT must be an integer from 1 to 65535',
    );
  });

  it('defaults REDIS_URL when it is missing', () => {
    expect(configuredEnv().REDIS_URL).toBe('redis://localhost:6379');
  });

  it('accepts a redis URL and rejects other protocols', () => {
    expect(
      configuredEnv({ REDIS_URL: 'rediss://cache.internal:6380' }).REDIS_URL,
    ).toBe('rediss://cache.internal:6380');
    expect(() => configuredEnv({ REDIS_URL: 'http://localhost:6379' })).toThrow(
      'REDIS_URL must be a redis or rediss URL',
    );
  });

  it('defaults the AwesomeAPI base URL and requires a key', () => {
    expect(configuredEnv().AWESOME_API_BASE_URL).toBe(
      'https://cep.awesomeapi.com.br',
    );
    expect(configuredEnv().AWESOME_API_KEY).toBe('fixture');
    expect(() => validateEnv({})).toThrow('AWESOME_API_KEY is required');
    expect(() => validateEnv({ AWESOME_API_KEY: '   ' })).toThrow(
      'AWESOME_API_KEY is required',
    );
  });
});
