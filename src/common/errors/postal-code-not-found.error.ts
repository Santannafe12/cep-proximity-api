export class PostalCodeNotFoundError extends Error {
  constructor() {
    super('Postal code was not found');
    this.name = 'PostalCodeNotFoundError';
  }
}
