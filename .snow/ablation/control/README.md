# Ablation: control group

对照组 = 无记忆注入。`--memory-dir` 不传,容器 `/pb_data/agent-memory` 为空。

指标:score.json 的 passed/total/pct/status + 失败模式(failed 列表)。