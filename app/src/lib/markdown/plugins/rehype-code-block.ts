import { visit } from "unist-util-visit";
import type { Root, Element, Text } from "hast";

/**
 * Rehype plugin: wraps <pre><code> with code-header (language + copy button).
 * Mermaid blocks are excluded.
 * Copy-button click handler is NOT included — bound client-side via viewerEffect.
 */
export function rehypeCodeBlock() {
  return (tree: Root) => {
    visit(tree, "element", (n: Element) => {
      if (n.tagName !== "pre") return;
      const code = n.children?.find(
        (c): c is Element => c.type === "element" && c.tagName === "code"
      );
      if (!code) return;
      const lang =
        ((code.properties?.className as string[] | undefined) ?? [])
          .find((c) => c?.startsWith?.("language-"))
          ?.replace("language-", "") || "";
      if (lang === "mermaid") return;

      const langSpan: Element = {
        type: "element",
        tagName: "span",
        properties: {},
        children: [{ type: "text", value: lang }],
      };
      const copySpan: Element = {
        type: "element",
        tagName: "span",
        properties: {
          class: "code-copy-btn",
          style: "cursor:pointer;margin-left:8px",
        },
        children: [{ type: "text", value: "复制" }],
      };
      const codeHeader: Element = {
        type: "element",
        tagName: "div",
        properties: {
          class: "code-header",
          style:
            "display:flex;justify-content:flex-end;padding:2px 8px;font-size:12px;color:#6f7177",
        },
        children: [langSpan, copySpan],
      };

      n.properties.class = "code-block-wrapper";
      n.children = [codeHeader, ...n.children];
    });
  };
}
