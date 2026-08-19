# @vanblog/lab — Agent Experiment Reports

agent 实验的 **report 落地页 + 历史溯源** UI。每个 run 即一份 report：结论先行，
再看配置、评测明细、指标、证据链（transcript / container.log / score / run）。

## 结构

```
lab/
├── package.json          # @vanblog/lab workspace
├── vite.config.ts        # Vite + solid 插件，dev 代理 /api → server
├── index.html
├── src/
│   ├── main.tsx          # 入口，daisyUI + Solid render
│   ├── App.tsx           # report 落地页（摘要/过滤/排序/列表/详情）
│   ├── api.ts            # 类型 + fetch 封装
│   └── styles.css
└── server/
    └── artifacts-server.mjs   # 零依赖只读 API server（读 .snow/artifacts）
```

## 启动

```bash
pnpm --filter @vanblog/lab dev
```

`dev` 用 concurrently 同时启动：
- **api**（9751）：`node server/artifacts-server.mjs` —— 只读 artifacts API
- **web**（9750）：Vite dev server —— 前端，`/api` 代理到 9751

浏览器打开 http://localhost:9750/

## 构建

```bash
pnpm --filter @vanblog/lab build   # 产物在 lab/dist/
pnpm --filter @vanblog/lab typecheck
```

## API（artifacts-server）

| 端点 | 说明 |
|------|------|
| `GET /api/runs` | run 摘要列表 |
| `GET /api/runs/:id` | 完整详情（run.json/score/metrics/transcript） |
| `GET /api/runs/:id/file?path=<rel>` | 原始文件（container.log 等） |

server 通过向上查找 `pnpm-workspace.yaml` 定位项目根，读取 `.snow/artifacts`，
无论从哪个 cwd 启动都能正确定位。
