import { describe, it, beforeEach, expect, vi } from 'vitest';

import { DatabaseMockBuilder, Mock } from '@test/mock';

import { BackupService } from './backup.service';

import type { CreateBackupDto, RestoreBackupDto, GetBackupsDto } from './dto/backup.dto';

// Mock fs and zlib modules
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    access: vi.fn(),
  };
});

vi.mock('zlib', () => ({
  gzip: vi.fn((_data: any, callback: any) => callback(null, Buffer.from('compressed-data'))),
  gunzip: vi.fn((_data: any, callback: any) => callback(null, Buffer.from('{}'))),
  gzipSync: vi.fn(() => Buffer.from('compressed-data')),
  gunzipSync: vi.fn(() => Buffer.from('{}')),
  default: {
    gzip: vi.fn((_data: any, callback: any) => callback(null, Buffer.from('compressed-data'))),
    gunzip: vi.fn((_data: any, callback: any) => callback(null, Buffer.from('{}'))),
    gzipSync: vi.fn(() => Buffer.from('compressed-data')),
    gunzipSync: vi.fn(() => Buffer.from('{}')),
  },
}));

describe('BackupService', () => {
  let service: BackupService;
  let mockDb: DatabaseMockBuilder;
  let mockLogger: any;
  let mockFs: any;

  beforeEach(async () => {
    // Import mocked modules
    mockFs = (await import('fs/promises')) as any;
    const mockZlib = await import('zlib');

    // Create mocks
    mockDb = new DatabaseMockBuilder();
    mockLogger = Mock.logger();

    // Setup database query mocks - return empty arrays for all queries
    mockDb.setQueryResult([]);

    // Setup fs mocks with default values
    vi.mocked(mockFs.mkdir).mockResolvedValue(undefined);
    vi.mocked(mockFs.writeFile).mockResolvedValue(undefined);
    vi.mocked(mockFs.readdir).mockResolvedValue([]);
    vi.mocked(mockFs.stat).mockResolvedValue({
      size: 1024,
      mtime: new Date('2023-01-01T00:00:00Z'),
    });
    vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('{}'));
    vi.mocked(mockFs.unlink).mockResolvedValue(undefined);
    vi.mocked(mockFs.access).mockResolvedValue(undefined);

    // Setup zlib mocks
    vi.mocked(mockZlib.gzip).mockImplementation((_data: any, callback: any) =>
      callback(null, Buffer.from('compressed-data')),
    );
    vi.mocked(mockZlib.gunzip).mockImplementation((_data: any, callback: any) =>
      callback(null, Buffer.from('{}')),
    );

    // Create service instance
    service = new BackupService(mockDb.db as any, mockLogger as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const createBackupDto: CreateBackupDto = {
        name: 'test-backup',
        description: 'Test backup description',
        includeMedia: true,
        includeAnalytics: false,
        includeLogs: false,
      };

      const result = await service.createBackup(createBackupDto);

      expect(result).toMatchObject({
        name: 'test-backup',
        description: 'Test backup description',
        hasPassword: false,
        includeMedia: true,
        includeAnalytics: false,
        includeLogs: false,
      });
      expect(result.id).toBeDefined();
      expect(result.filename).toContain('.vbak');
      expect(result.size).toBe(1024);
      expect(result.createdAt).toBeDefined();
      expect(result.tables).toBeDefined();

      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Creating backup'));
    });

    it('should create a backup with password', async () => {
      const createBackupDto: CreateBackupDto = {
        name: 'encrypted-backup',
        password: 'TestPassword123!',
        includeMedia: true,
        includeAnalytics: true,
        includeLogs: true,
      };

      const result = await service.createBackup(createBackupDto);

      expect(result.hasPassword).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle backup creation failure', async () => {
      vi.mocked(mockFs.writeFile).mockRejectedValueOnce(new Error('Write failed'));

      const createBackupDto: CreateBackupDto = {
        name: 'failing-backup',
        includeMedia: true,
        includeAnalytics: false,
        includeLogs: false,
      };

      await expect(service.createBackup(createBackupDto)).rejects.toThrow(
        'Failed to create backup',
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getBackups', () => {
    it('should return paginated backup list', async () => {
      const mockFiles = ['backup1.vbak', 'backup2.vbak', 'other.txt'];
      vi.mocked(mockFs.readdir).mockResolvedValueOnce(mockFiles as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        size: 2048,
        mtime: new Date('2023-01-01T00:00:00Z'),
      } as any);

      // Mock gunzip to return decompressed content
      const mockBackupContent = JSON.stringify({
        metadata: {
          id: 'test-id',
          name: 'test-backup',
          description: 'Test description',
          version: '1.0.0',
          createdAt: '2023-01-01T00:00:00.000Z',
          hasPassword: false,
          includeMedia: true,
          includeAnalytics: false,
          includeLogs: false,
          tables: { users: 1, articles: 5 },
        },
      });

      const mockZlib = await import('zlib');
      vi.mocked(mockZlib.gunzip).mockImplementation((_data: any, callback: any) => {
        callback(null, Buffer.from(mockBackupContent));
      });

      vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('compressed-data'));

      const getBackupsDto: GetBackupsDto = {
        page: 1,
        limit: 10,
      };

      const result = await service.getBackups(getBackupsDto);

      expect(result.backups).toHaveLength(2); // Only .vbak files
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.backups[0]).toMatchObject({
        id: 'test-id',
        name: 'test-backup',
        filename: expect.stringContaining('.vbak'),
        size: 2048,
      });
    });

    it('should filter backups by search term', async () => {
      const mockFiles = ['important-backup.vbak', 'test-backup.vbak'];
      vi.mocked(mockFs.readdir).mockResolvedValueOnce(mockFiles as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        size: 1024,
        mtime: new Date('2023-01-01T00:00:00Z'),
      } as any);

      // Mock gunzip to return different content for each file
      let callCount = 0;
      const mockZlib = await import('zlib');
      vi.mocked(mockZlib.gunzip).mockImplementation((_data: any, callback: any) => {
        callCount++;
        const mockBackupContent = JSON.stringify({
          metadata: {
            id: `test-id-${String(callCount)}`,
            name: callCount === 1 ? 'important-backup' : 'test-backup',
            version: '1.0.0',
            createdAt: '2023-01-01T00:00:00.000Z',
            hasPassword: false,
            includeMedia: true,
            includeAnalytics: false,
            includeLogs: false,
            tables: {},
          },
        });
        callback(null, Buffer.from(mockBackupContent));
      });

      vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('compressed-data'));

      const getBackupsDto: GetBackupsDto = {
        page: 1,
        limit: 10,
        search: 'important',
      };

      const result = await service.getBackups(getBackupsDto);

      expect(result.backups).toHaveLength(1);
      expect(result.backups[0].name).toBe('important-backup');
    });

    it('should handle encrypted backup metadata', async () => {
      const mockFiles = ['encrypted.vbak'];
      vi.mocked(mockFs.readdir).mockResolvedValueOnce(mockFiles as any);
      vi.mocked(mockFs.stat).mockResolvedValue({
        size: 1024,
        mtime: new Date('2023-01-01T00:00:00Z'),
      } as any);

      // Mock gunzip to return non-JSON content (simulating encrypted data)
      const encryptedContent = 'encrypted-data-that-is-not-json';
      const mockZlib = await import('zlib');
      vi.mocked(mockZlib.gunzip).mockImplementation((_data: any, callback: any) => {
        callback(null, Buffer.from(encryptedContent));
      });

      vi.mocked(mockFs.readFile).mockResolvedValue(Buffer.from('encrypted-compressed-data'));

      const getBackupsDto: GetBackupsDto = {
        page: 1,
        limit: 10,
      };

      const result = await service.getBackups(getBackupsDto);

      expect(result.backups).toHaveLength(1);
      expect(result.backups[0].name).toBe('Encrypted Backup');
      expect(result.backups[0].hasPassword).toBe(true);
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup successfully', async () => {
      await service.deleteBackup('test-backup.vbak');

      expect(vi.mocked(mockFs.access)).toHaveBeenCalled();
      expect(vi.mocked(mockFs.unlink)).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Backup deleted'));
    });

    it('should throw NotFoundException for non-existent backup', async () => {
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      vi.mocked(mockFs.access).mockRejectedValueOnce(error);

      await expect(service.deleteBackup('non-existent.vbak')).rejects.toThrow(
        'Backup file not found',
      );
    });
  });

  describe('restoreBackup', () => {
    it('should start restore task successfully', async () => {
      const restoreDto: RestoreBackupDto = {
        overwriteExisting: true,
        restoreMedia: true,
        restoreAnalytics: false,
        restoreLogs: false,
      };

      const result = await service.restoreBackup('test-backup.vbak', restoreDto);

      expect(result.taskId).toBeDefined();
      expect(vi.mocked(mockFs.access)).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent backup', async () => {
      const error = new Error('File not found');
      (error as any).code = 'ENOENT';
      vi.mocked(mockFs.access).mockRejectedValueOnce(error);

      const restoreDto: RestoreBackupDto = {
        overwriteExisting: false,
        restoreMedia: true,
        restoreAnalytics: false,
        restoreLogs: false,
      };

      await expect(service.restoreBackup('non-existent.vbak', restoreDto)).rejects.toThrow(
        'Backup file not found',
      );
    });
  });

  describe('getRestoreProgress', () => {
    it('should return restore progress', async () => {
      // First start a restore task
      const restoreDto: RestoreBackupDto = {
        overwriteExisting: false,
        restoreMedia: true,
        restoreAnalytics: false,
        restoreLogs: false,
      };
      const result = await service.restoreBackup('test-backup.vbak', restoreDto);
      const { taskId } = result;

      const progress = service.getRestoreProgress(taskId);

      expect(progress).toMatchObject({
        taskId,
        status: 'running',
        progress: 0,
      });
    });

    it('should throw NotFoundException for non-existent task', () => {
      expect(() => service.getRestoreProgress('non-existent-task')).toThrow(
        'Restore task not found',
      );
    });
  });
});
