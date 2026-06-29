import type { AstroMarkdownOptions } from "@astrojs/internal-helpers/markdown";
import remarkDirective from "remark-directive";
import { remarkContainer } from "./plugins/remark-container";
import { rehypeEnhance } from "./plugins/rehype-enhance";
import { rehypeCodeBlock } from "./plugins/rehype-code-block";

export const sharedMarkdownConfig: AstroMarkdownOptions = {
  syntaxHighlight: { type: "shiki", excludeLangs: ["mermaid"] },
  shikiConfig: {
    themes: { light: "github-light", dark: "github-dark" },
  },
  remarkPlugins: [remarkDirective, remarkContainer],
  rehypePlugins: [rehypeEnhance, rehypeCodeBlock],
};
