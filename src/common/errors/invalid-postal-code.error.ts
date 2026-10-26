export class InvalidPostalCodeError extends Error {
  constructor() {
    super('Invalid postal code');
    this.name = 'InvalidPostalCodeError';
  }
}
