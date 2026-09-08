// 首页/分页页概览 mermaid 渲染（原版 bytemd Viewer 概览行为；导出工具栏仅文章页）。
// 选择器对齐 PostCard 内容根（双层 .markdown-body，vendor 化后已无 .post-viewer）。
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
});
const codes = document.querySelectorAll('.markdown-body code.language-mermaid');
if (codes.length > 0) {
  codes.forEach((code) => {
    const wrapper = document.createElement('pre');
    wrapper.className = 'mermaid';
    wrapper.textContent = code.textContent;
    code.parentElement?.replaceWith(wrapper);
  });
  await mermaid.run();
}
