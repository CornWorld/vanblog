import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  PermissionNode,
  PermissionNodeReq,
  PermissionNodePatch,
  PermissionGroup,
  PermissionGroupReq,
  PermissionGroupPatch,
  DeleteResponse,
} from '../runtime/schema.js';

export const createPermissionContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    createNode: {
      method: 'POST',
      path: '/v2/permissions/nodes',
      body: PermissionNodeReq,
      responses: { 201: PermissionNode },
    },
    getNodes: {
      method: 'GET',
      path: '/v2/permissions/nodes',
      query: z.object({ module: z.string().optional() }).optional(),
      responses: { 200: z.array(PermissionNode) },
    },
    getNodeById: {
      method: 'GET',
      path: '/v2/permissions/nodes/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: PermissionNode },
    },
    updateNode: {
      method: 'PUT',
      path: '/v2/permissions/nodes/:id',
      pathParams: z.object({ id: z.string() }),
      body: PermissionNodePatch,
      responses: { 200: PermissionNode },
    },
    deleteNode: {
      method: 'DELETE',
      path: '/v2/permissions/nodes/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: DeleteResponse },
    },
    createGroup: {
      method: 'POST',
      path: '/v2/permissions/groups',
      body: PermissionGroupReq,
      responses: { 201: PermissionGroup },
    },
    getGroups: {
      method: 'GET',
      path: '/v2/permissions/groups',
      query: z.object({}).optional(),
      responses: { 200: z.array(PermissionGroup) },
    },
    getGroupById: {
      method: 'GET',
      path: '/v2/permissions/groups/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: PermissionGroup },
    },
    updateGroup: {
      method: 'PUT',
      path: '/v2/permissions/groups/:id',
      pathParams: z.object({ id: z.string() }),
      body: PermissionGroupPatch,
      responses: { 200: PermissionGroup },
    },
    deleteGroup: {
      method: 'DELETE',
      path: '/v2/permissions/groups/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: DeleteResponse },
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const permissionContract = createPermissionContract(c);
