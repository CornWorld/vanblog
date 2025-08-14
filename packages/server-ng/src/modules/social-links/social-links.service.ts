import { Injectable } from '@nestjs/common';

import { SettingRegistryService } from '../setting/services/setting-registry.service';

import { SocialLinkDto } from './social-links.dto';
import { SocialLinkArraySchema, type SocialLink } from './social-links.schema';

@Injectable()
export class SocialLinksService {
  private readonly CONFIG_KEY = 'socialLinks';

  constructor(private readonly settingRegistry: SettingRegistryService) {}

  registerConfig(): void {
    this.settingRegistry.registerConfig({
      key: this.CONFIG_KEY,
      defaultValue: [],
      description: 'Links for social media platforms',
      validator: (value: unknown) => {
        const result = SocialLinkArraySchema.safeParse(value);
        return result.success;
      },
    });
  }

  async getSocialLinks(): Promise<SocialLink[]> {
    const links = await this.settingRegistry.getConfig<SocialLink[]>(this.CONFIG_KEY);
    return links ?? [];
  }

  async addOrUpdateSocialLink(dto: SocialLinkDto): Promise<SocialLink[]> {
    const links = await this.getSocialLinks();
    const linkData: SocialLink = {
      type: dto.type,
      url: dto.url,
    };
    const index = links.findIndex((link) => link.type === dto.type);
    if (index !== -1) {
      links[index] = linkData;
    } else {
      links.push(linkData);
    }
    return this.settingRegistry.updateConfig(this.CONFIG_KEY, links);
  }

  async deleteSocialLink(type: string): Promise<SocialLink[]> {
    const links = await this.getSocialLinks();
    const updatedLinks = links.filter((link) => link.type !== type);
    return this.settingRegistry.updateConfig(this.CONFIG_KEY, updatedLinks);
  }
}
