// selfheal.pb.js —— 每日缓存自愈(平台自带,用户可改造)
//
// 背景:发布 → Astro 失效通知是单次 fire-and-forget,Astro 重启窗口内
// 丢失即首页停旧内容且无重试。本 cron 每日 04:00 重发一次失效(单次
// 幂等 HTTP),把自愈窗口收敛到 ≤24h;失败写 result=failure 审计行提醒
// 管理员。发布触发的失效本体在 Go 层(internal/article),本文件只负责
// 兜底自愈。
//
// 三种控制方式:
//  1. 开关(不改代码):site.displayOptions.revalidateSelfHeal = false
//     —— PB 管理界面编辑 site 记录的 displayOptions JSON 即可,每次
//     触发时读取,运行时生效;缺省开启。
//  2. 改造:直接编辑本文件,保存后热重载生效(换标签/改时间/加
//     webhook 通知均可)。
//  3. 彻底停用:方式 1,或删除/移走本文件后重启。
//
// 注意:容器/平台升级会把本文件重置为发行版内容——深度定制请复制为
// 新文件名(如 selfheal.custom.pb.js)并把 cron id 一并改名,避免双注册。
cronAdd("posts-revalidate-selfheal", "0 4 * * *", () => {
  // 1. 开关:site.displayOptions.revalidateSelfHeal !== false。
  //    读失败保持开启——自愈是无害兜底,不应静默关闭可靠性。
  try {
    const site = $app.findFirstRecordByFilter("site", "")
    const opts = JSON.parse(site.getString("displayOptions") || "{}")
    if (opts.revalidateSelfHeal === false) {
      console.log("[selfheal] disabled by site config, skipping")
      return
    }
  } catch (e) {
    console.error("[selfheal] site config read failed, proceeding:", e)
  }

  const astroUrl = $os.getenv("ASTRO_URL") || "http://127.0.0.1:4321"
  const fail = (reason) => {
    console.error("[selfheal] revalidate failed:", reason, astroUrl)
    // 失败提醒行(与 Go 侧 audit.OpsFailed 同形):审计失败只降级日志,
    // 绝不向外抛。
    try {
      const rec = new Record($app.findCollectionByNameOrId("audits"))
      rec.set("action", "revalidate.selfheal")
      rec.set("target", "posts,feed")
      rec.set("result", "failure")
      rec.set("detail", JSON.stringify({ reason, url: astroUrl }))
      $app.save(rec)
    } catch (e) {
      console.error("[selfheal] audit row write failed:", e)
    }
  }

  try {
    const res = $http.send({
      url: astroUrl + "/api/revalidate",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["posts", "feed"] }),
      timeout: 5,
    })
    if (res.statusCode !== 200) {
      fail("Astro returned non-OK: " + res.statusCode)
    } else {
      console.log("[selfheal] cache invalidated")
    }
  } catch (e) {
    fail("failed to reach Astro: " + e)
  }
})
