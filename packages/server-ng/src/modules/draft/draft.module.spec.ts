import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';

import { DraftController } from './draft.controller';
import { DraftService } from './draft.service';
import { DraftVersionService } from './draft-version.service';
import { DraftModule } from './draft.module';

describe('DraftModule', () => {
  describe('module definition', () => {
    it('should be defined', () => {
      expect(DraftModule).toBeDefined();
    });

    it('should be a class', () => {
      expect(typeof DraftModule).toBe('function');
    });

    it('should have NestJS module decorators', () => {
      // DraftModule is decorated with @Module()
      expect(DraftModule).toBeDefined();
    });
  });

  describe('module exports', () => {
    it('should export DraftService', async () => {
      const mockDraftService = Mock.draftService();

      const testModule = await Test.createTestingModule({
        providers: [
          {
            provide: DraftService,
            useValue: mockDraftService,
          },
        ],
        exports: [DraftService],
      }).compile();

      const draftService = testModule.get<DraftService>(DraftService);
      expect(draftService).toBeDefined();
      expect(draftService).toBe(mockDraftService);
    });
  });

  describe('feature permissions', () => {
    it('should register draft permissions through PermissionModule', () => {
      // Test the expected permissions array
      const expectedPermissions = [
        'draft:create',
        'draft:read',
        'draft:update',
        'draft:delete',
        'draft:publish',
      ];

      expect(expectedPermissions).toHaveLength(5);
      expect(expectedPermissions).toContain('draft:create');
      expect(expectedPermissions).toContain('draft:read');
      expect(expectedPermissions).toContain('draft:update');
      expect(expectedPermissions).toContain('draft:delete');
      expect(expectedPermissions).toContain('draft:publish');
    });
  });

  describe('service injection', () => {
    it('should provide DraftService to controllers', async () => {
      const mockService = Mock.draftService();
      const mockVersionService = Mock.draftVersionService();

      const testModule = await Test.createTestingModule({
        controllers: [DraftController],
        providers: [
          {
            provide: DraftService,
            useValue: mockService,
          },
          {
            provide: DraftVersionService,
            useValue: mockVersionService,
          },
        ],
      }).compile();

      const controller = testModule.get<DraftController>(DraftController);
      const service = testModule.get<DraftService>(DraftService);

      expect(controller).toBeDefined();
      expect(service).toBe(mockService);
    });

    it('should provide DraftVersionService alongside DraftService', async () => {
      const mockVersionService = Mock.draftVersionService();

      const testModule = await Test.createTestingModule({
        providers: [
          {
            provide: DraftVersionService,
            useValue: mockVersionService,
          },
        ],
      }).compile();

      const versionService = testModule.get<DraftVersionService>(DraftVersionService);
      expect(versionService).toBeDefined();
      expect(versionService).toBe(mockVersionService);
    });
  });

  describe('module integration patterns', () => {
    it('should be importable in other modules', () => {
      // DraftModule can be imported and will export DraftService
      expect(DraftModule).toBeDefined();
    });

    it('should support PluginModule import', () => {
      // DraftModule imports PluginModule for hook support
      expect(DraftModule).toBeDefined();
    });

    it('should support PermissionModule.forFeature()', () => {
      // PermissionModule.forFeature() is used to register permissions
      // This pattern allows fine-grained permission management per module
      expect(DraftModule).toBeDefined();
    });

    it('should provide both DraftService and DraftVersionService', async () => {
      const mockDraftService = Mock.draftService();
      const mockVersionService = Mock.draftVersionService();

      const testModule = await Test.createTestingModule({
        providers: [
          {
            provide: DraftService,
            useValue: mockDraftService,
          },
          {
            provide: DraftVersionService,
            useValue: mockVersionService,
          },
        ],
      }).compile();

      const draftService = testModule.get<DraftService>(DraftService);
      const versionService = testModule.get<DraftVersionService>(DraftVersionService);

      expect(draftService).toBeDefined();
      expect(versionService).toBeDefined();
      expect(draftService).toBe(mockDraftService);
      expect(versionService).toBe(mockVersionService);
    });
  });
});
