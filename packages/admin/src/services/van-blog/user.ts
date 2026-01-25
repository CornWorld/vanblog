import { client } from '../client';

export const userService = {
  updateProfile: client.updateProfile,
  getCollaborators: client.getCollaborators,
  createCollaborator: client.createCollaborator,
  updateCollaborator: client.updateCollaborator,
  deleteCollaborator: client.deleteCollaborator,
};
