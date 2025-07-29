import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { ConsoleLogger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
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

// @ts-expect-error import.meta.env is not available in the test environment
if (import.meta.env.PROD) {
  // 生产环境手动启动
  init().then(async (app) => {
    const configService = app.get(ConfigService);
    const port = configService.app.port;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
  });
}

export const viteNodeApp = init();
