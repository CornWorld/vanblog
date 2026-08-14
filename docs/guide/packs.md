# Pack 使用（L2）

> 概念与格式见 [参考: Pack](../reference/packs.md)。

## 查看已安装的 Pack

```bash
./vanblog.sh pack list          # 内置 + 用户 Pack 一览
./vanblog.sh pack status        # 生命周期状态
./vanblog.sh pack inspect <name> # 单个 Pack 详情
```

## 启用 / 安装一个 Pack

内置 Pack（bookmarks / moments / visits / live2d-companion）随镜像提供，**后台或前端路由即用**（如收藏页 `/p/bookmarks`）。

要安装自定义 Pack：

```bash
# 把 Pack 目录/zip 放进持久卷后执行预检
./vanblog.sh pack plan
./vanblog.sh pack add <name>    # 添加本地覆盖
```

> 主题类 Pack（`themes/*`）用 `./vanblog.sh pack theme install <dir|zip>` 安装到持久卷。见 [主题](../reference/themes.md)。

## 常见问题

- **装了但没生效** → `./vanblog.sh pack status` 看生命周期；确认 `VANBLOG_PACKS_DIR` 卷挂载正确。
- **想自己写 Pack** → 参考内置 Pack 结构（`packs/*`）+ [developer/README.md](../developer/README.md)。
