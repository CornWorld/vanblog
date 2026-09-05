// 首页/分页页概览 mermaid 渲染（原版 bytemd Viewer 概览行为；导出工具栏仅文章页）。
// 由 index.astro / page/[p].astro 的 <script> 引入。
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
});
const codes = document.querySelectorAll('.post-viewer code.language-mermaid');
if (codes.length > 0) {
  codes.forEach((code) => {
    const wrapper = document.createElement('pre');
    wrapper.className = 'mermaid';
    wrapper.textContent = code.textContent;
    code.parentElement?.replaceWith(wrapper);
  });
  await mermaid.run();
}
