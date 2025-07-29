import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from './core/logger/logger.module';
import { DatabaseModule } from './database';

@Module({
  imports: [ConfigModule, EventEmitterModule.forRoot(), DatabaseModule, LoggerModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
