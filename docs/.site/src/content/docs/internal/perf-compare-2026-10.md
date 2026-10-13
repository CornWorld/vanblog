---
title: 性能对比:原版 van-blog vs 本重构版(2026-10)
---

# 性能对比:原版 van-blog vs 本重构版(2026-10)

> 读者:维护者。回答:向原版用户宣传前,性能差异到底有多大、怎么测出来的。
> 实验脚本:`scripts/bench/seed_both.py`(双端灌同一语料)、`scripts/bench/benchmark2.py`(压测)、`scripts/bench/compare_experiment.py`(冷启动/空载)。
> 结论先行:**个人博客体量下两者性能同级,不要拿性能当主要卖点**;真实卖点是架构(单容器/SQLite/可维护栈)。

## 环境

| 项 | 值 |
|---|---|
| 宿主 | oci-sg,Ampere aarch64,24GB RAM,空载(load 0.00) |
| 原版 | `mereith/van-blog:latest`(v0.54.0,Node 18 + NestJS + Next.js + 内置 MongoDB 4.4 + Caddy) |
| 重构版 | `ghcr.io/cornworld/vanblog:prod-latest`(Go pb + Astro SSR + Caddy,一体化单容器) |
| 压测端 | Python ThreadPool,与服务同宿主,127.0.0.1 |

## 方法

1. 原版走 `/api/admin/init` 初始化,创建 admin;重构版走 `POST /api/vanblog/setup/complete` 初始化。
2. `seed_both.py` 把 `bench/corpus.jsonl` 前 10 篇真实语料(HN/arXiv 文本,单篇 2-6KB)灌进两边:同名分类 Tech、同名 pathname `bench-0..9`、内容逐字节一致。
3. 两边首页各预热 20 请求(ISR/缓存命中态),再测:
   - 串行延迟 n=100 ×3 轮
   - 并发 c=20 n=500 ×3 轮
   - 并发 c=50 n=1000 ×3 轮
   - 每轮取中位数
4. 内存:cgroup `docker stats`(容器整体 RSS),稳态(启动后 15s)与压测后各记一次。

偏差声明:
- 原版压测端口直连其 website SSR(:3001,即生产上其容器内 Caddy 的上游),重构版走自己的 Caddy(:80)——原版少一层代理,对原版略有利。
- c=50 时两者 QPS 同时到 ~800 平台期且 0 错误,判定为压测客户端(Python GIL)饱和,该档只用于验证"谁先崩",不用于排名。

## 结果

### 有内容首页(10 篇语料,热缓存)

| 指标(3 轮中位) | 原版 | 重构版 |
|---|---|---|
| 串行 avg | 2.10 ms | 2.22 ms |
| c=20 QPS | 765.5 | 803.2 |
| c=20 avg / p95 | 25.4 / 34.9 ms | 24.1 / 35.7 ms |
| c=50 QPS(客户端已饱和) | 839.5 | 795.9 |
| 压测后内存(含 DB/代理) | 417.1 MB(app 348.4 + mongo 68.7) | 374.3 MB |

### 空载实例(未灌内容,`compare_experiment.py`)

| 指标 | 原版(app+mongo) | 重构版 |
|---|---|---|
| 冷启动到首个 200(3 轮均值) | 4.19 s | 4.50 s |
| 稳态内存 | 212.2 MB(145.3 + 66.9) | 377.1 MB |
| c=20 QPS(当时首页=未初始化 JSON/降级页,仅参考) | 585.4 | 857.4 |

镜像大小:`mereith/van-blog:latest` 1.3GB(另需 mongo:4.4 ~0.7GB);`vanblog:prod-latest` 1.03GB(无外部 DB)。

## 结论

1. **吞吐/延迟同级**:个人博客体量下都远超需求,差异在噪声内(c=20 一个 +5% 一个 -5% 交替)。宣传文案不要写"快 X 倍"。
2. **内存同级,不是 80% 削减**:热态全部落在 ~370-420MB。空载下重构版反而多 ~165MB 固定成本——`--hooksPool=64` 的 V8 isolate 预热池 + Node theme host 常驻。原版内容灌入后(Next.js ISR 逐页渲染 + website 进程缓存)追平。
3. **冷启动同级**(~4.2s vs 4.5s)。
4. 真实差异在架构:1 容器 vs 2 容器(mongo 不可去)、SQLite 单文件 vs MongoDB 卷、三方栈持续维护 vs 停更。

## 坑位记录(复现实验前必读)

- 原版初始化走 `POST /api/admin/init`(InitMiddleware 对该路径放行,token 头任意);body 需要 `user{username,password,nickname}` + `siteInfo` 全字段(空串可)。
- `siteInfo.baseUrl` 留空会让原版 sitemap 生成在**启动时**崩进程(`new URL('/')` ERR_INVALID_URL,`entrypoint` 退出)。本实验用 mongo shell 补 `"siteInfo.baseUrl"` 后恢复。
- 原版 3000 是 API(EXpress,`/` 返回 "Hello World!"),真实前台在 website server **3001**;ISR 需打 `http://127.0.0.1:3001/api/revalidate?path=/`(容器内 node fetch 可达)。压测/验证务必打 3001。
- 原版每篇新文章触发全量 ISR,首页 HTML 热身后才含文章列表;预热不足会把"空首页"当原版成绩。
