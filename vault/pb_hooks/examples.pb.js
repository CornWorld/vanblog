/// <reference path="./lib/vanblog.d.ts" />

/*
 * Vanblog Example Hooks (JSVM)
 * ===========================================================================
 * 学习样板,不执行任何钩子——整个文件都在注释里。把某个示例复制到你自己的
 * .pb.js 文件、去掉注释并按需修改;钩子文件放 pb_hooks/,boot 预检会先做语法
 * 检查(用户钩子语法错 → 响亮降级:剔除并报告,站点照常起)。
 *
 * API 全部是 PocketBase 原生全局($app、Record、onRecordAfterCreateSuccess、
 * cronAdd、routerUse、$http ...),由 jsvm 插件注入每个 executor VM。
 * ===========================================================================
 */

/*
 * ── Hook 契约(每条示例都遵守;JS 没有编译器替你把关) ──────────────────────
 *
 * 1. 请求钩子(onRecord*Request)与中间件(routerUse):每条代码路径要么
 *    `return e.next()`,要么显式 `throw`(如校验失败)。裸 return / 掉尾
 *    会静默吞掉默认的 save/update,链条就此中断——2026-09-15 的 media-chain
 *    回归正是这一类失败。
 *
 * 2. 事件钩子(onRecordAfter*Success 等)同样必须 `return e.next()`:裸
 *    return 会静默截断后续订阅者。
 *
 * 3. 顶层的 const/function 对回调不可见(每个回调在独立 executor VM 里
 *    重新编译)——回调体内只能用 PB 全局和自己的局部变量。
 *
 * 4. 禁止 async/await。pb 不 await Promise:rejected Promise 运行时不接
 *    (不会变成你能看到的错误),e.next() 也跨不过 Promise 边界。同步
 *    try/catch 只护得住同步段——见示例 7 的用法。
 *
 * 5. 没有超时与内存上限:卡死的钩子会一直占着 jsvm 池位直到进程重启。
 *    cron 回调同规,且回调里抛出的错误只会打到 console——要告警就自己
 *    try/catch 后转发(示例 7)。
 *
 * 6. 覆盖边界:核心审计(post.create / tag.delete / auth.login ...)与后台
 *    链(Astro 缓存失效重试等)由 Go 层(internal/audit、internal/article)
 *    直写数据库,不经过 JSVM——你的钩子看不到这些写,也不要试图复刻;
 *    记自己的事件直接写 audits collection(示例 6)。
 * ===========================================================================
 */

/*
 * ── 示例 1:新文章发布后发 webhook 通知 ────────────────────────────────────
 * 通知属于「成功之后的副作用」——用 AfterCreateSuccess,只有真正落库了才发。
 * 契约 1/2:结尾 return e.next()。
 *
 * onRecordAfterCreateSuccess(function (e) {
 *     if (e.record.get("status") !== "published") return e.next();
 *     const title = e.record.get("title");
 *     const pathname = e.record.get("pathname") || ("/posts/" + e.record.id);
 *     // 同步 HTTP(pb 的 $http 是阻塞实现,不要包进 async):
 *     // $http.send({ method: "POST", url: "https://hooks.slack.com/...", body: ... })
 *     console.log("[vanblog] new post published:", title, pathname);
 *     return e.next();
 * }, "posts");
 */

/*
 * ── 示例 2:pathname 为空时从标题自动生成 slug ─────────────────────────────
 * 请求钩子里改 record,然后放行默认保存。
 * 契约 1:改完必须 return e.next(),否则保存被吞。
 *
 * onRecordCreateRequest(function (e) {
 *     if (!e.record.get("pathname")) {
 *         const title = e.record.get("title") || "untitled";
 *         const slug = title.toLowerCase()
 *             .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
 *             .replace(/^-+|-+$/g, "");
 *         e.record.set("pathname", "/" + slug);
 *     }
 *     return e.next();
 * }, "posts");
 */

