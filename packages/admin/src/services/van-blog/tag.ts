import { client } from '../client';

export const tagService = {
  getTags: client.getTags,
  createTag: client.createTag,
  updateTag: client.updateTag,
  deleteTag: client.deleteTag,
  getPublicTags: client.getPublicTags,
};
