import { client } from '../client';

export const metaService = {
  getPublicMeta: client.getPublicMeta,
  getVersion: client.getVersion,
  init: client.init,
};
