import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CaddyController } from './caddy.controller';
import { CaddyService } from './caddy.service';

describe('CaddyController', () => {
  let controller: CaddyController;
  let caddyService: CaddyService;

  beforeEach(async () => {
    const mockCaddyService = {
      getHttpsSettings: vi.fn(),
      updateHttpsSettings: vi.fn(),
      setRedirect: vi.fn(),
      addSubject: vi.fn(),
      getSubjects: vi.fn(),
      getAutomaticDomains: vi.fn(),
      updateSubjects: vi.fn(),
      updateHttpsDomains: vi.fn(),
      applyHttpsChange: vi.fn(),
      getConfig: vi.fn(),
      getLog: vi.fn(),
      clearLog: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaddyController],
      providers: [
        {
          provide: CaddyService,
          useValue: mockCaddyService,
        },
      ],
    }).compile();

    controller = module.get<CaddyController>(CaddyController);
    caddyService = module.get<CaddyService>(CaddyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHttpsSettings', () => {
    it('should return HTTPS settings', async () => {
      const mockSettings = {
        redirect: true,
        domains: ['example.com'],
      };

      vi.mocked(caddyService.getHttpsSettings).mockResolvedValue(mockSettings);

      const result = await controller.getHttpsSettings();

      expect(caddyService.getHttpsSettings).toHaveBeenCalled();
      expect(result).toEqual(mockSettings);
    });
  });

  describe('updateHttpsSettings', () => {
    it('should update HTTPS settings', async () => {
      const mockSettings = {
        redirect: true,
        domains: ['example.com'],
      };

      vi.mocked(caddyService.updateHttpsSettings).mockResolvedValue(mockSettings);

      const result = await controller.updateHttpsSettings(mockSettings);

      expect(caddyService.updateHttpsSettings).toHaveBeenCalledWith(mockSettings);
      expect(result).toEqual(mockSettings);
    });
  });

  describe('enableRedirect', () => {
    it('should enable redirect', async () => {
      const mockResult = 'redirect enabled';

      vi.mocked(caddyService.setRedirect).mockResolvedValue(mockResult);

      const result = await controller.enableRedirect();

      expect(caddyService.setRedirect).toHaveBeenCalledWith(true);
      expect(result).toEqual({ success: true, message: mockResult });
    });
  });

  describe('disableRedirect', () => {
    it('should disable redirect', async () => {
      const mockResult = false;

      vi.mocked(caddyService.setRedirect).mockResolvedValue(mockResult);

      const result = await controller.disableRedirect();

      expect(caddyService.setRedirect).toHaveBeenCalledWith(false);
      expect(result).toEqual({ success: false, message: false });
    });
  });

  describe('addSubject', () => {
    it('should add domain subject', async () => {
      vi.mocked(caddyService.addSubject).mockResolvedValue(undefined);

      const result = await controller.addSubject('example.com');

      expect(caddyService.addSubject).toHaveBeenCalledWith('example.com');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getSubjects', () => {
    it('should return domain subjects', async () => {
      const mockDomains = ['example.com', 'test.com'];

      vi.mocked(caddyService.getSubjects).mockResolvedValue(mockDomains);

      const result = await controller.getSubjects();

      expect(caddyService.getSubjects).toHaveBeenCalled();
      expect(result).toEqual(mockDomains);
    });
  });

  describe('getAutomaticDomains', () => {
    it('should return automatic domains', async () => {
      const mockDomains = ['auto.example.com'];

      vi.mocked(caddyService.getAutomaticDomains).mockResolvedValue(mockDomains);

      const result = await controller.getAutomaticDomains();

      expect(caddyService.getAutomaticDomains).toHaveBeenCalled();
      expect(result).toEqual(mockDomains);
    });
  });

  describe('updateSubjects', () => {
    it('should update domain subjects', async () => {
      const domains = ['example.com', 'test.com'];

      vi.mocked(caddyService.updateSubjects).mockResolvedValue(true);

      const result = await controller.updateSubjects(domains);

      expect(caddyService.updateSubjects).toHaveBeenCalledWith(domains);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getConfig', () => {
    it('should return Caddy configuration', async () => {
      const mockConfig = { apps: { http: { servers: {} } } };

      vi.mocked(caddyService.getConfig).mockResolvedValue(mockConfig);

      const result = await controller.getConfig();

      expect(caddyService.getConfig).toHaveBeenCalled();
      expect(result).toEqual(mockConfig);
    });
  });

  describe('getLogs', () => {
    it('should return Caddy logs', async () => {
      const mockLogs = 'Caddy log content';

      vi.mocked(caddyService.getLog).mockResolvedValue(mockLogs);

      const result = await controller.getLogs();

      expect(caddyService.getLog).toHaveBeenCalled();
      expect(result).toEqual({ logs: mockLogs });
    });
  });

  describe('clearLogs', () => {
    it('should clear Caddy logs', () => {
      vi.mocked(caddyService.clearLog).mockReturnValue(undefined);

      controller.clearLogs();

      expect(caddyService.clearLog).toHaveBeenCalled();
    });
  });
});
