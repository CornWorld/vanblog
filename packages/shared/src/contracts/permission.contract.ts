import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createPermissionContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    createNode: {
      method: 'POST',
      path: '/v2/permissions/nodes',
      body: z.any(),
      responses: { 201: z.any() },
    },
    getNodes: {
      method: 'GET',
      path: '/v2/permissions/nodes',
      query: z.any().optional(),
      responses: { 200: z.array(z.any()) },
    },
    getNodeById: {
      method: 'GET',
      path: '/v2/permissions/nodes/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.any() },
    },
    updateNode: {
      method: 'PUT',
      path: '/v2/permissions/nodes/:id',
      pathParams: z.object({ id: z.string() }),
      body: z.any(),
      responses: { 200: z.any() },
    },
    deleteNode: {
      method: 'DELETE',
      path: '/v2/permissions/nodes/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.void() },
    },
    createGroup: {
      method: 'POST',
      path: '/v2/permissions/groups',
      body: z.any(),
      responses: { 201: z.any() },
    },
    getGroups: {
      method: 'GET',
      path: '/v2/permissions/groups',
      query: z.any().optional(),
      responses: { 200: z.array(z.any()) },
    },
    getGroupById: {
      method: 'GET',
      path: '/v2/permissions/groups/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.any() },
    },
    updateGroup: {
      method: 'PUT',
      path: '/v2/permissions/groups/:id',
      pathParams: z.object({ id: z.string() }),
      body: z.any(),
      responses: { 200: z.any() },
    },
    deleteGroup: {
      method: 'DELETE',
      path: '/v2/permissions/groups/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.void() },
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const permissionContract = createPermissionContract(c);
