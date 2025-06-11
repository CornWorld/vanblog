import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';

dayjs.locale('zh-cn'); // TODO dep on config

export async function init() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      logLevels: ['debug', 'error', 'fatal', 'log', 'verbose', 'warn'],
      prefix: 'Vanblog',
      timestamp: true,
    }),
  });

  const config = new DocumentBuilder()
    .setTitle('Vanblog API 文档')
    .setDescription('基于当前版本的 vanblog/server 生成')
    .setVersion('0.54.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory);

  return app;
}

// @ts-expect-error import.meta.env is not available in the test environment
if (import.meta.env.PROD) {
  // 生产环境手动启动
  init().then((app) => app.listen(3000)); // TODO port
}

export const viteNodeApp = init();
