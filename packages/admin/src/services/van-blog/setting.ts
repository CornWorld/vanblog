import { client } from '../client';
import {
  UpdateSiteInfo,
  UpdateLayout,
  UpdateTheme,
  CreateFriendLink,
  UpdateFriendLink,
  UpdateNavigation,
  UpdateCustomCode,
  UpdateAbout,
} from '@vanblog/shared';

export const settingService = {
  getSiteInfo: async () => {
    const result = await client.getSiteInfo();
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to get site info');
  },
  updateSiteInfo: async (data: UpdateSiteInfo) => {
    const result = await client.updateSiteInfo({ body: data });
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to update site info');
  },
  getLayoutSettings: async () => {
    const result = await client.getLayoutSettings();
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to get layout settings');
  },
  updateLayoutSettings: async (data: UpdateLayout) => {
    const result = await client.updateLayoutSettings({ body: data });
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to update layout settings');
  },
  getThemeSettings: async () => {
    const result = await client.getThemeSettings();
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to get theme settings');
  },
  updateThemeSettings: async (data: UpdateTheme) => {
    const result = await client.updateThemeSettings({ body: data });
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to update theme settings');
  },
  getFriendLinks: async () => {
    const result = await client.getFriendLinks();
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to get friend links');
  },
  createFriendLink: async (data: CreateFriendLink) => {
    const result = await client.createFriendLink({ body: data });
    if (result.status === 201) {
      return result.body;
    }
    throw new Error('Failed to create friend link');
  },
  updateFriendLink: async (index: number, data: UpdateFriendLink) => {
    const result = await client.updateFriendLink({ params: { index }, body: data });
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to update friend link');
  },
  deleteFriendLink: async (index: number) => {
    const result = await client.deleteFriendLink({ params: { index }, body: {} });
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to delete friend link');
  },
  getNavigation: async () => {
    const result = await client.getNavigation();
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to get navigation');
  },
  updateNavigation: async (data: UpdateNavigation) => {
    const result = await client.updateNavigation({ body: data });
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to update navigation');
  },
  getCustomCode: async () => {
    const result = await client.getCustomCode();
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to get custom code');
  },
  updateCustomCode: async (data: UpdateCustomCode) => {
    const result = await client.updateCustomCode({ body: data });
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to update custom code');
  },
  getAboutInfo: async () => {
    const result = await client.getAboutInfo();
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to get about info');
  },
  updateAboutInfo: async (data: UpdateAbout) => {
    const result = await client.updateAboutInfo({ body: data });
    if (result.status === 200) {
      return result.body;
    }
    throw new Error('Failed to update about info');
  },
};
