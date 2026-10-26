export class ExternalServiceError extends Error {
  constructor() {
    super('External service request failed');
    this.name = 'ExternalServiceError';
  }
}
