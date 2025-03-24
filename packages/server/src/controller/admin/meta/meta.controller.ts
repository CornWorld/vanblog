import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { version } from '../../../utils/loadConfig';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { Request } from 'express';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { getVersionFromServer } from 'src/utils/getVersion';
import { ApiToken } from 'src/provider/swagger/token';

@ApiTags('meta')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/meta')
export class MetaController {
  constructor(private readonly metaProvider: MetaProvider) {}
  @Get()
  async getAllMeta(@Req() req: Request) {
    const meta = await this.metaProvider.getAll();
    const data = {
      version: version,
      user: req.user,
      baseUrl: meta.siteInfo.baseUrl,
      enableComment: meta.siteInfo.enableComment || 'true',
      allowDomains: process.env.VAN_BLOG_ALLOW_DOMAINS || '',
    };
    return {
      statusCode: 200,
      data,
    };
  }

  @Get('upstream')
  async getUpstreamInfo() {
    const serverData = await getVersionFromServer();
    return {
      statusCode: 200,
      data: {
        version: serverData?.version || version,
        updatedAt: serverData?.updatedAt || new Date(),
      },
    };
  }
}
