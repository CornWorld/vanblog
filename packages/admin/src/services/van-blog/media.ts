import { client } from '../client';

export const mediaService = {
  getMedia: client.getMedia,
  deleteMedia: client.deleteMedia,
  batchDeleteMedia: client.batchDeleteMedia,
  scanMedia: client.scanMedia,
  exportMedia: client.exportMedia,
};
