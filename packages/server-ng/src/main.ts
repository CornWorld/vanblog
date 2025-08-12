import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';
import compression from 'compression';
import dayjs from 'dayjs';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { ConfigService } from './config';
import { HttpExceptionFilter, AllExceptionsFilter } from './core/filters';
import { LoggerService } from './core/logger/logger.service';

import type { INestApplication } from '@nestjs/common';
// import { patchNestJsSwagger } from 'nestjs-zod'; // Not available in current version

import 'dayjs/locale/zh-cn';

dayjs.locale('zh-cn'); // TODO dep on config

export async function init(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(), {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const appConfig = configService.app;

  // Use custom logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // patchNestJsSwagger(); // Not available in current version

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

  // Enable CORS
  const corsOptions = configService.cors;
  app.enableCors(corsOptions);

  // Security middlewares
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // Enable compression
  app.use(compression());

  // Global pipes - using ZodValidationPipe per endpoint instead of global ValidationPipe

  // Global exception filters
  app.useGlobalFilters(new AllExceptionsFilter(logger), new HttpExceptionFilter(logger));

  logger.log(`Application configured with prefix: ${appConfig.apiPrefix}`, 'Bootstrap');
  logger.log(`CORS enabled with options: ${JSON.stringify(corsOptions)}`, 'Bootstrap');
  logger.log('Security middlewares (Helmet) and compression enabled', 'Bootstrap');
  logger.log('Global validation pipe and exception filters configured', 'Bootstrap');

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
    const { port } = configService.app;
    await app.listen(port);

    // Use logger instead of console.log
    const logger = app.get(LoggerService);
    logger.log(`Application is running on: http://localhost:${String(port)}`, 'Bootstrap');
    logger.log(
      `API Documentation available at: http://localhost:${String(port)}${configService.app.apiPrefix}/docs`,
      'Bootstrap',
    );
  });
}

export const viteNodeApp = init();
