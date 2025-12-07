import { Controller, NotFoundException } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract, type Tag } from '@vanblog/shared';

import { TagService } from './tag.service';

@Controller()
export class TagTsRestController {
  constructor(private readonly tagService: TagService) {}

  @TsRestHandler(contract.getTags)
  getTags(): unknown {
    return tsRestHandler(contract.getTags, async () => {
      const result = await this.tagService.findAll();
      const body: Tag[] = result.items.map((item) => ({
        id: item.id,
        name: item.name,
        count: item.articleCount,
        createdAt: item.createdAt,
        updatedAt: undefined,
      }));
      return { status: 200, body };
    });
  }

  @TsRestHandler(contract.updateTag)
  updateTag(): unknown {
    return tsRestHandler(contract.updateTag, async ({ params, body }) => {
      const tag = await this.tagService.findByName((params as { name: string }).name);
      if (!tag) {
        throw new NotFoundException(`Tag ${(params as { name: string }).name} not found`);
      }
      const result = await this.tagService.update(tag.id, body);
      return {
        status: 200,
        body: {
          id: result.id,
          name: result.name,
          count: undefined,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt ?? undefined,
        },
      };
    });
  }

  @TsRestHandler(contract.deleteTag)
  deleteTag(): unknown {
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
