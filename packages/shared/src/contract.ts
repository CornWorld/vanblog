import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { SiteInfoSchema, UpdateSiteInfoSchema } from './schemas.js';

const c = initContract();

export const contract = c.router({
  getSiteInfo: {
    method: 'GET',
    path: '/admin/settings/site-info',
    responses: {
      200: SiteInfoSchema,
    },
    summary: 'Get site information',
  },
  updateSiteInfo: {
    method: 'PATCH',
    path: '/admin/settings/site-info',
    body: UpdateSiteInfoSchema,
    responses: {
      200: SiteInfoSchema,
    },
    summary: 'Update site information',
  },
});
