#!/usr/bin/env bash
# docs/.site 内容挂载:把上级 docs/ 用户层镜像到 src/content/docs/。
# 为什么是镜像而不是直连:Starlight 0.36 的 docsLoader 只支持固定的
# src/content/docs 布局(自定义目录/符号链接均不受支持,见其 utils/collection.ts 注释)。
# SSOT 原则不变:docs/ 是唯一来源,此镜像是构建产物(prebuild 幂等重建,gitignore)。
# internal/ 与 developer/ 一并镜像:它们不进侧边栏,但用户页正文链接指向它们
# (如 reference/architecture.md → ../internal/architecture-layering.md),需要可路由。
set -euo pipefail
cd "$(dirname "$0")"

SRC=..
DEST=src/content/docs

rm -rf "$DEST"
mkdir -p "$DEST"

# Starlight 用 frontmatter title 渲染页标题;剥掉正文首行 H1 避免重复
awk 'BEGIN{skip=1} skip && /^# / {skip=0; next} {print}' "$SRC/README.md" > "$DEST/index.md"
cp "$SRC/faq.md"     "$DEST/faq.md"
rsync -a "$SRC/guide/"     "$DEST/guide/"     --exclude=demo.md # demo 站维护手册,非用户文档
rsync -a "$SRC/reference/" "$DEST/reference/"
rsync -a "$SRC/internal/"  "$DEST/internal/"
rsync -a "$SRC/developer/" "$DEST/developer/"

# internal/、developer/ 的文档没有 Starlight frontmatter(docsSchema 需要 title);
# 构建期注入:取首个 H1 当 title,原文件不动。
while IFS= read -r f; do
  if [ "$(head -n 1 "$f")" != "---" ]; then
    title=$(grep -m1 '^# ' "$f" | sed 's/^# //' | tr -d '\r')
    printf -- '---\ntitle: %s\n---\n\n' "$title" | cat - "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
done < <(find "$DEST/internal" "$DEST/developer" -name '*.md')

echo "docs/.site content mirrored: $(find "$DEST" -name '*.md' | wc -l | tr -d ' ') pages"
