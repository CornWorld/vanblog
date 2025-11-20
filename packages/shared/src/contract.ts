import { initContract } from '@ts-rest/core';
import {
  SiteInfoSchema,
  UpdateSiteInfoSchema,
  SiteLayoutSchema,
  UpdateLayoutSchema,
  SiteThemeSchema,
  UpdateThemeSchema,
  FriendLinkSchema,
  CreateFriendLinkSchema,
  UpdateFriendLinkSchema,
  NavigationSchema,
  UpdateNavigationSchema,
  CustomCodeSchema,
  UpdateCustomCodeSchema,
  AboutInfoSchema,
  UpdateAboutSchema,
} from './schemas.js';
import { z } from 'zod';

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
  getLayoutSettings: {
    method: 'GET',
    path: '/admin/settings/layout',
    responses: {
      200: SiteLayoutSchema,
    },
    summary: 'Get layout settings',
  },
  updateLayoutSettings: {
    method: 'PATCH',
    path: '/admin/settings/layout',
    body: UpdateLayoutSchema,
    responses: {
      200: SiteLayoutSchema,
    },
    summary: 'Update layout settings',
  },
  getThemeSettings: {
    method: 'GET',
    path: '/admin/settings/theme',
    responses: {
      200: SiteThemeSchema,
    },
    summary: 'Get theme settings',
  },
  updateThemeSettings: {
    method: 'PATCH',
    path: '/admin/settings/theme',
    body: UpdateThemeSchema,
    responses: {
      200: SiteThemeSchema,
    },
    summary: 'Update theme settings',
  },
  getFriendLinks: {
    method: 'GET',
    path: '/admin/settings/friend-links',
    responses: {
      200: z.array(FriendLinkSchema),
    },
    summary: 'Get friend links',
  },
  createFriendLink: {
    method: 'POST',
    path: '/admin/settings/friend-links',
    body: CreateFriendLinkSchema,
    responses: {
      201: z.array(FriendLinkSchema),
    },
    summary: 'Create a new friend link',
  },
  updateFriendLink: {
    method: 'PATCH',
    path: '/admin/settings/friend-links/:index',
    pathParams: z.object({
      index: z.coerce.number(),
    }),
    body: UpdateFriendLinkSchema,
    responses: {
      200: z.array(FriendLinkSchema),
    },
    summary: 'Update a friend link by index',
  },
  deleteFriendLink: {
    method: 'DELETE',
    path: '/admin/settings/friend-links/:index',
    pathParams: z.object({
      index: z.coerce.number(),
    }),
    body: z.object({}),
    responses: {
      200: z.array(FriendLinkSchema),
    },
    summary: 'Delete a friend link by index',
  },
  getNavigation: {
    method: 'GET',
    path: '/admin/settings/navigation',
    responses: {
      200: z.array(NavigationSchema),
    },
    summary: 'Get navigation items',
  },
  updateNavigation: {
    method: 'PATCH',
    path: '/admin/settings/navigation',
    body: UpdateNavigationSchema,
    responses: {
      200: z.array(NavigationSchema),
    },
    summary: 'Update navigation items',
  },
  getCustomCode: {
    method: 'GET',
    path: '/admin/settings/custom-code',
    responses: {
      200: CustomCodeSchema,
    },
    summary: 'Get custom code injection settings',
  },
  updateCustomCode: {
    method: 'PATCH',
    path: '/admin/settings/custom-code',
    body: UpdateCustomCodeSchema,
    responses: {
      200: CustomCodeSchema,
    },
    summary: 'Update custom code injection settings',
  },
  getAboutInfo: {
    method: 'GET',
    path: '/admin/settings/about',
    responses: {
      200: AboutInfoSchema,
    },
    summary: 'Get about page content',
  },
  updateAboutInfo: {
    method: 'PATCH',
    path: '/admin/settings/about',
    body: UpdateAboutSchema,
    responses: {
      200: AboutInfoSchema,
    },
    summary: 'Update about page content',
  },
});
