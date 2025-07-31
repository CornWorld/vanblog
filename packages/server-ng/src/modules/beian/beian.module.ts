import { Module, OnModuleInit } from '@nestjs/common';
import { BeianController } from './beian.controller';
import { BeianService } from './beian.service';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [SettingModule],
  controllers: [BeianController],
  providers: [BeianService],
  exports: [BeianService],
})
export class BeianModule implements OnModuleInit {
  constructor(private readonly beianService: BeianService) {}

  onModuleInit(): void {
    // Register configuration on module initialization
    this.beianService.registerConfig();
  }
}
