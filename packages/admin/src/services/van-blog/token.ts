import { client } from '../client';

export const tokenService = {
  getTokens: client.getTokens,
  createToken: client.createToken,
  deleteToken: client.deleteToken,
};
