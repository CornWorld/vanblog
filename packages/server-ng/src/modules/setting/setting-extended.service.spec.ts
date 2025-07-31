import { Test, type TestingModule } from '@nestjs/testing';
import { SettingService } from './services/setting.service';
import { DATABASE_CONNECTION } from '../../database/database.module';
import { vi, describe, beforeEach, it, expect } from 'vitest';

describe('SettingService Extended Features', () => {
  let service: SettingService;
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
      insert: vi.fn(),
      values: vi.fn(),
      update: vi.fn(),
      set: vi.fn(),
    };

    // Reset all mocks to return this by default
    Object.keys(mockDb).forEach((key) => {
      mockDb[key].mockReturnValue(mockDb);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SettingService>(SettingService);
  });

  describe('Beian Information', () => {
    it('should get default empty beian info', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.getBeianInfo();
      expect(result).toEqual({});
    });

    it('should update beian info', async () => {
      const beianInfo = {
        icp: '京ICP备12345678号',
        icpUrl: 'https://beian.miit.gov.cn/',
      };

      mockDb.limit.mockResolvedValue([]);
      mockDb.values.mockResolvedValue([beianInfo]);

      const result = await service.updateBeianInfo(beianInfo);
      expect(result).toEqual(beianInfo);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('Analytics Configuration', () => {
    it('should get and update analytics config', async () => {
      const analyticsConfig = {
        googleAnalyticsId: 'G-XXXXXXXXXX',
        baiduAnalyticsId: 'xxxxxxxxxxxxxxxxxxxxxx',
      };

      mockDb.limit.mockResolvedValue([]);

      const result = await service.updateAnalyticsConfig(analyticsConfig);
      expect(result).toEqual(analyticsConfig);
    });
  });

  describe('Display Configuration', () => {
    it('should get default display config', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.getDisplayConfig();
      expect(result).toHaveProperty('enableComment', true);
      expect(result).toHaveProperty('showSubMenu', true);
      expect(result).toHaveProperty('defaultTheme', 'auto');
    });
  });

  describe('About Page Management', () => {
    it('should update about page content', async () => {
      const content = '# About Me\n\nThis is my blog.';

      mockDb.limit.mockResolvedValue([]);

      const result = await service.updateAboutContent(content);
      expect(result).toHaveProperty('content', content);
      expect(result).toHaveProperty('updatedAt');
    });
  });

  describe('Social Links Management', () => {
    it('should add a new social link', async () => {
      const socialLink = {
        type: 'github',
        value: 'https://github.com/username',
      };

      mockDb.limit.mockResolvedValue([]);

      const result = await service.addOrUpdateSocialLink(socialLink);
      expect(result).toContainEqual(socialLink);
    });

    it('should update existing social link', async () => {
      const existingLinks = [{ type: 'github', value: 'https://github.com/olduser' }];

      const updatedLink = {
        type: 'github',
        value: 'https://github.com/newuser',
      };

      mockDb.limit.mockResolvedValue([{ value: JSON.stringify(existingLinks) }]);

      const result = await service.addOrUpdateSocialLink(updatedLink);
      expect(result).toContainEqual(updatedLink);
      expect(result).toHaveLength(1);
    });

    it('should delete social link', async () => {
      const existingLinks = [
        { type: 'github', value: 'https://github.com/user' },
        { type: 'email', value: 'user@example.com' },
      ];

      mockDb.limit.mockResolvedValue([{ value: JSON.stringify(existingLinks) }]);

      const result = await service.deleteSocialLink('github');
      expect(result).toHaveLength(1);
      expect(result).not.toContainEqual(expect.objectContaining({ type: 'github' }));
    });

    it('should return available social types', () => {
      const types = service.getSocialTypes();
      expect(types).toContainEqual(expect.objectContaining({ value: 'github' }));
      expect(types).toContainEqual(expect.objectContaining({ value: 'email' }));
    });
  });

  describe('Reward Information Management', () => {
    it('should add reward info', async () => {
      const rewardInfo = {
        name: 'Alipay',
        value: 'https://example.com/alipay-qr.png',
      };

      mockDb.limit.mockResolvedValue([]);

      const result = await service.addOrUpdateRewardInfo(rewardInfo);
      expect(result).toContainEqual(
        expect.objectContaining({
          name: rewardInfo.name,
          value: rewardInfo.value,
        }),
      );
    });

    it('should delete reward info', async () => {
      const existingRewards = [
        { name: 'Alipay', value: 'https://example.com/alipay.png' },
        { name: 'WeChat', value: 'https://example.com/wechat.png' },
      ];

      mockDb.limit.mockResolvedValue([{ value: JSON.stringify(existingRewards) }]);

      const result = await service.deleteRewardInfo('Alipay');
      expect(result).toHaveLength(1);
      expect(result).not.toContainEqual(expect.objectContaining({ name: 'Alipay' }));
    });
  });
});
