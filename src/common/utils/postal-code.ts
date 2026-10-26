import {
  POSTAL_CODE_DIGITS_PATTERN,
  POSTAL_CODE_HYPHENATED_PATTERN,
  POSTAL_CODE_LENGTH,
} from '../constants/postal-code.constants';

export function isValidPostalCode(value: string): boolean {
  return (
    POSTAL_CODE_DIGITS_PATTERN.test(value) ||
    POSTAL_CODE_HYPHENATED_PATTERN.test(value)
  );
}

export function normalizePostalCode(value: string): string {
  if (!isValidPostalCode(value)) {
    throw new Error('Invalid postal code');
  }

  return value.replace('-', '');
}

export function formatPostalCode(value: string): string {
  const digits = normalizePostalCode(value);
  return `${digits.slice(0, POSTAL_CODE_LENGTH - 3)}-${digits.slice(POSTAL_CODE_LENGTH - 3)}`;
}
