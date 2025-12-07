import { initContract } from '@ts-rest/core';
import { z } from 'zod';

// TODO: 需要从 server-ng DTOs 迁移到 shared/schemas
const CreateUserSchema = z.object({
  username: z.string(),
  password: z.string(),
  email: z.string().optional(),
  role: z.string(),
  permissions: z.union([z.array(z.string()), z.string()]).optional(),
});

const UpdateUserSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export const UserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().optional(),
  role: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

export const CollaboratorResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().optional(),
});

export type CollaboratorResponse = z.infer<typeof CollaboratorResponseSchema>;

export const createUserContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    create: {
      method: 'POST',
      path: '/v2/admin/users',
      body: CreateUserSchema,
      responses: { 201: UserResponseSchema },
      summary: 'Create user',
    },
    list: {
      method: 'GET',
      path: '/v2/admin/users',
      responses: { 200: z.array(UserResponseSchema) },
      summary: 'Get all users',
    },
    collaborators: {
      method: 'GET',
      path: '/v2/admin/users/collaborators',
      responses: { 200: z.array(CollaboratorResponseSchema) },
      summary: 'Get collaborators',
    },
    getOne: {
      method: 'GET',
      path: '/v2/admin/users/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: UserResponseSchema },
      summary: 'Get user by ID',
    },
    update: {
      method: 'PATCH',
      path: '/v2/admin/users/:id',
      pathParams: z.object({ id: z.string() }),
      body: UpdateUserSchema,
      responses: { 200: UserResponseSchema },
      summary: 'Update user',
    },
    me: {
      method: 'GET',
      path: '/v2/admin/users/profile/me',
      responses: { 200: UserResponseSchema },
      summary: 'Get current user profile',
    },
    delete: {
      method: 'DELETE',
      path: '/v2/admin/users/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.object({ message: z.string() }) },
      summary: 'Delete user',
    },
  });
