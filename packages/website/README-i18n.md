# VanBlog 国际化（i18n）说明

VanBlog 使用 next-i18next 进行国际化处理。本文档介绍了如何进一步完善国际化支持。

## 配置文件

国际化配置文件位于 `packages/website/next-i18next.config.js`:

```js
/** @type {import('next-i18next').UserConfig} */
module.exports = {
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh'],
  },
  defaultNS: 'translations',
  ns: ['translations'],
};
```

## 翻译文件结构

所有翻译文件位于 `packages/website/public/locales` 目录下，按语言代码进行组织。目前支持的语言是中文（zh）。

每种语言使用单一的 `translations.json` 文件，包含所有界面元素的翻译。这种方式比使用多个命名空间文件更加集中和易于管理。

## 翻译文件

中文翻译文件位于 `packages/website/public/locales/zh/translations.json`，包含以下主要部分：

- `site`: 网站通用文本
- `nav`: 导航菜单相关文本
- `post`: 文章卡片和内容相关文本
- `alert`: 警告提示文本
- `theme`: 主题模式相关文本
- `footer`: 页脚相关文本
- `stats`: 统计数据相关文本
- `time`: 时间单位相关文本
- `pages`: 特定页面相关文本（包含 home、timeline、about、tags、link、category 等）
- `meta`: 元数据相关文本
- `donate`: 捐赠相关文本
- `console`: 控制台日志文本
- `toc`: 目录相关文本
- `image`: 图片相关文本
- `comment`: 评论相关文本
- `search`: 搜索相关文本
- `copyright`: 版权相关文本
- `reward`: 打赏相关文本
- `unlock`: 文章解锁相关文本

## 如何使用翻译

在组件中使用翻译时，首先需要导入 `useTranslation` hook：

```tsx
import { useTranslation } from 'next-i18next';

export default function YourComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('some.translation.key')}</h1>
    </div>
  );
}
```

对于带参数的翻译，可以这样使用：

```tsx
{
  t('pages.timeline.stats', {
    categories: 10,
    posts: 50,
    tags: 20,
    words: 10000,
  });
}
```

## 页面中启用国际化

在页面组件中，需要使用 `serverSideTranslations` 来支持服务端渲染。由于我们已经设置了默认命名空间为 'translations'，所以不需要显式指定命名空间：

```tsx
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getPageProps()),
      ...(await serverSideTranslations(locale)),
    },
  };
}
```

## 添加新语言支持

要添加新的语言支持，需要：

1. 在 `next-i18next.config.js` 中的 `locales` 数组中添加新的语言代码
2. 在 `public/locales` 目录下创建对应语言代码的文件夹
3. 在新创建的文件夹中添加 `translations.json` 文件，包含所有翻译项

## 已国际化的组件

以下组件已经完成国际化：

- Layout
- Footer
- NavBar
- NavBarMobile
- PostCard (包括 Title, SubTitle, Bottom)
- AdminButton
- RssButton
- ThemeButton
- RunningTime
- Viewer
- AlertCard
- SearchCard
- UnLockCard
- MarkdownTocBar

## 翻译文件键值结构

```json
{
  "site": { ... },
  "nav": { ... },
  "post": { ... },
  "alert": { ... },
  "theme": { ... },
  "footer": { ... },
  "stats": { ... },
  "time": { ... },
  "pages": {
    "home": { ... },
    "timeline": { ... },
    "about": { ... },
    "tags": { ... },
    "link": { ... },
    "category": { ... }
  },
  "meta": { ... },
  "donate": { ... },
  "console": { ... },
  "toc": { ... },
  "image": { ... },
  "comment": { ... },
  "search": { ... },
  "copyright": { ... },
  "reward": { ... },
  "unlock": { ... }
}
```
