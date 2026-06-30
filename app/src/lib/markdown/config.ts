import type { AstroMarkdownOptions } from "@astrojs/internal-helpers/markdown";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkContainer } from "./plugins/remark-container";
import { rehypeEnhance } from "./plugins/rehype-enhance";
import { rehypeCodeBlock } from "./plugins/rehype-code-block";

export const sharedMarkdownConfig: AstroMarkdownOptions = {
  syntaxHighlight: { type: "shiki", excludeLangs: ["mermaid"] },
  shikiConfig: {
    themes: { light: "github-light", dark: "github-dark" },
  },
  remarkPlugins: [remarkDirective, remarkMath, remarkContainer],
  rehypePlugins: [rehypeKatex, rehypeEnhance, rehypeCodeBlock],
};
