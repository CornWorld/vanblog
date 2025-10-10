import { VersioningType, type INestApplication } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import dayjs from 'dayjs';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { ConfigService } from './config';
import {
  getProductionSecurityConfig,
  getDevelopmentSecurityConfig,
} from './config/security.config';
import { HttpExceptionFilter, AllExceptionsFilter } from './core/filters';
import {
  ETagCacheInterceptor,
  DerivedViewInterceptor,
  PerformanceInterceptor,
} from './core/interceptors';
import { LoggerService } from './core/logger/logger.service';
import { DerivedViewCacheService } from './shared/cache';
// import { patchNestJsSwagger } from 'nestjs-zod'; // Not available in current version

// Removed static locale import to allow dynamic, config-driven locale loading

export async function init(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(), {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const appConfig = configService.app;

  // Configure dayjs locale from config
  try {
    if (appConfig.locale !== 'en') {
      await import(`dayjs/locale/${appConfig.locale}`);
    }
    dayjs.locale(appConfig.locale);
  } catch {
    dayjs.locale('en');
  }

  // Use custom logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Set global prefix first
  app.setGlobalPrefix(appConfig.apiPrefix);

  // Enable API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '2',
  });

  // patchNestJsSwagger(); // Not available in current version

  // Swagger/OpenAPI configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('VanBlog API v2')
    .setDescription(
      'VanBlog Next Generation API Documentation\n\n' +
        '### Authorization Headers\n' +
        'Protected endpoints require a valid JWT token in the Authorization header:\n' +
        '```\n' +
        'Authorization: Bearer <your-jwt-token>\n' +
        '```\n\n' +
        'Endpoints with permission requirements will return:\n' +
        '- `401 Unauthorized`: Missing or invalid token\n' +
        '- `403 Forbidden`: Valid token but insufficient permissions',
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
    .addTag('Analytics', 'Analytics and statistics endpoints')
    .addTag('System', 'System configuration endpoints')
    .setContact('VanBlog Team', 'https://github.com/Mereithhh/vanblog', 'support@vanblog.dev')
    .setLicense('GPL v3', 'https://www.gnu.org/licenses/gpl-3.0.html')
    .addServer(`http://localhost:${String(appConfig.port)}`, 'Development server')
    // .addServer('https://api.vanblog.corn.im', 'Production server') // no server provided currently
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

  // Enable CORS
  const corsOptions = configService.cors;
  app.enableCors(corsOptions);

  // Security middlewares
  const isProduction = process.env.NODE_ENV === 'production';
  const securityConfig = isProduction
    ? getProductionSecurityConfig(corsOptions.origin)
    : getDevelopmentSecurityConfig(corsOptions.origin);

  app.use(helmet(securityConfig.helmet));

  // Cookie parser (required for CSRF protection)
  app.use(cookieParser());

  // CSRF protection
  if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
    app.use(
      csurf({
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        },
      }),
    );
  }

  // Enable compression
  app.use(compression());

  // Global pipes - using ZodValidationPipe per endpoint instead of global ValidationPipe

  // Global exception filters
  app.useGlobalFilters(new AllExceptionsFilter(logger), new HttpExceptionFilter(logger));

  // Global interceptors: Performance must run FIRST, then DerivedView, then ETag
  app.useGlobalInterceptors(
    new PerformanceInterceptor(logger),
    new DerivedViewInterceptor(app.get(Reflector), app.get(DerivedViewCacheService)),
    new ETagCacheInterceptor(),
  );

  logger.log(`Application configured with prefix: ${appConfig.apiPrefix}`, 'Bootstrap');
  logger.log(`CORS enabled with options: ${JSON.stringify(corsOptions)}`, 'Bootstrap');
  logger.log('Security middlewares (Helmet) and compression enabled', 'Bootstrap');
  logger.log('Global validation pipe and exception filters configured', 'Bootstrap');

  return app;
}

// 启动应用
void init().then(async (app) => {
  const configService = app.get(ConfigService);
  const { port } = configService.app;
  await app.listen(port, '0.0.0.0');

  // Use logger instead of console.log
  const logger = app.get(LoggerService);
  logger.log(`Application is running on: http://localhost:${String(port)}`, 'Bootstrap');
  logger.log(
    `API Documentation available at: http://localhost:${String(port)}/${configService.app.apiPrefix}/docs`,
    'Bootstrap',
  );
});

export const viteNodeApp = init();
