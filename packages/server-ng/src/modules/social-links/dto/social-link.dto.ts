import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { commonSchemas } from '../../../shared/zod';

export const SocialLinkSchema = z.object({
  type: commonSchemas.nonEmptyString.describe(
    'Social media platform type (e.g., github, twitter, email)',
  ),
  url: commonSchemas.nonEmptyString.describe('URL or contact information'),
});

export class SocialLinkDto extends createZodDto(SocialLinkSchema) {}
