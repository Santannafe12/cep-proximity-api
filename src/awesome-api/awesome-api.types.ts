export const AWESOME_API_DEFAULT_BASE_URL = 'https://cep.awesomeapi.com.br';

export type GeocodedPostalCode = {
  cep: string;
  latitude: number;
  longitude: number;
};

export type AwesomeApiHttpResult<T> = {
  status: number;
  data: T;
};
