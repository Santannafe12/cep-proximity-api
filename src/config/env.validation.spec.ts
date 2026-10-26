import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('defaults PORT when it is missing', () => {
    expect(validateEnv({}).PORT).toBe(3000);
  });

  it('defaults PORT when it is empty', () => {
    expect(validateEnv({ PORT: '' }).PORT).toBe(3000);
  });

  it('accepts a numeric port string', () => {
    expect(validateEnv({ PORT: '4000' }).PORT).toBe(4000);
  });

  it('rejects a port outside the valid range', () => {
    expect(() => validateEnv({ PORT: '70000' })).toThrow(
      'PORT must be an integer from 1 to 65535',
    );
  });

  it('defaults REDIS_URL when it is missing', () => {
    expect(validateEnv({}).REDIS_URL).toBe('redis://localhost:6379');
  });

  it('accepts a redis URL and rejects other protocols', () => {
    expect(
      validateEnv({ REDIS_URL: 'rediss://cache.internal:6380' }).REDIS_URL,
    ).toBe('rediss://cache.internal:6380');
    expect(() => validateEnv({ REDIS_URL: 'http://localhost:6379' })).toThrow(
      'REDIS_URL must be a redis or rediss URL',
    );
  });
});
