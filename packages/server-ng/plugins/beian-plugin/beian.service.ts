import { z } from 'zod';

import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';

// Beian info schema
export const BeianInfoSchema = z.object({
  icp: z.string().optional(),
  gov: z.string().optional(),
  govUrl: z.string().optional(),
  showBeian: z.boolean().optional(),
});

export type BeianInfo = z.infer<typeof BeianInfoSchema>;

export class BeianService {
  async getBeianInfo(context: PluginContext): Promise<BeianInfo> {
    const beianInfo = await context.data.get('beianInfo');
    return beianInfo ?? {};
  }

  async updateBeianInfo(context: PluginContext, data: BeianInfo): Promise<BeianInfo> {
    const validatedData = BeianInfoSchema.parse(data);
    await context.data.set('beianInfo', validatedData);
    return validatedData;
  }
}
