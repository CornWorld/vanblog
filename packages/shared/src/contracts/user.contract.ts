import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { User, UserReq, UserPatch, DeleteResponse } from '../runtime/schema.js';

// Collaborator response (subset of User)
export const Collaborator = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().nullable().optional(),
});

export const createUserContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    create: {
      method: 'POST',
      path: '/v2/admin/users',
      body: UserReq,
      responses: { 201: User },
      summary: 'Create user',
    },
    list: {
      method: 'GET',
      path: '/v2/admin/users',
      responses: { 200: z.array(User) },
      summary: 'Get all users',
    },
    collaborators: {
      method: 'GET',
      path: '/v2/admin/users/collaborators',
      responses: { 200: z.array(Collaborator) },
      summary: 'Get collaborators',
    },
    getOne: {
      method: 'GET',
      path: '/v2/admin/users/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: User },
      summary: 'Get user by ID',
    },
    update: {
      method: 'PATCH',
      path: '/v2/admin/users/:id',
      pathParams: z.object({ id: z.string() }),
      body: UserPatch,
      responses: { 200: User },
      summary: 'Update user',
    },
    me: {
      method: 'GET',
      path: '/v2/admin/users/profile/me',
      responses: { 200: User },
      summary: 'Get current user profile',
    },
    delete: {
      method: 'DELETE',
      path: '/v2/admin/users/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: DeleteResponse },
      summary: 'Delete user',
    },
  });
