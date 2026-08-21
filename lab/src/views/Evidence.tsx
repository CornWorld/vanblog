import { createSignal } from "solid-js";
import { esc } from "../lib/format";

// ── evidence collapse (lazy load on open) ──
export function Evidence(props: {
  title: string;
  getter: () => Promise<string> | string;
}) {
  const [text, setText] = createSignal<string | null>(null);
  const [loaded, setLoaded] = createSignal(false);
  const load = async () => {
    if (loaded()) return;
    setLoaded(true);
    try {
      setText(await props.getter());
    } catch (e) {
      setText("(load failed: " + e + ")");
    }
  };
  return (
    <details class="collapse collapse-arrow bg-base-300 mt-2" onclick={load}>
      <summary class="collapse-title text-sm">{props.title}</summary>
      <div class="collapse-content">
        <pre class="text-xs overflow-auto max-h-80 whitespace-pre-wrap">
          {esc(text() ?? "(loading…)")}
        </pre>
      </div>
    </details>
  );
}