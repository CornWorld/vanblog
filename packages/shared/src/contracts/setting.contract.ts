import { initContract } from '@ts-rest/core';
import { z } from 'zod';

/**
 * 关于页面更新 schema
 */
const UpdateAboutSchema = z.object({ content: z.string() });

/**
 * 自定义代码更新 schema
 */
const UpdateCustomCodeSchema = z.object({
  css: z.string().optional(),
  script: z.string().optional(),
  html: z.string().optional(),
  head: z.string().optional(),
});

/**
 * 友链创建 schema
 */
const CreateFriendLinkSchema = z.object({
  name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  avatar: z.string().optional(),
});

/**
 * 友链更新 schema
 */
const UpdateFriendLinkSchema = CreateFriendLinkSchema.partial();

/**
 * 导航菜单项 schema（支持嵌套）
 */
const NavigationItemSchema: z.ZodType<{
  name: string;
  path: string;
  icon?: string;
  external?: boolean;
  children?: Array<{
    name: string;
    path: string;
    icon?: string;
    external?: boolean;
    children?: unknown[];
  }>;
}> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    icon: z.string().optional(),
    external: z.boolean().optional(),
    children: z.array(NavigationItemSchema).optional(),
  }),
);

/**
 * 导航菜单更新 schema
 */
const UpdateNavigationSchema = z.object({ items: z.array(NavigationItemSchema) });

/**
 * 布局设置更新 schema
 */
const UpdateLayoutSchema = z.object({
  showRecentPosts: z.boolean().optional(),
  recentPostsCount: z.number().optional(),
  showCategories: z.boolean().optional(),
  showTags: z.boolean().optional(),
  showArchive: z.boolean().optional(),
  showAbout: z.boolean().optional(),
  showSearch: z.boolean().optional(),
});

/**
 * 站点信息更新 schema
 */
const UpdateSiteInfoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

/**
 * 主题设置更新 schema
 */
const UpdateThemeSchema = z.object({
  primaryColor: z.string().optional(),
  darkMode: z.boolean().optional(),
});

/**
 * 静态资源设置更新 schema
 */
const UpdateStaticSettingSchema = z.object({
  storageType: z.enum(['local', 'oss', 's3']).optional(),
  maxSize: z.number().optional(),
  allowedTypes: z.array(z.string()).optional(),
});

/**
 * 静态资源设置 schema
 */
const StaticSettingSchema = z.object({
  storageType: z.enum(['local', 'oss', 's3']),
  maxSize: z.number(),
  allowedTypes: z.array(z.string()),
});

/**
 * HTTPS 设置更新 schema
 */
const UpdateHttpsSettingSchema = z.object({
  enabled: z.boolean().optional(),
  autoRedirect: z.boolean().optional(),
});

/**
 * HTTPS 设置 schema
 */
const HttpsSettingSchema = z.object({
  enabled: z.boolean(),
  autoRedirect: z.boolean(),
});

/**
 * 验证错误响应 schema
 *
 * Validation error response schema - for Zod validation failures
 */
const ValidationErrorSchema = z.object({
  message: z.string(),
  issues: z.array(
    z.object({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
      code: z.string(),
    }),
  ),
});

