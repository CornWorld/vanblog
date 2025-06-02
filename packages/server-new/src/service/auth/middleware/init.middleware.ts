import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InitProvider } from '../../meta/provider/init.provider';
import { Result } from 'src/common/result/Result';

@Injectable()
export class InitMiddleware implements NestMiddleware {


  constructor(
    private readonly initProvider: InitProvider,
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.path == '/api/admin/init') {
      next();
    } else {
      const hasInit = await this.initProvider.checkHasInited();
      if (hasInit) {
        next();
      } else {
        const data = {
          allowDomains: process.env.VAN_BLOG_ALLOW_DOMAINS || '',
        };
        res.json(Result.build(data, 233, '未初始化!'))
      }
    }
  }
}
