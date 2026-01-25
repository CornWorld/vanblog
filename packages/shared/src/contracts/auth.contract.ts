import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createAuthContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    login: {
      method: 'POST',
      path: '/v2/auth/login',
      body: z.any().optional(),
      responses: { 200: z.any() },
    },
    profile: { method: 'GET', path: '/v2/auth/profile', responses: { 200: z.any() } },
    logout: {
      method: 'POST',
      path: '/v2/auth/logout',
      body: z.any().optional(),
      responses: { 200: z.any() },
    },
    refresh: {
      method: 'POST',
      path: '/v2/auth/refresh',
      body: z.any().optional(),
      responses: { 200: z.any() },
    },
    revokeAll: {
      method: 'POST',
      path: '/v2/auth/revoke-all',
      body: z.object({}).optional(),
      responses: { 200: z.object({ message: z.string() }) },
    },
    logs: {
      method: 'GET',
      path: '/v2/auth/logs',
      query: z.any().optional(),
      responses: { 200: z.array(z.any()) },
    },
    csrfToken: { method: 'GET', path: '/v2/auth/csrf', responses: { 200: z.any() } },
    issueAnonymous: {
      method: 'POST',
      path: '/v2/auth/anonymous',
      body: z.object({}).optional(),
      query: z.object({ expiresIn: z.string().optional() }).optional(),
      responses: { 201: z.any() },
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const authContract = createAuthContract(c);
