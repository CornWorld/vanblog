import { client } from '../client';

export const customPageService = {
  getCustomPages: client.getCustomPages,
  getCustomPage: client.getCustomPage,
  createCustomPage: client.createCustomPage,
  updateCustomPage: client.updateCustomPage,
  deleteCustomPage: client.deleteCustomPage,
  getCustomPageFolder: client.getCustomPageFolder,
  getCustomPageFile: client.getCustomPageFile,
  createCustomPageFile: client.createCustomPageFile,
  updateCustomPageFile: client.updateCustomPageFile,
  getPublicCustomPages: client.getPublicCustomPages,
  getPublicCustomPage: client.getPublicCustomPage,
};
