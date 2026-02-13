import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { appContract } from './app.contract';
import { AppService } from './app.service';

@ApiTags('App')
@Controller({ version: '2' })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @TsRestHandler(appContract.hello)
  @Get()
  getHello(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(appContract.hello, async () => {
      return Promise.resolve({ status: 200 as const, body: this.appService.getHello() });
    });
  }

  /**
   * Get version info endpoint
   * Maps to contract.getVersion at path /v2/meta/version
   */
  @Get('meta/version')
  @ApiOperation({ summary: 'Get version info' })
  @ApiResponse({ status: 200, description: 'Version information' })
  getVersion(): {
    version: string;
    latestVersion: string;
    needUpdate: boolean;
  } {
    return {
      version: process.env.npm_package_version ?? '0.54.0-corn.6',
      latestVersion: process.env.npm_package_version ?? '0.54.0-corn.6',
      needUpdate: false,
    };
  }

  @TsRestHandler(contract.getVersion)
  @Get()
  getVersionHandler(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getVersion, () => {
      const version = process.env.npm_package_version ?? '0.54.0-corn.6';
      return {
        status: 200,
        body: {
          version,
          latestVersion: version,
          needUpdate: false,
        },
      };
    });
  }
}
