# Agent 记忆(agent-memory)

> 面向:会开发/维护 vanblog 内置 agent 记忆机制的开发者。
> 记忆机制的**行为契约**在 [`.agents/skills/vanblog/SKILL.md`](../../.agents/skills/vanblog/SKILL.md) `Cross-Session Memory` 节;本文件是它的设计说明 + 数据证据。
> 实验工件(全量报告、产物、注入文件)在 `.snow/ablation/`(gitignored),本文件只放结论摘要。

## 1. 为什么需要 agent 记忆

pi 原生能力:session tree、`-r` resume、JSONL 会话持久化、compaction——**无跨会话知识记忆**。
vanblog 内置 agent 每次 session 从零开始:重复决策、已踩过的坑、用户偏好都要重新摸索。
`docs/` 是权威知识源(端口、路径、契约),但缺「经验」:上次迁移踩了什么坑、某主题 override 怎么处理、用户偏好什么。

**分界**:`docs/` 存「参考事实」(SSOT),agent 记忆存「经验教训」。两者不重叠:
事实写 `docs/reference/*`;经验写 agent 记忆文件。

## 2. 机制

### 2.1 落点与格式

- 目录:`<pb_data>/agent-memory/`(容器内 `/pb_data`,env `$VANBLOG_DATA_DIR` 可覆盖;随数据卷备份)
- 格式:纯 Markdown,一个域一个文件(`theme.md` / `migration.md` / `pack.md` / `upgrade.md` / `general.md`)
- 条目:按域文件 append,新条目置顶;每条含 `status` / `domain` 字段

```markdown
## 2026-09-03 — 主题 override 检查
- status: active
- domain: theme
- 升级后必须逐个 diff themes/*/src/base-overrides/<rel> vs app/src/<rel>
```

### 2.2 生命周期

- 新条目 `status: active`;被新决策取代时改旧条目为 `superseded`(不删除,保留历史)
- 会话开始:读本任务相关域文件,应用 `active` 条目
- 任务完成:append 持久知识(决策/教训/偏好/坑),不写瞬时事实
- 事实属于 `docs/` 的 → 写 docs,不写记忆文件

### 2.3 检索(现状)

当前为**文件级检索**:按任务域分文件,会话开始读相关域全部内容。
语义检索(embedding)未落地——见 §4 实验结论,当前证据不足以上语义检索。

## 3. 设计决策与理由

| 决策                               | 理由                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| 落 `/pb_data` 而非 git 树            | 记忆随数据卷备份,不进仓库;不是代码,不污染 git                                                  |
| 按任务域分文件,不按日期平铺       | 主题任务只读 `theme.md`,检索范围天然缩小,降低 embedding 需求                                    |
| `status` 生命周期                   | 记忆会过期(升级后旧决策失效);标记 superseded 而非删除,读取时过滤                                |
| 纯 Markdown,无向量/无数据库       | 任务型 agent 记忆量小(数百条/月),文件级检索够用;避免为小规模引入向量 infra                     |
| 只记经验,不记事实                 | 事实进 docs(版本化、SSOT);记忆存经验,两者职责分离                                              |
| 不将层叠成 JSONL 会话              | 会话 JSONL 是过程轨迹,记忆文件是沉淀结论;分开存,各司其职                                       |

## 4. 实验证据:记忆对 testcase 的影响(消融,2026-09)

**设计**:同 prompt / 同模型(`deepseek-v4-flash-0731`)/ 同评价器(`evaluate-agent-pack.mjs` 17 项静态),
唯一变量 = 是否注入 `/pb_data/agent-memory/pack.md`。每组 3 轮,独立容器 + evaluator 隔离。
全报告:`.snow/ablation/ablation-report.md`。

**结果**(passed/17):

| 轮 | 对照(无记忆) | 实验(有记忆) |
|---|---|---|
| 1 | 16/17 | **17/17** |
| 2 | 16/17 | 12/15 |
| 3 | 17/17 | 16/17 |

**结论**:

1. **统计未证实**:Fisher 双尾 $p = 1.0$,无法拒绝 $H_0$(记忆无效应);$n=3$/组 功效不足,结论为描述性。
2. **定性效应存在**:对照组失败**收敛**于「hook 缺前导零校验」(2/3 轮),实验组第 1 轮该检查项由记忆提示补齐(`"0".repeat(difficulty)` + `startsWith(prefix)`)。
   → 记忆的形态是**检查清单提示**:告诉模型要检查什么,不保证每次执行。
3. **模型随机性占主导**:实验组各轮失败互不相同(缺前导零 / 缺 frontend 文件 / scripts 列表缺项)。
4. **独立发现**:`pack.json` 的 `description` 字段平台 schema 不识别 → runtime 启动失败,静态检查测不到。
   → 这是独立于记忆的 runtime 杀手,已沉淀进记忆文件(见 §5)。

**方法论教训**:静态 17 项多数恒过,判别力低;要统计显著需聚焦单指标(前导零缺失率)且 $n \geq 10$。

## 5. 当前记忆内容(经验沉淀)

开启跨会话记忆后,以下教训已写入记忆文件、经实验证实有效:

- pack.json 只用 `name` / `version` / `frontend`,**不要 `description`**(平台不识别,runtime 挂)
- PoW verify 用 `"0".repeat(difficulty)` + `digest.startsWith(prefix)`;difficulty 钳制 `[1,4]`
- 写 hook 前先 grep `pb-jsvm-types.d.ts` 确认全局签名

这些条目实时更新在 `<pb_data>/agent-memory/pack.md`(运行态);本文件不复制(防 S1 重复)。

## 6. 未来方向(仅在证据充分时)

- **FTS5 关键词召回**(零成本,SQLite 原生):记忆量 > 千条或文件级检索不够时
- **语义检索**(需正式 OpenRouter key):`qwen/qwen3-embedding-8b` + 三路混合(RRF);仅当「语义相关但关键词不同的记忆」成为真实瓶颈
- 当前**不上** embedding:实验未证实文件级检索是瓶颈,且需额外配置成本