// docs/.site — Vanblog 用户文档站(Astro Starlight)。
// 内容由 setup.sh(prebuild 自动跑)从上级 docs/ 镜像到 src/content/docs/
//(SSOT:docs/ 是唯一来源,镜像是构建产物);sidebar 只列用户层,
// internal/、developer/ 可被正文链接路由到但不进导航。
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import rehypeMdLinks from './rehype-md-links.mjs';

export default defineConfig({
  site: 'https://docs.vanblog.corn.im',
  trailingSlash: 'always',
  markdown: {
    rehypePlugins: [rehypeMdLinks],
  },
  integrations: [
    starlight({
      title: 'Vanblog',
      description: '基于 PocketBase + Astro 的个人博客系统 —— 开箱即用、高性能、数据自我控制',
      defaultLocale: 'zh',
      sidebar: [
        {
          label: '上手',
          items: [
            { label: '文档首页', link: '/' },
            { label: '快速开始', link: '/guide/quickstart/' },
            { label: '功能使用', link: '/guide/features/' },
            { label: 'FAQ', link: '/faq/' },
          ],
        },
        {
          label: '部署与运维',
          items: [
            { label: '部署', link: '/reference/deployment/' },
            { label: '配置参考', link: '/reference/configuration/' },
            { label: '备份 / 恢复 / 迁移', link: '/reference/backup/' },
            { label: '备份与升级', link: '/guide/backup-upgrade/' },
            { label: '反代与安全', link: '/guide/reverse-proxy/' },
          ],
        },
        {
          label: '扩展',
          items: [
            { label: '主题参考', link: '/reference/themes/' },
            { label: 'Pack 参考', link: '/reference/packs/' },
            { label: 'Pack 使用', link: '/guide/packs/' },
            { label: 'Artalk 评论集成', link: '/guide/comments-artalk/' },
          ],
        },
        {
          label: '参考',
          items: [
            { label: '架构参考', link: '/reference/architecture/' },
            { label: 'API', link: '/reference/api/' },
          ],
        },
      ],
    }),
  ],
});
