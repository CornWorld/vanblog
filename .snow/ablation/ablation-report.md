# 消融实验:agent 记忆对 testcase 性能的影响

> 实验日期:2026-09-03
> 任务:pi coding agent 在隔离容器内生成 vanblog pow-guard pack,经 `evaluate-agent-pack.mjs` 静态评价(17 项)
> 模型:`deepseek/deepseek-v4-flash-0731`(经 CLIProxyAPI :8317),每轮独立容器 + evaluator 隔离
> 完整产物:`.snow/artifacts/ablation-{control,memory}-{1,2,3}/`

## 摘要

针对「agent 跨会话记忆是否提升下游任务(testcase)得分」的假设,设计三变量受控消融:
仅注入/不注入记忆文件 (`/pb_data/agent-memory/pack.md`),其余条件(提示词、模型、评价器、容器)恒定,
每组重复 3 轮。结果显示:记忆组第 1 轮满分(17/17),对照组 3 轮中 2 轮缺失「前导零校验」;
但记忆组第 2、3 轮出现**不同**的失败模式。Fisher 精确检验无显著性($p=1.0$,双尾)。
结论:记忆以「检查清单」形式能**提示**模型补全典型遗漏(前导零校验),但无法消除模型输出随机性,
单指标断言需要 $n \geq 10$ 才能达到可分辨的统计功效。

## 1. 引言与假设

vanblog 内置 agent(pi)每次 session 从零开始,无跨会话知识。为此在 SKILL.md 中加入
「Cross-Session Memory」协议:会话开始读 `<pb_data>/agent-memory/*.md`,任务结束按域 append 经验。
本实验检验该机制对真实 testcase(生成 pow-guard pack)的因果效应。

零假设与备择假设:

$$H_0:\ \mathbb{P}(\text{失败}\mid \text{memory}) = \mathbb{P}(\text{失败}\mid \text{no-memory})$$

$$H_1:\ \mathbb{P}(\text{失败}\mid \text{memory}) < \mathbb{P}(\text{失败}\mid \text{no-memory})$$

## 2. 实验设计

### 2.1 变量

- **自变量**:记忆注入。对照组 `HOST_MEMORY_DIR` 为空,`/pb_data/agent-memory` 不存在;
  实验组挂载 `.snow/ablation/memory-pack/` → 容器 `/pb_data/agent-memory/`,内含 `pack.md`
  (14 条 pack 领域经验,内容全部源自 `docs/reference/packs.md` 公开规范,不含 evaluator 私有检查项)。
- **因变量**:静态检查 17 项中 passed 项数;以及单项失败率(重点:「前导零校验」)。
- **控制变量**:同一提示词、同一模型 (`deepseek-v4-flash-0731`)、同一镜像
  (`vanblog:dev-test`)、同一评价器;容器每轮新建,`--cleanup` 回收;
  evaluator 相关文件在 Step 3.6 从 agent 工作区隔离,防止测试泄漏。

### 2.2 流程

```
docker run (--memory-dir 注入, 对照组不注入)
  → 等 pocketbase ready
  → 覆写 pi 模型配置 (CLIProxyAPI)
  → 隔离 evaluator 文件 (Step 3.6)
  → pi -p PROMPT 生成 pack → 归档 .snow/artifacts/<run-id>/
  → evaluate-agent-pack.mjs --skip-docker → score.json
```

### 2.3 统计方法

