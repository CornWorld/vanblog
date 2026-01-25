import { client } from '../client';

export const authService = {
  login: client.login,
  logout: client.logout,
};
