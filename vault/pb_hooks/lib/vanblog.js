/// <reference path="../types.d.ts" />

// ============================================================================
// Vanblog JSVM 扩展 API 声明
// ============================================================================
//
// 此文件提供 IDE 补全(TypeScript 姿态),不是运行时代码。
// pb 0.39 的 jsvm 插件会自动生成 pb_hooks/types.d.ts,声明了所有 pb 原生
// API($app, Record, Collection, onRecordAfterCreateRequest, cronAdd 等)。
//
// 本文件补充声明 vanblog 特有的全局变量和辅助类型。
//
// 用法:在你的 .pb.js 文件顶部添加:
//   /// <reference path="./lib/vanblog.js" />
//

// ---------------------------------------------------------------------------
// pb 原生 API(pb 0.39 自动生成,这里仅列出 vanblog hooks 常用的)
// 完整声明见 pb_hooks/types.d.ts
// ---------------------------------------------------------------------------

/**
 * PocketBase app 实例。所有数据操作的核心入口。
 * @example
 * const col = $app.findCollectionByNameOrId("posts");
 * const record = $app.findRecordById("posts", "RECORD_ID");
 * $app.save(record);
 */
declare const $app: import("../types").App;

// ---------------------------------------------------------------------------
// vanblog 特有的 collection 字段类型(简化版,用于 DynamicModel)
// ---------------------------------------------------------------------------

/**
 * posts 表记录的常用字段。
 * 用于 onRecordAfterCreateRequest / onRecordAfterUpdateRequest 回调中
 * 通过 e.record.get("fieldName") 访问。
 */
interface VanblogPost {
    id: string;
    title: string;
    content: string;
    status: "draft" | "published" | "hidden";
    pathname: string;
    tags: string[];        // relation IDs to tags collection
    category: string;      // relation ID to categories collection
    author: string;        // relation ID to users collection
    private: boolean;
    password: string;
    copyright: string;
    viewCount: number;
    visitedCount: number;
    deleted: boolean;
    oldId: number;
    top: number;
    created: string;
    updated: string;
}

/**
 * site 表(单行)的常用字段。
 * @example
 * const site = $app.findFirstRecordByFilter("site", "");
 * const siteName = site.getString("siteName");
 */
interface VanblogSite {
    siteName: string;
    siteDesc: string;
    author: string;
    baseUrl: string;
    theme: "default" | "minimal" | "magazine" | "custom";
    defaultTheme: "auto" | "light" | "dark";
    commentsProvider: "disabled" | "waline" | "giscus" | "artalk" | "external";
    revisionsEnabled: boolean;
    revisionsRetention: number;
    httpsRedirect: boolean;
    allowedDomains: string[];
    routing: VanblogRouteRule[];
    nav: VanblogNavItem[];
    links: VanblogLinkItem[];
    socials: VanblogSocialItem[];
    rewards: VanblogRewardItem[];
}

/**
 * site.routing 中的单条路由规则。
 * @see VanblogSite.routing
 */
interface VanblogRouteRule {
    id: string;
    type: "proxy" | "redirect" | "rewrite" | "block";
    from: string;       // glob pattern, e.g. "/api/internal/*"
    to: string;         // target URL (for proxy/redirect)
    code?: number;      // HTTP status code (for redirect)
    headers?: Record<string, string>;
}

interface VanblogNavItem {
    name: string;
    value: string;
    level: number;
}

interface VanblogLinkItem {
    name: string;
    url: string;
    desc?: string;
    logo?: string;
}

interface VanblogSocialItem {
    type: "github" | "twitter" | "email" | "rss" | string;
    value: string;
}

interface VanblogRewardItem {
    name: string;
    value: string;
}

/**
 * visits 表的字段。
 */
interface VanblogVisit {
    date: string;       // "2006-01-02" format
    path: string;       // URL path, empty = site-wide aggregate
    views: number;
    uniques: number;
    post: string;       // relation ID to posts
    lastVisitedAt: string;
}

/**
 * audits 表的字段。
 */
interface VanblogAudit {
    actor: string;      // relation ID to users
    action: string;     // e.g. "auth.login", "post.delete"
    target: string;
    result: "success" | "failure";
    detail: Record<string, any>;
    ip: string;
    userAgent: string;
}
