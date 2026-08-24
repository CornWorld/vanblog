import { createSignal } from "solid-js";
import { esc } from "../lib/format";

// ── evidence collapse (lazy load on open) ──
export function Evidence(props: {
  title: string;
  getter: () => Promise<string> | string;
}) {
  const [text, setText] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const load = async () => {
    if (status() === "loading" || status() === "success") return;
    setStatus("loading");
    try {
      setText(await props.getter());
      setStatus("success");
    } catch (e) {
      setText(null);
      setStatus("error");
    }
  };
  return (
    <details
      class="collapse collapse-arrow bg-base-300 mt-2"
      ontoggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) void load();
      }}
    >
      <summary class="collapse-title text-sm">{props.title}</summary>
      <div class="collapse-content">
        {status() === "error" ? (
          <div class="text-sm text-error">
            <p>加载失败</p>
            <button
              class="btn btn-xs btn-ghost mt-2"
              onclick={() => void load()}
            >
              重试
            </button>
          </div>
        ) : (
          <pre class="text-xs overflow-auto max-h-80 whitespace-pre-wrap">
            {status() === "idle"
              ? "打开后加载"
              : status() === "loading"
              ? "加载中…"
              : esc(text() ?? "")}
          </pre>
        )}
      </div>
    </details>
  );
}
