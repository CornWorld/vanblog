import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { DraftVersionService } from './draft-version.service';
import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';

const mockDraftService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  publish: vi.fn(),
  importDrafts: vi.fn(),
  autoSave: vi.fn(),
};

const mockDraftVersionService = {
  getVersions: vi.fn(),
  getVersion: vi.fn(),
  restoreVersion: vi.fn(),
  deleteVersion: vi.fn(),
};

const mockJwtAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };
const mockPermissionsGuard = { canActivate: vi.fn().mockReturnValue(true) };

describe('DraftController', () => {
  let controller: DraftController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DraftController],
      providers: [
        { provide: DraftService, useValue: mockDraftService },
        { provide: DraftVersionService, useValue: mockDraftVersionService },
      ],
    })
      .overrideGuard(PermissionsGuard)
      .useValue(mockPermissionsGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<DraftController>(DraftController);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll should pass query and return list', async () => {
    const query = { page: 1, pageSize: 10 } as any;
    const list = { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 } as any;
    mockDraftService.findAll.mockResolvedValue(list);

    const result = await controller.findAll(query);

    expect(mockDraftService.findAll).toHaveBeenCalledWith(query);
    expect(result).toBe(list);
  });

  it('findOne should pass id', async () => {
    const item = { id: 1 } as any;
    mockDraftService.findOne.mockResolvedValue(item);

    const result = await controller.findOne(1);

    expect(mockDraftService.findOne).toHaveBeenCalledWith(1);
    expect(result).toBe(item);
  });

  it('create should pass dto', async () => {
    const dto = { title: 't' } as any;
    const created = { id: 1 } as any;
    mockDraftService.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(mockDraftService.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(created);
  });

  it('update should pass id and dto', async () => {
    const dto = { title: 'u' } as any;
    const updated = { id: 1, title: 'u' } as any;
    mockDraftService.update.mockResolvedValue(updated);

    const result = await controller.update(1, dto);

    expect(mockDraftService.update).toHaveBeenCalledWith(1, dto);
    expect(result).toBe(updated);
  });

  it('remove should pass id', async () => {
    mockDraftService.remove.mockResolvedValue(undefined);

    await controller.remove(1);

    expect(mockDraftService.remove).toHaveBeenCalledWith(1);
  });

  it('publish should pass id and publishDto', async () => {
    const publishDto = { categoryId: 2 } as any;
    const article = { id: 99 } as any;
    mockDraftService.publish.mockResolvedValue(article);

    const result = await controller.publish(1, publishDto);

    expect(mockDraftService.publish).toHaveBeenCalledWith(1, publishDto);
    expect(result).toBe(article);
  });

  it('importDrafts should pass array', async () => {
    const drafts = [{ title: 'a' }] as any[];
    mockDraftService.importDrafts.mockResolvedValue(undefined);

    await controller.importDrafts(drafts);

    expect(mockDraftService.importDrafts).toHaveBeenCalledWith(drafts);
  });

  it('autoSave should pass id and dto', async () => {
    const dto = { content: 'x' } as any;
    const saved = { id: 1, content: 'x' } as any;
    mockDraftService.autoSave.mockResolvedValue(saved);

    const result = await controller.autoSave(1, dto);

    expect(mockDraftService.autoSave).toHaveBeenCalledWith(1, dto);
    expect(result).toBe(saved);
  });

  it('getVersions should return wrapped pagination structure', async () => {
    const versions = [{ v: 1 }, { v: 2 }] as any[];
    mockDraftVersionService.getVersions.mockResolvedValue(versions);

    const result = await controller.getVersions(1);

    expect(mockDraftVersionService.getVersions).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      items: versions,
      total: versions.length,
      page: 1,
      pageSize: versions.length,
      totalPages: 1,
    });
  });

  it('getVersion should pass id and version', async () => {
    const version = { id: 1, v: 2 } as any;
    mockDraftVersionService.getVersion.mockResolvedValue(version);

    const result = await controller.getVersion(1, 2);

    expect(mockDraftVersionService.getVersion).toHaveBeenCalledWith(1, 2);
    expect(result).toBe(version);
  });

  it('restoreVersion should pass id and version', async () => {
    mockDraftVersionService.restoreVersion.mockResolvedValue(undefined);

    await controller.restoreVersion(1, 2);

    expect(mockDraftVersionService.restoreVersion).toHaveBeenCalledWith(1, 2);
  });

  it('deleteVersion should pass id and version', async () => {
    mockDraftVersionService.deleteVersion.mockResolvedValue(undefined);

    await controller.deleteVersion(1, 2);

    expect(mockDraftVersionService.deleteVersion).toHaveBeenCalledWith(1, 2);
  });
});
