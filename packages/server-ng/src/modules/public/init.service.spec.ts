import { ConflictException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { SettingCoreService } from '../setting/services/setting-core.service';
import { UserService } from '../user/user.service';

import { InitService } from './init.service';

const mockUserService = {
  getAdminUser: vi.fn(),
  create: vi.fn(),
};

const mockSettingCoreService = {
  updateSiteInfo: vi.fn(),
  getSiteInfo: vi.fn(),
};

describe('InitService', () => {
  let service: InitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitService,
        { provide: UserService, useValue: mockUserService },
        { provide: SettingCoreService, useValue: mockSettingCoreService },
      ],
    }).compile();

    service = module.get<InitService>(InitService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize when no admin exists', async () => {
    mockUserService.getAdminUser.mockResolvedValue(null);
    mockUserService.create.mockResolvedValue({ id: 1, username: 'root' });
    mockSettingCoreService.updateSiteInfo.mockResolvedValue({
      title: 'Blog',
      description: 'Desc',
      author: 'Admin',
      keywords: ['a'],
    });

    const payload: any = {
      admin: { username: 'root', password: 'Aa123456!' },
      siteInfo: { title: 'Blog' },
    };

    const result = await service.initializeCms(payload);

    expect(mockUserService.getAdminUser).toHaveBeenCalled();
    expect(mockUserService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ...payload.admin,
        type: 'admin',
      }),
    );
    expect(mockSettingCoreService.updateSiteInfo).toHaveBeenCalledWith(payload.siteInfo);
    expect(result.initialized).toBe(true);
    expect(result.admin).toEqual({ id: 1, username: 'root' });
  });

  it('should throw when already initialized', async () => {
    mockUserService.getAdminUser.mockResolvedValue({ id: 1, username: 'root' });

    await expect(
      service.initializeCms({ admin: { username: 'root', password: 'Aa123456!' } } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
