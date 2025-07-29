import { Global, Module, DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigFactory } from '@nestjs/config';
import { ConfigService } from './config.service';
import { validateConfig } from './config.schema';
import databaseConfig from './database.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validate: validateConfig,
      load: [databaseConfig],
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService, NestConfigModule],
})
export class ConfigModule {
  static forFeature(config: ConfigFactory): DynamicModule {
    return NestConfigModule.forFeature(config);
  }
}
