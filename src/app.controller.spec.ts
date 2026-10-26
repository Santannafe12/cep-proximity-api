import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = moduleRef.get(AppController);
  });

  it('returns ok for the health check', () => {
    expect(appController.getHealth()).toEqual({ status: 'ok' });
  });
});
