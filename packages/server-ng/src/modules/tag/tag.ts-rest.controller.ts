import { Controller, NotFoundException } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { TagService } from './tag.service';

@Controller()
export class TagTsRestController {
  constructor(private readonly tagService: TagService) {}

  @TsRestHandler(contract.getTags)
  getTags(): TsRestHandler<typeof contract.getTags> {
    return tsRestHandler(contract.getTags, async () => {
      const result = await this.tagService.findAll();
      return { status: 200, body: result.items };
    });
  }

  @TsRestHandler(contract.updateTag)
  updateTag(): TsRestHandler<typeof contract.updateTag> {
    return tsRestHandler(contract.updateTag, async ({ params, body }) => {
      const tag = await this.tagService.findByName((params as { name: string }).name);
      if (!tag) {
        throw new NotFoundException(`Tag ${(params as { name: string }).name} not found`);
      }
      const result = await this.tagService.update(tag.id, body);
      return { status: 200, body: result };
    });
  }

  @TsRestHandler(contract.deleteTag)
  deleteTag(): TsRestHandler<typeof contract.deleteTag> {
    return tsRestHandler(contract.deleteTag, async ({ params }) => {
      const tag = await this.tagService.findByName((params as { name: string }).name);
      if (!tag) {
        throw new NotFoundException(`Tag ${(params as { name: string }).name} not found`);
      }
      await this.tagService.remove(tag.id);
      return { status: 200, body: { success: true } };
    });
  }
}
