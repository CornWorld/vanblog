import {
  AuditDetailSchema,
  CategoryMetaSchema,
  IsoDateTimeSchema,
  MediaMetaSchema,
  S3ConfigSchema,
  SiteSchema,
  UserSchema,
  VisitSchema,
  models,
} from "./index";

const id = "record123";
const valid = {
  tags: { name: "zod" },
  categories: {
    name: "Tech",
    type: "category",
    meta: { keywords: ["ts"], custom: true },
  },
  users: {
    username: "admin",
    role: "admin",
    permissions: ["all"],
    avatar: "avatar.png",
    tokenKey: "token",
  },
  posts: {
    title: "Post",
    status: "published",
    tags: [id],
    created: "2026-07-10T00:00:00Z",
  },
  revisions: {
    target: id,
    snapshot: { title: "Old", content: "Body", status: "draft" },
  },
  media: {
    staticType: "img",
    storageType: "external",
    externalUrl: "https://example.com/a.png",
    meta: { width: 800, height: 600, size: 1024, custom: true },
  },
  site: {
    commentsProvider: "disabled",
    commentsConfig: {},
    mediaConfig: { enabled: true, targetFormat: "webp", quality: 84 },
    s3Config: { enabled: false },
  },
  visits: { date: "2026-07-10", post: id, views: 1, uniques: 1 },
  audits: {
    action: "routing.replace",
    result: "success",
    detail: { after: ["rule-1"], custom: true },
  },
  bookmarks: { title: "VanBlog", url: "https://vanblog.example", owner: id },
} satisfies Record<keyof typeof models, unknown>;

const invalid = {
  tags: { name: "" },
  categories: { name: "Tech", type: "invalid" },
  users: { username: "admin", permissions: ["root"] },
  posts: { title: "", status: "invalid" },
  revisions: {
    target: id,
    snapshot: { title: "Old", content: "Body", status: "invalid" },
  },
  media: { staticType: "img", meta: { width: -1 } },
  site: { mediaConfig: { enabled: true, targetFormat: "webp", quality: 101 } },
  visits: { date: "2026-07-10T00:00:00Z" },
  audits: { result: "unknown" },
  bookmarks: { title: "VanBlog", url: "not-a-url", owner: id },
} satisfies Record<keyof typeof models, unknown>;

function assertAccepts(
  name: string,
  schema: { safeParse(value: unknown): { success: boolean } },
  value: unknown
): void {
  if (!schema.safeParse(value).success)
    throw new Error(`${name}: valid fixture rejected`);
}

function assertRejects(
  name: string,
  schema: { safeParse(value: unknown): { success: boolean } },
  value: unknown
): void {
  if (schema.safeParse(value).success)
    throw new Error(`${name}: invalid fixture accepted`);
}

export function assertModelFixtures(): void {
  for (const name of Object.keys(models) as Array<keyof typeof models>) {
    assertAccepts(name, models[name], valid[name]);
    assertRejects(name, models[name], invalid[name]);
  }

  for (const value of [
    "2026-07-10 12:34:56.789Z",
    "2026-07-10 12:34:56.789+08:00",
    "2026-07-10T12:34:56.789Z",
    "",
  ]) {
    assertAccepts("datetime", IsoDateTimeSchema, value);
  }
  assertRejects("datetime", IsoDateTimeSchema, "2026-07-10 12:34:56Z");
  assertRejects("visit date", VisitSchema, { date: "2026-7-10" });

  const commentFixtures = {
    disabled: {},
    waline: { serverURL: "https://comments.example" },
    artalk: { server: "https://comments.example", site: "VanBlog" },
    giscus: {
      repo: "owner/repo",
      repoId: "repo-id",
      category: "General",
      categoryId: "category-id",
    },
    external: { customScript: "console.log('comments')" },
  } as const;
  for (const [provider, commentsConfig] of Object.entries(commentFixtures)) {
    assertAccepts(`comments ${provider}`, SiteSchema, {
      commentsProvider: provider,
      commentsConfig,
    });
    assertRejects(`comments ${provider} strict`, SiteSchema, {
      commentsProvider: provider,
      commentsConfig: { ...commentsConfig, unexpected: true },
    });
  }
  assertRejects("comments provider/config matrix", SiteSchema, {
    commentsProvider: "waline",
    commentsConfig: commentFixtures.giscus,
  });
  assertRejects("comments config null", SiteSchema, {
    commentsProvider: "disabled",
    commentsConfig: null,
  });

  assertAccepts("S3 disabled minimal", S3ConfigSchema, { enabled: false });
  assertAccepts("S3 enabled", S3ConfigSchema, {
    enabled: true,
    endpoint: "https://s3.example",
    bucket: "bucket",
    region: "region",
    accessKey: "key",
    secret: "secret",
  });
  assertRejects("S3 invalid endpoint", S3ConfigSchema, {
    enabled: true,
    endpoint: "not-a-url",
    bucket: "bucket",
    region: "region",
    accessKey: "key",
    secret: "secret",
  });
  assertRejects("S3 missing credentials", S3ConfigSchema, {
    enabled: true,
    endpoint: "https://s3.example",
    bucket: "bucket",
    region: "region",
  });

  assertRejects("media fractional width", MediaMetaSchema, { width: 1.5 });
  assertRejects("media negative size", MediaMetaSchema, { size: -1 });
  assertRejects("retention", SiteSchema, { revisionsRetention: -1 });
  assertRejects("visit count", VisitSchema, { date: "2026-07-10", views: 1.5 });

  const user = UserSchema.parse({
    username: "admin",
    avatar: "a.png",
    tokenKey: "key",
    password: "secret",
  });
  if (user.avatar !== "a.png" || user.tokenKey !== "key" || "password" in user)
    throw new Error("user auth field contract failed");
  if (CategoryMetaSchema.parse({ custom: true }).custom !== true)
    throw new Error("category meta extension stripped");
  if (MediaMetaSchema.parse({ custom: true }).custom !== true)
    throw new Error("media meta extension stripped");
  if (AuditDetailSchema.parse({ custom: true }).custom !== true)
    throw new Error("audit detail extension stripped");
}

assertModelFixtures();
