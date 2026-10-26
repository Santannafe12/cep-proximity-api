export class InvalidPostalCodeError extends Error {
  constructor() {
    super('Invalid postal code');
    this.name = 'InvalidPostalCodeError';
  }
}

export class PostalCodeNotFoundError extends Error {
  constructor() {
    super('Postal code was not found');
    this.name = 'PostalCodeNotFoundError';
  }
}

export class InvalidExternalPayloadError extends Error {
  constructor() {
    super('External payload is missing numeric coordinates');
    this.name = 'InvalidExternalPayloadError';
  }
}

export class ExternalServiceError extends Error {
  readonly externalStatus: number | 'timeout' | 'unavailable';

  constructor(
    externalStatus: number | 'timeout' | 'unavailable' = 'unavailable',
  ) {
    super('External service request failed');
    this.name = 'ExternalServiceError';
    this.externalStatus = externalStatus;
  }
}

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
