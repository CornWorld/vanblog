# 消融实验:memory 对 testcase 的提升

> 实验时间:2026-09-03
> 任务:pi agent 生成 pow-guard pack(evaluate-agent-pack.mjs,Layer 1)
> 模型:deepseek/deepseek-v4-flash-0731(CLIProxyAPI),每轮独立容器 + 隔离(evaluator 不可见)

## 设计

- **对照组**:无记忆注入(`/pb_data/agent-memory` 不存在),prompt 含「若 agent-memory 存在则读」
- **实验组**:注入 `.snow/ablation/memory-pack/pack.md`(pack 领域经验,内容源自 docs 公开规范)
- 同 prompt、同模型、同评价器,唯一变量 = 记忆文件
- 每轮:pi 生成 pack → docker cp 归档 → evaluate-agent-pack.mjs 静态检查(17 项)

## 结果(静态检查 17 项)

| 轮 | 对照组(无记忆) | 实验组(有记忆) |
|---|---|---|
| 1 | 16/17 (94%) — 缺前导零校验 | **17/17 (100%)** |
| 2 | 16/17 (94%) — 缺前导零校验 | 12/15 (80%) — 缺前导零 + 无 frontend 文件 |
| 3 | 17/17 (100%) | 16/17 (94%) — frontend.scripts 缺 pow-guard.js |

## 失败模式分析

| 失败项 | 对照 1/2/3 | 实验 1/2/3 |
|---|---|---|
| hook-has-pow-validation(缺前导零校验) | ✗ ✗ ✓ | ✓ ✗ ✓ |
| frontend-file-exists(缺 frontend/pow-guard.js) | ✓ ✓ ✓ | ✓ ✗ ✓ |
| frontend-script-pow-guard-js(scripts 列表缺项) | ✓ ✓ ✓ | ✓ ✓ ✗ |
| pack.json description 字段(平台不认识,runtime 会挂) | ✓ ✓ ✗ | ✓ ✗ ✓ |

## 结论(诚实版)

1. **记忆不是稳定提升**:实验组第 1 轮全过(记忆要点 `"0".repeat(difficulty)` + `startsWith(prefix)` 逐条命中),但第 2、3 轮出现**不同**失败(缺 frontend 文件、scripts 列表缺项)——模型输出随机性占主导
2. **对照组的失败模式稳定**:2/3 轮缺「前导零校验」,这是 pi 无记忆时的典型遗漏
3. **记忆的有效性 = 提供「检查清单」,非「消除随机性」**:实验组失败模式分散(每次漏的点不同),对照组集中(固定漏前导零)——记忆让模型「知道要检查什么」,但无法保证每次都执行
4. **description 字段与记忆无关**:两组随机出现,是模型对 pack.json 格式的自主发挥

## 实验局限

- 样本量小(n=3/组),模型限流致每轮 5-12 分钟,统计显著性不足
- 静态检查 17 项对「记忆价值」敏感度低——多数项(文件存在、JSON 合法)两组都过,只有 2-3 项能区分
- runtime 检查因 pack.json description 字段导致 PB 起不来,两组都挂,无法用(<description 是平台 schema 问题,非记忆可解)

## 改进建议

- 断言「前导零校验」单指标(n=10+),更快更聚焦
- 记忆文件加「pack.json 只用 name/version/frontend,不要 description」——若实验组 runtime 全过而对照组全挂,是强信号
- 换变异性更低的模型(deepseek-v4-flash 输出随机性高)

## 产物

- `.snow/artifacts/ablation-control-{1,2,3}/` pi 产物 + score.json
- `.snow/artifacts/ablation-memory-{1,2,3}/` 同上
- `memory-pack/pack.md` 注入的记忆文件
- 各轮 static 检查报告在 `/tmp/static-c{1,2,3}.json` `/tmp/static-m{1,2,3}.json`