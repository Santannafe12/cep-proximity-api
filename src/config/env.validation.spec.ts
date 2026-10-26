import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('defaults the AwesomeAPI base URL and requires a key', () => {
    const env = validateEnv({ AWESOME_API_KEY: 'fixture' });

    expect(env.AWESOME_API_BASE_URL).toBe('https://cep.awesomeapi.com.br');
    expect(env.AWESOME_API_KEY).toBe('fixture');
    expect(env.AWESOME_API_TIMEOUT_MS).toBe(5000);
    expect(env.INBOUND_RATE_LIMIT_MAX).toBe(30);
    expect(env.INBOUND_RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(env.AWESOME_API_RATE_LIMIT_MAX).toBe(5);
    expect(env.AWESOME_API_RATE_LIMIT_WINDOW_MS).toBe(1000);
    expect(() => validateEnv({})).toThrow('AWESOME_API_KEY is required');
    expect(() => validateEnv({ AWESOME_API_KEY: '   ' })).toThrow(
      'AWESOME_API_KEY is required',
    );
  });
});