/*
 * ── 示例 3:校验标签数量上限 ────────────────────────────────────────────────
 * 校验失败的两条正路:显式 throw(请求以 400 终止),或 return e.next() 放行。
 * 没有第三条——裸 return 等于静默丢请求。
 *
 * onRecordCreateRequest(function (e) {
 *     const tags = e.record.get("tags") || [];
 *     if (tags.length > 10) {
 *         throw new BadRequestError("Maximum 10 tags per post");
 *     }
 *     return e.next();
 * }, "posts");
 */

/*
 * ── 示例 4:每日访问统计汇总 ────────────────────────────────────────────────
 * cronAdd 的回调同样受契约 5 约束:无超时上限、抛错只进 console。
 * findRecordsByFilter 的完整签名:
 *   (collection, filter, sort, limit, offset, params)
 *
 * cronAdd("daily-stats-push", "0 8 * * *", function () {
 *     const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
 *     const visits = $app.findRecordsByFilter(
 *         "visits", "date = {:d}", "", 0, 0, { d: yesterday }
 *     );
 *     let total = 0;
 *     for (const v of visits) total += v.getInt("views");
 *     console.log("[vanblog] yesterday views:", total);
 * });
 */

/*
 * ── 示例 5:给所有 API 响应加自定义头 ───────────────────────────────────────
 * 中间件与请求钩子同规:必须把链条交回去。
 *
 * routerUse(function (e) {
 *     e.response.header("X-Powered-By", "Vanblog");
 *     return e.next();
 * });
 */

/*
 * ── 示例 6:记录自定义审计事件 ──────────────────────────────────────────────
 * 核心审计(post.create、tag.delete、auth.login ...)在 Go 层,钩子看不到
 * 也不必重注册(契约 6)。要记你自己的事件,往共享 audits collection 写行:
 *
 * onRecordAfterCreateSuccess(function (e) {
 *     const col = $app.findCollectionByNameOrId("audits");
 *     const row = new Record(col);
 *     if (e.auth && e.auth.collection().name === "users") row.set("actor", e.auth.id);
 *     row.set("action", "newsletter.subscribe");
 *     row.set("target", e.record.id);
 *     row.set("result", "success");
 *     row.set("ip", e.realIP());
 *     $app.save(row);
 *     return e.next();
 * }, "subscribers");
 */

/*
 * ── 示例 7:失败审计行推送到自己的 webhook ──────────────────────────────────
 * 平台后台链失败时会把 result="failure" 的行写进 audits(例如 Astro 缓存
 * 失效重试仍不成功——Go 层每几秒重放,admin 审计页可见)。要 PUSH 告警就轮询
 * 近期失败行并转发。契约 4/5:$http.send 是同步调用,同步 try/catch 护得住;
 * 包成 async 就谁也看不见错误了。
 *
 * cronAdd("failure-alert-push", "*\/10 * * * *", function () {
 *     const webhookUrl = "https://hooks.slack.com/services/YOURS";
 *     const since = new Date(Date.now() - 10 * 60 * 1000).toISOString().replace("T", " ");
 *     const failures = $app.findRecordsByFilter(
 *         "audits", "result = 'failure' && created > {:since}", "-created", 20, 0, { since: since }
 *     );
 *     if (!failures.length) return;
 *     const lines = failures.map(function (f) {
 *         return "[" + f.get("action") + "] " + (f.get("detail") || f.get("target"));
 *     });
 *     try {
 *         $http.send({
 *             url: webhookUrl,
 *             method: "POST",
 *             headers: { "Content-Type": "application/json" },
 *             body: JSON.stringify({ text: "VanBlog 失败提醒:\n" + lines.join("\n") }),
 *             timeout: 5,
 *         });
 *     } catch (e) {
 *         console.error("[vanblog] failure-alert push failed:", e);
 *     }
 * });
 */