export const createSettingContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    updateStatic: {
      method: 'PATCH',
      path: '/v2/settings/static',
      body: UpdateStaticSettingSchema,
      responses: {
        200: StaticSettingSchema,
        400: ValidationErrorSchema,
      },
    },
    updateHttps: {
      method: 'PATCH',
      path: '/v2/settings/https',
      body: UpdateHttpsSettingSchema,
      responses: {
        200: HttpsSettingSchema,
        400: ValidationErrorSchema,
      },
    },
    getSiteInfo: {
      method: 'GET',
      path: '/v2/settings/site-info',
      responses: {
        200: z.object({
          title: z.string(),
          description: z.string(),
          author: z.string(),
          keywords: z.array(z.string()),
        }),
      },
    },
    updateSiteInfo: {
      method: 'PATCH',
      path: '/v2/settings/site-info',
      body: UpdateSiteInfoSchema,
      responses: {
        200: z.object({
          title: z.string(),
          description: z.string(),
          author: z.string(),
          keywords: z.array(z.string()),
        }),
        400: ValidationErrorSchema,
      },
    },
    getLayout: {
      method: 'GET',
      path: '/v2/settings/layout',
      responses: {
        200: z.object({
          showRecentPosts: z.boolean(),
          recentPostsCount: z.number(),
          showCategories: z.boolean(),
          showTags: z.boolean(),
          showArchive: z.boolean(),
          showAbout: z.boolean(),
          showSearch: z.boolean(),
        }),
      },
    },
    updateLayout: {
      method: 'PATCH',
      path: '/v2/settings/layout',
      body: UpdateLayoutSchema,
      responses: {
        200: z.object({
          showRecentPosts: z.boolean(),
          recentPostsCount: z.number(),
          showCategories: z.boolean(),
          showTags: z.boolean(),
          showArchive: z.boolean(),
          showAbout: z.boolean(),
          showSearch: z.boolean(),
        }),
        400: ValidationErrorSchema,
      },
    },
    getTheme: {
      method: 'GET',
      path: '/v2/settings/theme',
      responses: {
        200: z.object({
          primaryColor: z.string(),
          darkMode: z.boolean(),
        }),
      },
    },
    updateTheme: {
      method: 'PATCH',
      path: '/v2/settings/theme',
      body: UpdateThemeSchema,
      responses: {
        200: z.object({
          primaryColor: z.string(),
          darkMode: z.boolean(),
        }),
        400: ValidationErrorSchema,
      },
    },
    getFriendLinks: {
      method: 'GET',
      path: '/v2/settings/friend-links',
      responses: {
        200: z.array(
          z.object({
            name: z.string(),
            url: z.string(),
            description: z.string().optional(),
            avatar: z.string().optional(),
          }),
        ),
      },
    },
    createFriendLink: {
      method: 'POST',
      path: '/v2/settings/friend-links',
      body: CreateFriendLinkSchema,
      responses: {
        201: z.array(
          z.object({
            name: z.string(),
            url: z.string(),
            description: z.string().optional(),
            avatar: z.string().optional(),
          }),
        ),
        400: ValidationErrorSchema,
      },
    },
    updateFriendLink: {
      method: 'PATCH',
      path: '/v2/settings/friend-links/:index',
      pathParams: z.object({ index: z.string() }),
      body: UpdateFriendLinkSchema,
      responses: {
        200: z.array(
          z.object({
            name: z.string(),
            url: z.string(),
            description: z.string().optional(),
            avatar: z.string().optional(),
          }),
        ),
        400: ValidationErrorSchema,
      },
    },
    deleteFriendLink: {
      method: 'DELETE',
      path: '/v2/settings/friend-links/:index',
      pathParams: z.object({ index: z.string() }),
      responses: {
        200: z.array(
          z.object({
            name: z.string(),
            url: z.string(),
            description: z.string().optional(),
            avatar: z.string().optional(),
          }),
        ),
      },
    },
    getNavigation: {
      method: 'GET',
      path: '/v2/settings/navigation',
      responses: {
        200: z.array(NavigationItemSchema),
      },
    },
    updateNavigation: {
      method: 'PATCH',
      path: '/v2/settings/navigation',
      body: UpdateNavigationSchema,
      responses: {
        200: z.array(NavigationItemSchema),
        400: ValidationErrorSchema,
      },
    },
    getCustomCode: {
      method: 'GET',
      path: '/v2/settings/custom-code',
      responses: {
        200: z.object({
          css: z.string().optional(),
          script: z.string().optional(),
          html: z.string().optional(),
          head: z.string().optional(),
        }),
      },
    },
    updateCustomCode: {
      method: 'PATCH',
      path: '/v2/settings/custom-code',
      body: UpdateCustomCodeSchema,
      responses: {
        200: z.object({
          css: z.string().optional(),
          script: z.string().optional(),
          html: z.string().optional(),
          head: z.string().optional(),
        }),
        400: ValidationErrorSchema,
      },
    },
    getAbout: {
      method: 'GET',
      path: '/v2/settings/about',
      responses: {
        200: z.object({ content: z.string(), updatedAt: z.string() }),
      },
    },
    updateAbout: {
      method: 'PATCH',
      path: '/v2/settings/about',
      body: UpdateAboutSchema,
      responses: {
        200: z.object({ content: z.string(), updatedAt: z.string() }),
        400: ValidationErrorSchema,
      },
    },
  });
