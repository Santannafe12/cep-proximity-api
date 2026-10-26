export class InvalidExternalPayloadError extends Error {
  constructor() {
    super('External payload is missing numeric coordinates');
    this.name = 'InvalidExternalPayloadError';
  }
}
