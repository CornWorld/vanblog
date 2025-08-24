import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

const mockCategoryService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getStatistics: vi.fn(),
  verifyPassword: vi.fn(),
  getCategoriesWithTags: vi.fn(),
};

const mockJwtAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };
const mockPermissionsGuard = { canActivate: vi.fn().mockReturnValue(true) };

describe('CategoryController', () => {
  let controller: CategoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: mockCategoryService }],
    })
      .overrideGuard(PermissionsGuard)
      .useValue(mockPermissionsGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<CategoryController>(CategoryController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll should return service result', async () => {
    const list = { items: [], total: 0 } as any;
    mockCategoryService.findAll.mockResolvedValue(list);
    const result = await controller.findAll();
    expect(mockCategoryService.findAll).toHaveBeenCalled();
    expect(result).toBe(list);
  });

  it('findOne should pass id', async () => {
    const item = { id: 1 } as any;
    mockCategoryService.findOne.mockResolvedValue(item);
    const result = await controller.findOne(1);
    expect(mockCategoryService.findOne).toHaveBeenCalledWith(1);
    expect(result).toBe(item);
  });

  it('create should pass dto', async () => {
    const dto = { name: 'c' } as any;
    const created = { id: 1, name: 'c' } as any;
    mockCategoryService.create.mockResolvedValue(created);
    const result = await controller.create(dto);
    expect(mockCategoryService.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(created);
  });

  it('update should pass id and dto', async () => {
    const dto = { name: 'u' } as any;
    const updated = { id: 1, name: 'u' } as any;
    mockCategoryService.update.mockResolvedValue(updated);
    const result = await controller.update(1, dto);
    expect(mockCategoryService.update).toHaveBeenCalledWith(1, dto);
    expect(result).toBe(updated);
  });

  it('remove should pass id', async () => {
    mockCategoryService.remove.mockResolvedValue(undefined);
    await controller.remove(1);
    expect(mockCategoryService.remove).toHaveBeenCalledWith(1);
  });

  it('getStatistics should return service result', async () => {
    const stats = { categories: 1, tags: 2 } as any;
    mockCategoryService.getStatistics.mockResolvedValue(stats);
    const result = await controller.getStatistics();
    expect(mockCategoryService.getStatistics).toHaveBeenCalled();
    expect(result).toBe(stats);
  });

  it('verifyPassword should pass id and password', async () => {
    const dto = { password: 'secret' } as any;
    const resp = { success: true } as any;
    mockCategoryService.verifyPassword.mockResolvedValue(resp);
    const result = await controller.verifyPassword(1, dto);
    expect(mockCategoryService.verifyPassword).toHaveBeenCalledWith(1, 'secret');
    expect(result).toBe(resp);
  });

  it('getCategoriesWithTags should return data', async () => {
    const data = [] as any;
    mockCategoryService.getCategoriesWithTags.mockResolvedValue(data);
    const result = await controller.getCategoriesWithTags();
    expect(mockCategoryService.getCategoriesWithTags).toHaveBeenCalled();
    expect(result).toBe(data);
  });
});
