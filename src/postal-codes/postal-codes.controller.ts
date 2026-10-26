import { Controller, Get, Param } from '@nestjs/common';
import { NearbyPostalCodeResponse } from './dto/nearby-postal-code.response';
import { PostalCodesService } from './postal-codes.service';

@Controller()
export class PostalCodesController {
  constructor(private readonly postalCodes: PostalCodesService) {}

  @Get('ceps-proximos/:cep')
  findNearby(@Param('cep') cep: string): Promise<NearbyPostalCodeResponse[]> {
    return this.postalCodes.findNearby(cep);
  }
}
