import { Injectable } from '@nestjs/common';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { BeianInfoDto } from './dto/beian-info.dto';

export interface BeianInfo {
  icp?: string;
  gov?: string;
  govUrl?: string;
  showBeian?: boolean;
}

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
        if (typeof value !== 'object' || value === null) {
          return false;
        }
        const beianValue = value as BeianInfo;
        if (beianValue.icp !== undefined && typeof beianValue.icp !== 'string') {
          return false;
        }
        if (beianValue.gov !== undefined && typeof beianValue.gov !== 'string') {
          return false;
        }
        if (beianValue.govUrl !== undefined && typeof beianValue.govUrl !== 'string') {
          return false;
        }
        if (beianValue.showBeian !== undefined && typeof beianValue.showBeian !== 'boolean') {
          return false;
        }
        return true;
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
