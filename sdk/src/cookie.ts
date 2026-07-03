/**
 * Auth cookie options shared between SSR middleware and client-side login.
 * Both must use identical settings or the browser will silently drop the
 * cookie when the site is served over plain HTTP.
 */
export const AUTH_COOKIE_OPTIONS = {
  sameSite: 'lax' as const,
  httpOnly: false,
} as const;
