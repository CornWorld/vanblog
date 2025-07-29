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

  // Swagger/OpenAPI configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('VanBlog API v2')
    .setDescription(
      'VanBlog Next Generation API Documentation\n\n' +
        'This is the new modular, high-performance API server for VanBlog.\n\n' +
        'Features:\n' +
        '- RESTful API design\n' +
        '- JWT authentication\n' +
        '- Comprehensive error handling\n' +
        '- Request validation\n' +
        '- OpenAPI 3.0 compliant',
    )
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'jwt', // This is the reference name for security
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Articles', 'Article management endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Categories', 'Category management endpoints')
    .addTag('Tags', 'Tag management endpoints')
    .addTag('Media', 'Media resource management endpoints')
    .addTag('Analytics', 'Analytics and statistics endpoints')
    .addTag('System', 'System configuration endpoints')
    .setContact('VanBlog Team', 'https://github.com/Mereithhh/vanblog', 'support@vanblog.dev')
    .setLicense('GPL v3', 'https://www.gnu.org/licenses/gpl-3.0.html')
    .addServer(`http://localhost:${String(appConfig.port)}`, 'Development server')
    .addServer('https://api.vanblog.dev', 'Production server')
    .build();

  const documentFactory = (): OpenAPIObject => SwaggerModule.createDocument(app, swaggerConfig);

  // Setup Swagger UI at /api/docs
  SwaggerModule.setup(`${appConfig.apiPrefix}/docs`, app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'VanBlog API Documentation',
  });

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
