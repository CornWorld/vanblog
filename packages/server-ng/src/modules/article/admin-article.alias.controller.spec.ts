import { describe, it, expect, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';

import { AdminArticleAliasController } from './admin-article.alias.controller';

describe('AdminArticleAliasController', () => {
  let controller: AdminArticleAliasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminArticleAliasController],
    }).compile();

    controller = module.get<AdminArticleAliasController>(AdminArticleAliasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('health() should return { status: "ok" }', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
