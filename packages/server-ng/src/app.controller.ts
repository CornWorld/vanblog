import { Controller, Get } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { appContract } from './app.contract';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @TsRestHandler(appContract.hello)
  @Get()
  getHello(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(appContract.hello, async () => {
      return Promise.resolve({ status: 200 as const, body: this.appService.getHello() });
    });
  }
}
