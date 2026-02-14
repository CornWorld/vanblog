import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('App')
@Controller({ version: '2' })
export class AppController {
  @Get()
  getHello(): { message: string } {
    return { message: 'VanBlog API' };
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
}