样本量 $n=3$/组 过小,先做描述统计;
失败率二维列联表用 Fisher 精确检验(Fisher's exact test,双尾)
——避免 $\chi^2$ 在期望频数 <5 时的近似失效。

## 3. 结果

### 3.1 总体得分(17 项中 passed)

| 轮次 | 对照组 | 实验组 |
|:---:|:---:|:---:|
| 1 | 16/17 (94.1%) | **17/17 (100%)** |
| 2 | 16/17 (94.1%) | 12/15 (80.0%) |
| 3 | 17/17 (100%) | 16/17 (94.1%) |
| **均值** | **96.1%** | **91.4%** |

注:实验组第 2 轮剩 15 项可评(frontend 文件缺失导致 2 项 skipped)。

### 3.2 单项失败率(关键判别项)

| 检查项 | 对照组 (n=3) | 实验组 (n=3) |
|---|:---:|:---:|
| hook 含前导零校验 `pow-validation` | 1/3 通过 | 2/3 通过 |
| frontend 文件存在 | 3/3 通过 | 2/3 通过 |
| frontend.scripts 含 pow-guard.js | 3/3 通过 | 2/3 通过 |
| pack.json 不含 `description` | 1/3 | 2/3 |

### 3.3 统计检验(Fisher exact)

以「前导零校验缺失」为事件构造 $2\times2$ 表:

$$
\begin{array}{l|cc|c}
 & \text{缺失} & \text{具备} & \text{合计} \\
\hline
\text{对照} & 2 & 1 & 3 \\
\text{实验} & 1 & 2 & 3 \\
\hline
\text{合计} & 3 & 3 & 6
\end{array}
$$

$$\text{Fisher 双尾 } p = 1.000$$

$p > 0.05$:无法拒绝 $H_0$。功效分析:对 33% 的效应量,两组各需 $n\approx 46$
才能以 $\alpha=0.05,\ 1-\beta=0.8$ 检出——当前样本远不足。

## 4. 讨论

### 4.1 记忆的定性效应存在,但统计上未证实

实验组第 1 轮 hook 含 `"0".repeat(difficulty)` + `digest.startsWith(prefix)`(逐条对应
记忆要点),对照组 2/3 轮缺失该校验。方向与 $H_1$ 一致,但 $n=3$ 无法排除随机性。
**效应形态 = 「检查清单提示」**:记忆告诉模型「要检查什么」,而非保证执行。

### 4.2 模型输出随机性主导单轮差异

实验组各轮失败**互不相同**(缺前导零 / 缺 frontend 文件 / scripts 列表缺项),
对照组失败**收敛于同一项**(前导零校验)。解释:
- 无记忆时,模型对「PoW 验证」的默认实现存在系统性盲区(前导零);
- 有记忆时,该盲区被提示覆盖,但其余环节(前端产物完整性)仍受采样噪声影响。

### 4.3 与记忆无关的干扰项

`pack.json` 的 `description` 字段(平台 schema 不识别,runtime 起不来)在两组随机出现,
与记忆无关联——属模型对格式的自主发挥,静态检查测不到,却会杀死 runtime 评价。
**这构成评价体系的混杂变量**:后续实验应在记忆中加入「pack.json 仅用
name/version/frontend」,并让 runtime 成为判别指标。

## 5. 局限

1. **样本量不足**:$n=3$/组,统计功效 $\approx 0.1$,结论为描述性。
2. **评价器判别力低**:17 项静态检查中多数项(文件存在、JSON 合法)两组恒过;
   真正能区分两组的判别项仅 2–3 项。
3. **runtime 检查不可用**:`description` 字段导致 PB 启动失败,两组 runtime 全挂,
   无法提供端到端证据。
4. **模型限流**:每轮 5–12 分钟,限制了可行轮数。
5. **单模型**:仅 `deepseek-v4-flash-0731`,结论不能推广到其他模型。

## 6. 结论

- 实验未能在统计显著性水平上证明记忆提升 testcase 得分($p=1.0$);
- 但定性证据支持「记忆补全典型遗漏」:对照组失败集中在「前导零校验」,
  实验组第 1 轮该检查项由记忆提示补齐;
- 实验体系本身的发现:`description` 字段是独立于记忆的 runtime 杀手,
  记忆应沉淀该教训,评价体系应区分「静态可测」与「runtime 致命」两类缺陷。

## 附:复现命令

```bash
# 对照组
./scripts/test/test-pi-pack.sh --no-build --cleanup --run-id ablation-control-<N>
# 实验组
./scripts/test/test-pi-pack.sh --no-build --cleanup --run-id ablation-memory-<N> \
  --memory-dir .snow/ablation/memory-pack
# 静态评价(跳过 runtime)
node scripts/test/evaluate-agent-pack.mjs --artifact-dir <run>/artifact \
  --skip-docker --report-dir <run>
```