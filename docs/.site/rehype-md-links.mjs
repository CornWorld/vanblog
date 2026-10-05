// 把 markdown 正文里的 GitHub 风格相对 .md 链接改写为站内路由。
// 内容镜像自上级 docs/,作者按 GitHub 习惯写 `guide/quickstart.md` / `../reference/backup.md`;
// Starlight 不改写这类链接,直接输出会 404。
// 规则:
//   1. 解析目标在镜像内(含 internal/、developer/,它们不在侧边栏但可被链接)→ 根绝对路由
//   2. 目标在 docs/ 存在但未镜像(如 guide/demo.md)→ 回退 GitHub blob 链接
//   3. 其余(外链/锚点/非 .md)→ 原样保留
import { visit } from 'unist-util-visit';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep, dirname } from 'node:path';

const MIRROR_DIR = resolve('src/content/docs'); // astro build cwd = docs/.site
const DOCS_SRC = resolve('..'); // 上级 docs/
const GH_BLOB = 'https://github.com/CornWorld/vanblog/blob/main/docs';

function walkMd(dir, prefix, out) {
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const slug = prefix ? `${prefix}/${ent.name}` : ent.name;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkMd(p, slug, out);
    else if (ent.name.endsWith('.md')) out.add(slug.replace(/\.md$/, '').replace(/\/index$/, ''));
  }
  return out;
}

/** 当前页源文件所在目录的路由(GitHub 语义:相对链接以 md 文件所在目录解析)。
 *  例 guide/features.md → '/guide/';根 index.md → '/' */
function dirRouteOf(vfile) {
  if (!vfile.path) return '/';
  const dir = relative(MIRROR_DIR, dirname(vfile.path)).split(sep).join('/');
  return dir ? `/${dir}/` : '/';
}

export default function rehypeMdLinks() {
  return (tree, vfile) => {
    const slugs = walkMd(MIRROR_DIR, '', new Set());
    const baseRoute = dirRouteOf(vfile);
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return;
      const href = node.properties?.href;
      if (typeof href !== 'string' || !href.endsWith('.md')) return;
      const hash = href.includes('#') ? `#${href.split('#')[1]}` : '';
      const path = href.split('#')[0];
      // 按当前页路由解析目标(GitHub 语义 = 相对 docs/ 内文件位置)
      const target = new URL(path, `https://x.invalid${baseRoute}`).pathname
        .replace(/^\//, '')
        .replace(/\.md$/, '');
      if (slugs.has(target)) {
        node.properties.href = target ? `/${target}/${hash}` : `/${hash}`;
      } else if (existsSync(join(DOCS_SRC, `${target}.md`))) {
        node.properties.href = `${GH_BLOB}/${target}.md${hash}`;
      } else if (existsSync(join(DOCS_SRC, '..', `${target}.md`))) {
        // 逃出 docs/ 的仓库根文件(SECURITY.md、CONTRIBUTING.md 等)→ 仓库 blob 链接
        node.properties.href = `${GH_BLOB}/../${target}.md${hash}`;
      }
      // 其余:原样(外链或写错的相对路径)
    });
  };
}
