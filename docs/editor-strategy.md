# 编辑器方案:ByteMD

> **决策**:使用 ByteMD 作为 Admin 后台的文章编辑器,与原项目保持一致。

## 选型理由

1. **原项目生产验证** — 所有插件(emoji/图片上传/代码折叠)跑过好几年
2. **Markdown 无损** — 直接编辑 MD 源码,不经过 ProseMirror 双向转换
3. **Astro 集成简单** — vanilla JS API,`new Editor({ target })` 挂到 DOM
4. **插件可平移** — 原项目自定义插件代码可参考移植
5. **体积最小** — ~200KB

## ByteMD 核心能力

- **底层**:Svelte 编译为 vanilla JS + CodeMirror 5(源码)+ remark(预览)
- **模式**:split(分屏)/ tab(切换)/ auto(自动)
- **插件**:gfm / highlight / math(KaTeX)/ mermaid / medium-zoom / frontmatter

## Astro 集成方式

ByteMD 是框架无关的 vanilla JS 组件,在 Astro 中作为岛屿组件使用:

```astro
---
// admin/pages/editor.astro (SSR, prerender=false)
---
<div id="editor-container" client:only="bytemd"></div>
```

```javascript
// 岛屿组件内部
import { Editor } from 'bytemd'
import gfm from '@bytemd/plugin-gfm'

const editor = new Editor({
  target: document.getElementById('editor-container'),
  props: { value: '', plugins: [gfm()], mode: 'split' }
})

editor.$on('change', (e) => {
  editor.$set({ value: e.detail.value })
})
```

## 需要实现的插件

### 从原项目平移

| 插件 | 功能 | 来源 |
|---|---|---|
| imgUpload | 粘贴/拖拽图片 → 上传到 pb media collection | 原项目 `imgUpload.tsx` |
| emoji | emoji 选择器 | 原项目 `emoji.tsx` |
| insertMore | 插入 `<!-- more -->` 分割线 | 原项目 `insertMore.tsx` |
| customContainer | `:::tip` / `:::warning` 提示框 | 原项目 `customContainer.tsx` |

### pb 图片上传适配

原项目的 `uploadImages` 回调改为调用 pb API:

```javascript
uploadImages: async (files) => {
  const pb = Astro.locals.pb;  // 或 createBrowserClient()
  const results = await Promise.all(files.map(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('staticType', 'img');
    formData.append('storageType', 'local');
    const record = await pb.collection('media').create(formData);
    const url = pb.files.getRecordUrl(record, record.file);
    return { url, alt: file.name, title: file.name };
  }));
  return results;
}
```

## 排除的方案

| 方案 | 排除原因 |
|---|---|
| Milkdown Crepe | 双向转换格式损失;xxddccaa fork 回退过;体积 ~500KB |
| Tiptap | 不是开箱即用;Markdown 支持是扩展而非一等公民;需大量拼装 |
| Vditor | 体积 ~1MB;中文社区为主 |
| 纯 CodeMirror 6 | 无预览;用户需要分屏 |
