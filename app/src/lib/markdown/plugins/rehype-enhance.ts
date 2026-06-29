import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";

/**
 * Rehype plugin: adds data-id to h1-h6 headings, target="_blank" to links.
 */
export function rehypeEnhance() {
  return (tree: Root) => {
    visit(tree, "element", (n: Element) => {
      if (/^h[1-6]$/.test(n.tagName) && n.children?.[0]?.type === "text")
        n.properties["data-id"] = n.children[0].value;
      if (n.tagName === "a") {
        n.properties.target = "_blank";
        n.properties.rel = "noopener noreferrer";
      }
    });
  };
}
