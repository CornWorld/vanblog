import { Injectable } from '@nestjs/common';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { SocialLinkDto } from './dto/social-link.dto';

export interface SocialLink {
  type: string;
  url: string;
}

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
        if (!Array.isArray(value)) {
          return false;
        }
        for (const link of value) {
          if (typeof link !== 'object' || link === null) {
            return false;
          }
          const socialLink = link as SocialLink;
          if (typeof socialLink.type !== 'string' || typeof socialLink.url !== 'string') {
            return false;
          }
        }
        return true;
      },
    });
  }

  async getSocialLinks(): Promise<SocialLink[]> {
    const links = await this.settingRegistry.getConfig<SocialLink[]>(this.CONFIG_KEY);
    return links ?? [];
  }

  async addOrUpdateSocialLink(dto: SocialLinkDto): Promise<SocialLink[]> {
    const links = await this.getSocialLinks();
    const index = links.findIndex((link) => link.type === dto.type);
    if (index !== -1) {
      links[index] = dto;
    } else {
      links.push(dto);
    }
    return this.settingRegistry.updateConfig(this.CONFIG_KEY, links);
  }

  async deleteSocialLink(type: string): Promise<SocialLink[]> {
    const links = await this.getSocialLinks();
    const updatedLinks = links.filter((link) => link.type !== type);
    return this.settingRegistry.updateConfig(this.CONFIG_KEY, updatedLinks);
  }
}
