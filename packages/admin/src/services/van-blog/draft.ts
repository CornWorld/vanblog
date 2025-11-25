import { client } from '../client';

export const draftService = {
  getDrafts: client.getDrafts,
  createDraft: client.createDraft,
  updateDraft: client.updateDraft,
  deleteDraft: client.deleteDraft,
  getDraft: client.getDraft,
  publishDraft: client.publishDraft,
};
