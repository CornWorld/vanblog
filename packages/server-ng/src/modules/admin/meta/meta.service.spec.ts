import { Test, type TestingModule } from '@nestjs/testing';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import { MetaService } from './meta.service';

// Mock external dependencies
vi.mock('axios');
vi.mock('fs');
vi.mock('path');

// Get the actual mocked functions - axios is the default export, but we need to mock .get
const mockedAxiosModule = vi.mocked(axios, { partial: true });
const mockAxiosGet = vi.fn();
// Set up the mock to return the get function
mockedAxiosModule.get = mockAxiosGet;

const mockedFs = vi.mocked(fs);
const mockedPath = vi.mocked(path);

// Helper function to reset axios mock
const resetAxiosMock = (fn = mockAxiosGet) => {
  fn.mockClear();
  return fn;
};

describe('MetaService', () => {
  let service: MetaService;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    resetAxiosMock();

    // Suppress console output during tests
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock path.join to return a predictable path
    mockedPath.join.mockReturnValue('/mock/path/package.json');

    // Mock process.cwd() to return a consistent value
    vi.spyOn(process, 'cwd').mockReturnValue('/mock/path');
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('constructor and initVersion', () => {
    it('should initialize with version from package.json when file exists', async () => {
      const mockPackageJson = JSON.stringify({ version: '1.2.3' });

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(mockPackageJson);

      // Mock axios to prevent actual HTTP call during initialization
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      // Create new service instance to test constructor
      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);
      const versionInfo = newService.getVersionInfo();

      expect(versionInfo.version).toBe('1.2.3');
      expect(mockedFs.existsSync).toHaveBeenCalledWith('/mock/path/package.json');
      expect(mockedFs.readFileSync).toHaveBeenCalledWith('/mock/path/package.json', 'utf-8');
    });

    it('should fall back to npm_package_version when package.json does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      process.env.npm_package_version = '2.0.0';

      // Mock axios to prevent actual HTTP call
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);
      const versionInfo = newService.getVersionInfo();

      expect(versionInfo.version).toBe('2.0.0');

      // Cleanup
      delete process.env.npm_package_version;
    });

    it('should fall back to "dev" when package.json does not exist and npm_package_version is not set', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      delete process.env.npm_package_version;

      // Mock axios to prevent actual HTTP call
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);
      const versionInfo = newService.getVersionInfo();

      expect(versionInfo.version).toBe('dev');
    });

    it('should fall back to npm_package_version when package.json read fails', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });
      process.env.npm_package_version = '3.0.0';

      // Mock axios to prevent actual HTTP call
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);
      const versionInfo = newService.getVersionInfo();

      expect(versionInfo.version).toBe('3.0.0');

      // Cleanup
      delete process.env.npm_package_version;
    });

    it('should fall back to "dev" when package.json is invalid JSON', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('invalid json');
      delete process.env.npm_package_version;

      // Mock axios to prevent actual HTTP call
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);
      const versionInfo = newService.getVersionInfo();

      expect(versionInfo.version).toBe('dev');
    });
  });

  describe('getVersionInfo', () => {
    it('should return version info when no update info is available', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      const result = service.getVersionInfo();

      expect(result).toEqual({
        version: '1.0.0',
        latestVersion: '1.0.0',
        hasUpdate: false,
        updateInfo: undefined,
      });
    });

    it('should trigger checkUpdate in background', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      const checkUpdateSpy = vi.spyOn(service as any, 'checkUpdate');

      service.getVersionInfo();

      expect(checkUpdateSpy).toHaveBeenCalled();
    });

    it('should return hasUpdate: true when latest version is greater', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      // Mock successful GitHub API response
      const mockReleaseData = {
        tag_name: 'v2.0.0',
        body: 'Release notes',
        html_url: 'https://github.com/Mereithhh/vanblog/releases/tag/v2.0.0',
      };

      mockAxiosGet.mockResolvedValue({ data: mockReleaseData });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      // Wait for initial checkUpdate to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = service.getVersionInfo();

      expect(result.hasUpdate).toBe(true);
      expect(result.latestVersion).toBe('v2.0.0');
      expect(result.updateInfo).toEqual({
        version: 'v2.0.0',
        description: 'Release notes',
        url: 'https://github.com/Mereithhh/vanblog/releases/tag/v2.0.0',
      });
    });

    it('should return hasUpdate: false when current version is latest', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      // Mock successful GitHub API response with same version
      const mockReleaseData = {
        tag_name: '1.0.0',
        body: 'Release notes',
        html_url: 'https://github.com/Mereithhh/vanblog/releases/tag/v1.0.0',
      };

      mockAxiosGet.mockResolvedValue({ data: mockReleaseData });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      // Wait for initial checkUpdate to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = service.getVersionInfo();

      expect(result.hasUpdate).toBe(false);
      expect(result.latestVersion).toBe('1.0.0');
    });

    it('should return current version as latest when update check fails', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      mockAxiosGet.mockRejectedValue(new Error('Network error'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      const result = service.getVersionInfo();

      expect(result.version).toBe('1.0.0');
      expect(result.latestVersion).toBe('1.0.0');
      expect(result.hasUpdate).toBe(false);
      expect(result.updateInfo).toBeUndefined();
    });
  });

  describe('checkUpdate', () => {
    it('should successfully fetch and cache latest version info', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const mockReleaseData = {
        tag_name: 'v2.0.0',
        body: 'New features:\n- Feature 1\n- Feature 2',
        html_url: 'https://github.com/Mereithhh/vanblog/releases/tag/v2.0.0',
      };

      mockAxiosGet.mockResolvedValue({ data: mockReleaseData });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      // Access private method via any cast
      await (service as any).checkUpdate();

      const result = service.getVersionInfo();

      expect(result.updateInfo).toEqual({
        version: 'v2.0.0',
        description: 'New features:\n- Feature 1\n- Feature 2',
        url: 'https://github.com/Mereithhh/vanblog/releases/tag/v2.0.0',
      });
      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://api.github.com/repos/Mereithhh/vanblog/releases/latest',
        {
          timeout: 5000,
        },
      );
    });

    it('should skip check when within CHECK_INTERVAL and cache exists', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const mockReleaseData = {
        tag_name: 'v2.0.0',
        body: 'Release notes',
        html_url: 'https://github.com/Mereithhh/vanblog/releases/tag/v2.0.0',
      };

      mockAxiosGet.mockResolvedValue({ data: mockReleaseData });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      // Wait for constructor's checkUpdate to finish and set cache
      await new Promise((resolve) => setTimeout(resolve, 100));

      // At this point, latestVersionInfo should be set and lastCheckTime should be recent
      // Store call count after constructor
      const callCountAfterInit = mockAxiosGet.mock.calls.length;

      // First explicit call - should skip because cache exists and within interval
      await (service as any).checkUpdate();
      expect(mockAxiosGet.mock.calls.length).toBe(callCountAfterInit); // Should not increase

      // Second call immediately - should also skip
      await (service as any).checkUpdate();
      expect(mockAxiosGet.mock.calls.length).toBe(callCountAfterInit); // Should still not increase
    });

    it('should check again after CHECK_INTERVAL expires', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const mockReleaseData = {
        tag_name: 'v2.0.0',
        body: 'Release notes',
        html_url: 'https://github.com/Mereithhh/vanblog/releases/tag/v2.0.0',
      };

      mockAxiosGet.mockResolvedValue({ data: mockReleaseData });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      // Wait for constructor's checkUpdate to finish
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Store call count after constructor
      const callCountAfterInit = mockAxiosGet.mock.calls.length;

      // First explicit call - should skip due to interval
      await (service as any).checkUpdate();
      expect(mockAxiosGet.mock.calls.length).toBe(callCountAfterInit);

      // Manually set lastCheckTime to 0 to simulate interval expiry
      (service as any).lastCheckTime = 0;

      // Now the check should run because interval has "expired"
      await (service as any).checkUpdate();
      expect(mockAxiosGet.mock.calls.length).toBe((callCountAfterInit as number) + 1);
    });

    it('should handle network errors gracefully', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const networkError = new Error('Network timeout');
      mockAxiosGet.mockRejectedValue(networkError);

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      await (service as any).checkUpdate();

      const result = service.getVersionInfo();

      // Should still return current version as fallback
      expect(result.version).toBe('1.0.0');
      expect(result.latestVersion).toBe('1.0.0');
      expect(result.hasUpdate).toBe(false);
    });

    it('should handle GitHub API errors gracefully', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const apiError = { response: { status: 404, data: 'Not found' } };
      mockAxiosGet.mockRejectedValue(apiError);

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      await (service as any).checkUpdate();

      const result = service.getVersionInfo();

      expect(result.version).toBe('1.0.0');
      expect(result.latestVersion).toBe('1.0.0');
      expect(result.hasUpdate).toBe(false);
    });

    it('should handle rate limiting errors', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const rateLimitError = {
        response: { status: 403, data: { message: 'API rate limit exceeded' } },
      };
      mockAxiosGet.mockRejectedValue(rateLimitError);

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      await (service as any).checkUpdate();

      const result = service.getVersionInfo();

      expect(result.version).toBe('1.0.0');
      expect(result.latestVersion).toBe('1.0.0');
    });

    it('should handle timeout errors', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const timeoutError = new Error('timeout of 5000ms exceeded');
      mockAxiosGet.mockRejectedValue(timeoutError);

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      // Spy on the logger instance
      const loggerWarnSpy = vi.spyOn((service as any).logger, 'warn');

      await (service as any).checkUpdate();

      // Should log warning for timeout using NestJS Logger
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to check update'));
    });

    it('should handle malformed response data', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const malformedData = {
        // Missing tag_name field - will cause latestVersionInfo.version to be undefined
        body: 'Some body',
        html_url: 'https://github.com/example',
      };

      mockAxiosGet.mockResolvedValue({ data: malformedData as any });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      await (service as any).checkUpdate();

      // With malformed data (missing tag_name), getVersionInfo will throw when comparing versions
      // Because latestVersionInfo.version will be undefined
      expect(() => service.getVersionInfo()).toThrow();
    });

    it('should update lastCheckTime after check', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      const beforeTime = Date.now();

      mockAxiosGet.mockResolvedValue({
        data: {
          tag_name: 'v2.0.0',
          body: 'Release',
          html_url: 'https://github.com/example',
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      await (service as any).checkUpdate();

      const afterTime = Date.now();
      const { lastCheckTime } = service as any;

      expect(lastCheckTime).toBeGreaterThanOrEqual(beforeTime);
      expect(lastCheckTime).toBeLessThanOrEqual(afterTime);
    });

    it('should preserve existing cache when check fails', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      // First successful check
      const mockReleaseData = {
        tag_name: 'v2.0.0',
        body: 'Release notes',
        html_url: 'https://github.com/example',
      };
      mockAxiosGet.mockResolvedValueOnce({ data: mockReleaseData });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      service = module.get<MetaService>(MetaService);

      await (service as any).checkUpdate();

      const firstResult = service.getVersionInfo();
      expect(firstResult.latestVersion).toBe('v2.0.0');

      // Reset lastCheckTime to allow another check
      (service as any).lastCheckTime = 0;

      // Second check fails
      mockAxiosGet.mockRejectedValueOnce(new Error('Network error'));

      await (service as any).checkUpdate();

      // Cache should be preserved
      const secondResult = service.getVersionInfo();
      expect(secondResult.latestVersion).toBe('v2.0.0');
      expect(secondResult.updateInfo?.version).toBe('v2.0.0');
    });
  });

  describe('semver version comparison', () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
      mockAxiosGet.mockRejectedValue(new Error('Network error'));
    });

    it('should detect update when major version increases', async () => {
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          tag_name: 'v2.0.0',
          body: 'Major release',
          html_url: 'https://github.com/example',
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);

      // Wait for checkUpdate
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = newService.getVersionInfo();
      expect(result.hasUpdate).toBe(true);
    });

    it('should detect update when minor version increases', async () => {
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          tag_name: 'v1.1.0',
          body: 'Minor release',
          html_url: 'https://github.com/example',
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = newService.getVersionInfo();
      expect(result.hasUpdate).toBe(true);
    });

    it('should detect update when patch version increases', async () => {
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          tag_name: 'v1.0.1',
          body: 'Patch release',
          html_url: 'https://github.com/example',
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = newService.getVersionInfo();
      expect(result.hasUpdate).toBe(true);
    });

    it('should handle prerelease versions correctly', async () => {
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0-beta.1' }));
      mockAxiosGet.mockResolvedValueOnce({
        data: {
          tag_name: 'v1.0.0',
          body: 'Stable release',
          html_url: 'https://github.com/example',
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = newService.getVersionInfo();
      expect(result.hasUpdate).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle "dev" version - throws error on semver comparison', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      delete process.env.npm_package_version;

      mockAxiosGet.mockResolvedValue({
        data: {
          tag_name: 'v1.0.0',
          body: 'Release',
          html_url: 'https://github.com/example',
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // "dev" is not a valid semver, so semver.gt will throw error
      expect(() => newService.getVersionInfo()).toThrow('Invalid Version: dev');
    });

    it('should handle version strings with v prefix', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: 'v1.0.0' }));

      mockAxiosGet.mockResolvedValueOnce({
        data: {
          tag_name: 'v2.0.0',
          body: 'Release',
          html_url: 'https://github.com/example',
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = newService.getVersionInfo();

      expect(result.hasUpdate).toBe(true);
    });

    it('should handle empty response body gracefully', async () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));

      mockAxiosGet.mockResolvedValueOnce({
        data: {
          tag_name: 'v2.0.0',
          body: '',
          html_url: 'https://github.com/example',
        },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [MetaService],
      }).compile();

      const newService = module.get<MetaService>(MetaService);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = newService.getVersionInfo();

      expect(result.updateInfo?.description).toBe('');
    });
  });
});
