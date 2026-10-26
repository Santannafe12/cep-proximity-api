import { Test } from '@nestjs/testing';
import { AwesomeApiClient } from '../../awesome-api/awesome-api.client';
import {
  InvalidExternalPayloadError,
  InvalidPostalCodeError,
  PostalCodeNotFoundError,
} from '../../common/errors';
import { AwesomeApiGeocodingProvider } from './awesome-api-geocoding.provider';

describe('AwesomeApiGeocodingProvider', () => {
  let provider: AwesomeApiGeocodingProvider;
  const client = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AwesomeApiGeocodingProvider,
        { provide: AwesomeApiClient, useValue: client },
      ],
    }).compile();

    provider = moduleRef.get(AwesomeApiGeocodingProvider);
  });

  it('converts string coordinates and drops the other response fields', async () => {
    client.get.mockResolvedValue({
      status: 200,
      data: {
        cep: '01001000',
        lat: '-23.5500806',
        lng: '-46.6340827',
        address: 'Praça da Sé',
        city: 'São Paulo',
      },
    });

    await expect(provider.findByCep('01001000')).resolves.toEqual({
      cep: '01001000',
      latitude: -23.5500806,
      longitude: -46.6340827,
    });
    expect(client.get).toHaveBeenCalledWith('/json/01001000');
  });

  it('maps an external 400 to an invalid postal code', async () => {
    client.get.mockResolvedValue({
      status: 400,
      data: { code: 'invalid', message: 'CEP invalido' },
    });

    await expect(provider.findByCep('123')).rejects.toBeInstanceOf(
      InvalidPostalCodeError,
    );
  });

  it('maps an external 404 to a missing postal code', async () => {
    client.get.mockResolvedValue({
      status: 404,
      data: { code: 'not_found', message: 'O CEP 00000000 nao foi encontrado' },
    });

    await expect(provider.findByCep('00000000')).rejects.toBeInstanceOf(
      PostalCodeNotFoundError,
    );
  });

  it('rejects a payload without numeric coordinates', async () => {
    client.get.mockResolvedValue({
      status: 200,
      data: { cep: '01001000', address: 'Praça da Sé' },
    });

    await expect(provider.findByCep('01001000')).rejects.toBeInstanceOf(
      InvalidExternalPayloadError,
    );
  });
});
