import {
  formatPostalCode,
  isValidPostalCode,
  normalizePostalCode,
} from './postal-code';

describe('postal code', () => {
  it('accepts eight digits and the hyphenated form', () => {
    expect(isValidPostalCode('01001000')).toBe(true);
    expect(isValidPostalCode('01001-000')).toBe(true);
  });

  it('rejects empty values, letters, the wrong length, and dotted masks', () => {
    expect(isValidPostalCode('')).toBe(false);
    expect(isValidPostalCode('abcdefgh')).toBe(false);
    expect(isValidPostalCode('123')).toBe(false);
    expect(isValidPostalCode('123456789')).toBe(false);
    expect(isValidPostalCode('1234-567')).toBe(false);
    expect(isValidPostalCode('36.000-000')).toBe(false);
  });

  it('preserves leading zeros when normalizing and formatting', () => {
    expect(normalizePostalCode('01001000')).toBe('01001000');
    expect(normalizePostalCode('01001-000')).toBe('01001000');
    expect(formatPostalCode('01001000')).toBe('01001-000');
    expect(formatPostalCode('01001-000')).toBe('01001-000');
  });

  it('does not strip unexpected characters into a valid code', () => {
    expect(() => normalizePostalCode('36.000-000')).toThrow(
      'Invalid postal code',
    );
    expect(() => formatPostalCode('36.000-000')).toThrow('Invalid postal code');
  });
});
