import { Injectable } from '@nestjs/common';

import { SettingRegistryService } from '../setting/services/setting-registry.service';

import { BeianInfoDto } from './beian.dto';
import { BeianInfoSchema, BeianInfo } from './beian.schema';

@Injectable()
export class BeianService {
  private readonly CONFIG_KEY = 'beian';

  constructor(private readonly settingRegistry: SettingRegistryService) {}

  registerConfig(): void {
    this.settingRegistry.registerConfig({
      key: this.CONFIG_KEY,
      defaultValue: {
        showBeian: false,
      },
      description: 'Website beian (ICP/Gov) information',
      validator: (value: unknown) => {
        const result = BeianInfoSchema.safeParse(value);
        return result.success;
      },
    });
  }

  async getBeianInfo(): Promise<BeianInfo> {
    const info = await this.settingRegistry.getConfig<BeianInfo>(this.CONFIG_KEY);
    return info ?? { showBeian: false };
  }

  async updateBeianInfo(dto: BeianInfoDto): Promise<BeianInfo> {
    const current = await this.getBeianInfo();
    const updated = Object.assign({}, current, dto);
    return this.settingRegistry.updateConfig(this.CONFIG_KEY, updated);
  }
}
