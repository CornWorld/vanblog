/**
 * 主题级 Markdown DOM 对齐层:平台 remark/rehype 管线产物 → 上游 bytemd
 * 插件(customCodeBlock/Heading/Container/Img)的 DOM 形态。管线本身是平台
 * 锁定层(app/src/lib/**),此处以字符串后处理达到同构 DOM,降低 compare 成本。
 *
 * 各替换对应上游插件语义:
 * - 代码块:平台 pre.code-block-wrapper + .code-header(复制/换行按钮,内联样式)
 *   → div.code-block-wrapper.relative > div.header-right.flex
 *     [span.language-tag(语言), div.code-copy-btn(空)] + pre > code。
 *   wrapper 外移到 pre 之外:HTML 解析禁止 <div> 入 <pre>——解析器在 div 处
 *   强制闭合 pre,尾部闭合补丁随之失衡,曾撕裂壳层布局(flex 行被提前闭合,
 *   侧栏逃逸、整页横向溢出);上游为 React DOM 创建不经 HTML 解析,其
 *   pre>div 形态在 SSR 侧不可复现,结构偏差登记于决策文档对照表。
 *   单遍整块替换,只命中带 code-block-wrapper 类的 pre;mermaid 等纯
 *   <pre><code> 原样放行(旧两遍式给 mermaid 补了孤儿 </div>,同因破版)。
 *   语法高亮保持平台 shiki 内联色(--shiki-dark 暗色变量,比上游 hljs 更完整) —
 *   有意分叉,见 docs/developer/vendor-islands-design.md 对照表。
 * - 容器标题:<p class="custom-container-title"> 补类型类;上游图标 ::before
 *   与配色依赖 custom-container-title.<type>。div 的 type 属性(用户标题文案)
 *   平台管线未保留且无 CSS/JS 消费,不补(登记)。
 * - 行内代码:裸 <code>(仅行内;代码块 code 均带 class)补上游 code-inline 类。
 *   upstream rehype-katex 的 math-inline/math-display 包裹无 CSS 依赖,不补(登记)。
 * - 标题:补上游 class(markdown-heading cursor-pointer)与 data-id
 *   (值同 id,上游 headingPlugin 语义)。
 */
export function upstreamDom(html: string): string {
  const codeBlocks = html.replace(
    /<pre class="code-block-wrapper"([^>]*)\sdata-language="([^"]*)"[^>]*>(?:<div class="code-header"[\s\S]*?<\/div>)?([\s\S]*?)<\/pre>/g,
    (_m, attrs: string, lang: string, body: string) =>
      `<div class="code-block-wrapper relative"><div class="header-right flex" style="color: #6f7177"><span class="language-tag mr-1" style="line-height: 21px">${lang}</span><div class="code-copy-btn"></div></div><pre${attrs} data-language="${lang}">${body}</pre></div>`,
  );
  const containers = codeBlocks.replace(
    /<div class="custom-container ([\w-]+)"([^>]*)><p class="custom-container-title">/g,
    (_m, type: string, rest: string) =>
      `<div class="custom-container ${type}"${rest}><p class="custom-container-title ${type}">`,
  );
  const inlineCode = containers.replace(/<code>/g, '<code class="code-inline">');
  return inlineCode.replace(
    /<(h[1-6])([^>]*\bid="([^"]+)"[^>]*)>/g,
    (_m, tag: string, attrs: string, id: string) =>
      `<${tag} class="markdown-heading cursor-pointer"${attrs} data-id="${id}">`,
  );
}
