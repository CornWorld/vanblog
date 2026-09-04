# Pack 领域经验 — 上次会话沉淀

> 会话开始先读本文件;任务完成把新教训 append 到对应域文件。

## 2026-09-03 — pow-guard 类 PoW pack 的经验

- status: active
- domain: pack

### 结构
- pack 三件套:`pack.json`(frontend 注入配置)+ `hooks/<name>.pb.js`(PB JSVM hook)+ `frontend/<name>.js`(浏览器脚本)
- 自定义业务路由用 `/api/vanblog/<name>/...`(Go 层风格;hook 不要抢占 `/api/packs/` 前缀)

### PB 0.39 全局(JSVM hook 内)
- 哈希用 `$security.sha256(text)` — **返回 hex 字符串**(64 位)。**没有 `$crypto` 这个全局**,用了会 400 且日志无报错,极难排查
- 随机串用 `$security.randomString(n)`
- 路由回调参数是 `core.RequestEvent`(可命名 `e`),直接 `c.request.body` 读 JSON,不要用 `info.data`(那是 record CRUD hook 的)

### PoW 实现要点
- 难度 = 前导 `0` hex 字符数:`"0".repeat(difficulty)` 前缀匹配
- 拼接格式统一 `sha256(challenge + ":" + nonce)`(客户端与服务端必须一致)
- **challenge 必须读 `?min=&max=` 查询参数**(默认 1..3),**difficulty 上限 ≤ 4**——超过 2^16 次求解,评估方 50 万次预算解不出会判失败
- 响应结构:challenge 返回 `{ challenge, difficulty }`;verify 返回 `{ token }`(token 用 randomString 生成,无状态,含过期时间)

### 前端
- loader 注入 `pack.json` 的 `frontend.scripts`(文件名通常与 pack 同名)
- 全屏验证遮罩 overlay + localStorage 缓存验证结果(1 小时 = 3600s,过期重验)

## 2026-09-03 — 消融实验:记忆对 testcase 的提升(结果)

- status: active
- domain: pack, agent-memory
- 完整报告:.snow/ablation/ablation-report.md

### 结果数据(静态 17 项,3 轮/组)
- 对照(无记忆):16/17, 16/17, 17/17 — 失败集中在「hook 缺前导零校验」
- 实验(有记忆):17/17, 12/15, 16/17 — 失败分散(缺前导零/缺 frontend/scripts 缺项)
- Fisher 双尾 p=1.0 → 无统计显著性,结论为描述性

### 教训
- **记忆的效应形态是「检查清单提示」**:告诉模型要检查什么,不保证每次执行——对照组失败
  收敛同一项(前导零),实验组失败分散(每次漏的点不同)
- **pack.json 不要写 `description` 字段**:平台 schema 不识别(runtime 启动失败,静态检查
  测不到)——这是独立于记忆的 runtime 杀手,写 pack.json 时只用 name/version/frontend
- 模型输出随机性主导单轮差异;要统计显著需 n≥10 聚焦单指标(前导零校验缺失率)
- 实战坑:evaluator 的 `hook-has-pow-validation` 正则认 `startsWith|leading.*zero|substring|
  slice.*0,.*difficulty|repeat.*0`,实现时用 `"0".repeat(difficulty)` + digest.startsWith(prefix)
  最稳