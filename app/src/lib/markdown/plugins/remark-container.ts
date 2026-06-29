import { visit } from "unist-util-visit";
import type { Root } from "mdast";

/**
 * Remark plugin: transforms :::tip / :::warning / :::info / :::danger
 * container directives into div containers.
 * REQUIRES remark-directive loaded BEFORE this plugin.
 */
export function remarkContainer() {
  const titles: Record<string, string> = {
    note: "注",
    info: "相关信息",
    warning: "注意",
    danger: "警告",
    tip: "提示",
  };
  return (tree: Root) => {
    visit(tree, (n: unknown) => {
      const node = n as {
        type: string;
        name?: string;
        attributes?: Record<string, unknown>;
        data?: Record<string, unknown>;
        children?: unknown[];
      };
      if (node.type !== "containerDirective") return;
      const title =
        (node.attributes?.title as string) ||
        titles[node.name ?? ""] ||
        node.name ||
        "";
      node.data = node.data || {};
      (node.data as any).hName = "div";
      (node.data as any).hProperties = {
        class: "custom-container " + (node.name || ""),
      };
      (node.children ??= [] as unknown[]).unshift({
        type: "paragraph",
        data: { hProperties: { class: "custom-container-title" } },
        children: [{ type: "text", value: title }],
      });
    });
  };
}
