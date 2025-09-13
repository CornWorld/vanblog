import { z } from 'zod';

import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';

export const SocialLinkSchema = z.object({
  type: z.string().min(1),
  url: z.string().min(1),
});

const SocialLinksSchema = z.array(SocialLinkSchema);

export type SocialLink = z.infer<typeof SocialLinkSchema>;

export class SocialLinksService {
  private readonly CONFIG_KEY = 'socialLinks';

  async getSocialLinks(context: PluginContext): Promise<SocialLink[]> {
    const linksRaw = await context.data.get<unknown>(this.CONFIG_KEY);
    if (linksRaw == null) return [];
    const parsed = SocialLinksSchema.safeParse(linksRaw);
    return parsed.success ? parsed.data : [];
  }

  async addOrUpdateSocialLink(
    context: PluginContext,
    dto: { type: string; url: string },
  ): Promise<SocialLink[]> {
    const links = await this.getSocialLinks(context);
    const linkData = SocialLinkSchema.parse(dto);
    const index = links.findIndex((link) => link.type === dto.type);
    if (index !== -1) {
      links[index] = linkData;
    } else {
      links.push(linkData);
    }
    await context.data.set(this.CONFIG_KEY, links);
    return links;
  }

  async deleteSocialLink(context: PluginContext, type: string): Promise<SocialLink[]> {
    const links = await this.getSocialLinks(context);
    const updatedLinks = links.filter((link) => link.type !== type);
    await context.data.set(this.CONFIG_KEY, updatedLinks);
    return updatedLinks;
  }
}
