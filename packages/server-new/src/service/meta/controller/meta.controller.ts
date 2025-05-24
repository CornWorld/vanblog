import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { version } from '../../../common/config/loadConfig';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { Request } from 'express';
import { MetaProvider } from '../provider/meta.provider';
import { getVersionFromServer } from '../../../common/utils/getVersion';
import { ApiToken } from '../../../common/swagger/token';
import { Result } from 'src/common/result/Result';

@ApiTags('meta')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/meta')
export class MetaController {
  constructor(private readonly metaProvider: MetaProvider) { }
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
    return Result.ok(data).toObject();
  }

  @Get('upstream')
  async getUpstreamInfo() {
    const serverData = await getVersionFromServer();
    return Result.ok(
      {
        version: serverData?.version || version,
        updatedAt: serverData?.updatedAt || new Date(),
      }
    ).toObject();
  }
}
