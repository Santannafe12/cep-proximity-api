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
});
