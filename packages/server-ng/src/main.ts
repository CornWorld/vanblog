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
import { HttpExceptionFilter, AllExceptionsFilter } from './core/filters';
import { ETagCacheInterceptor, DerivedViewInterceptor } from './core/interceptors';
import { LoggerService } from './core/logger/logger.service';
import { DerivedViewCacheService } from './shared/cache';
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
        'This is the new modular, high-performance API server for VanBlog.\n\n' +
        'Features:\n' +
        '- RESTful API design\n' +
        '- JWT authentication with fine-grained permissions\n' +
        '- Comprehensive error handling\n' +
        '- Request validation\n' +
        '- OpenAPI 3.0 compliant\n\n' +
        '## Permission System\n\n' +
        'The API uses a sophisticated permission system with the following features:\n\n' +
        '### Permission Format\n' +
        '- **Module Permissions**: `module:action` (e.g., `article:read`, `user:write`)\n' +
        '- **Role Permissions**: `role:name` (e.g., `role:admin`, `role:editor`)\n' +
        '- **Universal Permission**: `all` (grants access to everything)\n' +
        '- **Permission Revocation**: `no:permission` (e.g., `no:article:delete`, `no:role:admin`)\n\n' +
        '### Semantic Permissions\n' +
        'Use the modern @Permission or @Perm decorators with these formats:\n' +
        '- `@Permission("module:action")` - Full permission name format\n' +
        '- `@Permission("module", ["read", "write"])` - Module with action array\n' +
        '- `@Permission("module:action1", "module:action2")` - Multiple permissions\n\n' +
        'When using `@ModuleContext()` decorator, you can use semantic names:\n' +
        '- `read`, `write`, `delete` instead of `module:read`, `module:write`, `module:delete`\n\n' +
        '### Permission Resolution\n' +
        'Permissions are processed in order (later entries override earlier ones):\n' +
        '1. Universal permissions (`all`)\n' +
        '2. Role expansion (`role:admin` → expanded permissions)\n' +
        '3. Direct permissions (`article:read`)\n' +
        '4. Permission revocation (`no:article:delete`)\n\n' +
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

  // Cookie parser (required for CSRF protection)
  app.use(cookieParser());

  // CSRF protection
  if (process.env.NODE_ENV !== 'test') {
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

  // Global interceptors: DerivedView must run BEFORE ETag so ETag hashes the final response body
  app.useGlobalInterceptors(
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
  await app.listen(port);

  // Use logger instead of console.log
  const logger = app.get(LoggerService);
  logger.log(`Application is running on: http://localhost:${String(port)}`, 'Bootstrap');
  logger.log(
    `API Documentation available at: http://localhost:${String(port)}${configService.app.apiPrefix}/docs`,
    'Bootstrap',
  );
});

export const viteNodeApp = init();
