import { Controller, Delete, Param } from '@nestjs/common';
import { InvalidPostalCodeError } from '../common/errors';
import {
  isValidPostalCode,
  normalizePostalCode,
} from '../common/utils/postal-code';
import { CacheService } from './cache.service';

@Controller('cache/ceps')
export class CacheController {
  constructor(private readonly cache: CacheService) {}

  @Delete()
  async clearApplicationCache(): Promise<{ removed: number }> {
    const removed = await this.cache.clearByPrefix('');
    return { removed };
  }

  @Delete(':cep')
  async clearPostalCode(
    @Param('cep') cep: string,
  ): Promise<{ removed: number }> {
    if (!isValidPostalCode(cep)) {
      throw new InvalidPostalCodeError();
    }

    const normalizedCep = normalizePostalCode(cep);
    const removed = await this.cache.deleteMany([
      `geocoding:${normalizedCep}`,
      `nearby-ceps:${normalizedCep}`,
    ]);
    return { removed };
  }
}
