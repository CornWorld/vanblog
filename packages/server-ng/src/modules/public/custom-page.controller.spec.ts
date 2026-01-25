import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { CustomPageController } from './custom-page.controller';
import { CustomPageService } from './custom-page.service';

const mockCustomPageService = {
  getAllCustomPages: vi.fn(),
  getCustomPageByPath: vi.fn(),
};

describe('CustomPageController (Public)', () => {
  let controller: CustomPageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomPageController],
      providers: [{ provide: CustomPageService, useValue: mockCustomPageService }],
    }).compile();

    controller = module.get<CustomPageController>(CustomPageController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getAllCustomPages should wrap list', async () => {
    const pages = [{ name: 'A', path: '/a' }];
    mockCustomPageService.getAllCustomPages.mockResolvedValue(pages as any);

    const result = await controller.getAllCustomPages();

    expect(mockCustomPageService.getAllCustomPages).toHaveBeenCalled();
    expect(result).toEqual({ statusCode: 200, data: pages });
  });

  it('getCustomPage should validate path and return wrapped data', async () => {
    const page = { name: 'A', path: '/a', html: '<p/>' } as any;
    mockCustomPageService.getCustomPageByPath.mockResolvedValue(page);

    const result = await controller.getCustomPage('/a');

    expect(mockCustomPageService.getCustomPageByPath).toHaveBeenCalledWith('/a');
    expect(result).toEqual({ statusCode: 200, data: page });
  });

  it('getCustomPage should throw NotFound when empty path', async () => {
    await expect(controller.getCustomPage('' as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getCustomPage should throw NotFound when service returns null', async () => {
    mockCustomPageService.getCustomPageByPath.mockResolvedValue(null);
    await expect(controller.getCustomPage('/none')).rejects.toBeInstanceOf(NotFoundException);
  });
});
