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
