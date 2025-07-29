import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, type INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from './config';

import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';

dayjs.locale('zh-cn'); // TODO dep on config

export async function init(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      logLevels: ['debug', 'error', 'fatal', 'log', 'verbose', 'warn'],
      prefix: 'Vanblog',
      timestamp: true,
    }),
  });

  const configService = app.get(ConfigService);
  const appConfig = configService.app;

  const config = new DocumentBuilder()
    .setTitle('Vanblog API 文档')
    .setDescription('基于当前版本的 vanblog/server 生成')
    .setVersion('0.54.0')
    .build();
  const documentFactory = (): OpenAPIObject => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory);

  app.setGlobalPrefix(appConfig.apiPrefix);

  return app;
}

interface ImportMeta {
  env?: {
    PROD?: boolean;
  };
}

if ((import.meta as ImportMeta).env?.PROD) {
  // 生产环境手动启动
  void init().then(async (app) => {
    const configService = app.get(ConfigService);
    const port = configService.app.port;
    await app.listen(port);

    // Use logger instead of console.log
    const logger = new ConsoleLogger('Bootstrap');
    logger.log(`Application is running on: http://localhost:${String(port)}`);
  });
}

export const viteNodeApp = init();
