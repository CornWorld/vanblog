import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { PluginModule } from '../plugin/plugin.module';

import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [DatabaseModule, PluginModule],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookRegistryService],
  exports: [WebhookService, WebhookRegistryService],
})
export class WebhookModule {}
