/**
 * 主题级 Markdown DOM 对齐层:平台 remark/rehype 管线产物 → 上游 bytemd
 * 插件(customCodeBlock/Heading)的 DOM 形态。管线本身是平台锁定层
 * (app/src/lib/**),此处以字符串后处理达到同构 DOM,降低 compare 成本。
 *
 * - upstreamCodeBlocks:
 *   平台 pre.code-block-wrapper + .code-header(复制/换行按钮,内联样式)
 *   → 上游 pre > div.code-block-wrapper.relative > div.header-right.flex
 *     [span.language-tag(语言), div.code-copy-btn(空)] + code。
 *   语法高亮保持平台 shiki 内联色(--shiki-dark 暗色变量,比上游 hljs 更完整) —
 *   有意分叉,见 docs/developer/vendor-islands-design.md 对照表。
 * - upstreamHeadings: 标题补上游 class(markdown-heading cursor-pointer)与
 *   data-id(值同 id,上游 headingPlugin 语义)。
 */

export function upstreamCodeBlocks(html: string): string {
  let out = html.replace(
    /<pre class="code-block-wrapper"([^>]*)\sdata-language="([^"]*)"[^>]*>(?:<div class="code-header"[\s\S]*?<\/div>)?/g,
    (_m, attrs: string, lang: string) =>
      `<pre${attrs} data-language="${lang}"><div class="code-block-wrapper relative"><div class="header-right flex" style="color: #6f7177"><span class="language-tag mr-1" style="line-height: 21px">${lang}</span><div class="code-copy-btn"></div></div>`,
  );
  // 上游结构里 code 被包进 wrapper div:对应闭合补一个 </div>。
  out = out.replace(/<\/code><\/pre>/g, '</code></div></pre>');
  return out;
}

export function upstreamHeadings(html: string): string {
  return html.replace(
    /<(h[1-6])([^>]*\bid="([^"]+)"[^>]*)>/g,
    (_m, tag: string, attrs: string, id: string) =>
      `<${tag} class="markdown-heading cursor-pointer"${attrs} data-id="${id}">`,
  );
}
