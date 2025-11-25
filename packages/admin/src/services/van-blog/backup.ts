import { client } from '../client';

export const backupService = {
  importBackup: client.importBackup,
  exportBackup: client.exportBackup,
  restoreBackup: client.restoreBackup,
};
