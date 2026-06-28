// bytemd emoji action backed by emoji-picker-element (Web Component, ~12.5KB).
//
// Why not emoji-mart (original vanblog): ~280KB bundle + React dependency.
// emoji-picker-element is vanilla and exposes a `<emoji-picker>` custom element
// with an `emoji-click` event whose `detail.unicode` is the native glyph to insert.
//
// Data strategy: emoji data (429KB raw / ~120KB gz) is served locally from
// /emoji-data.json (app/public/emoji-data.json). Caddy marks it
// `Cache-Control: public, max-age=31536000, immutable` so the browser caches it
// permanently after first load. No CDN dependency — works on intranet / offline
// (after first fetch).
//
// Interaction ported from upstream:
// refs/xxddccaa-fork/repo/packages/admin/src/components/Editor/emoji.tsx
// — keeps the editor selection, positions the panel under the toolbar button,
// closes on outside click.

import 'emoji-picker-element';
import type { BytemdPlugin } from 'bytemd';

const EMOJI_DATA_URL = '/emoji-data.json';

const EMOJI_ICON =
  '<svg data-vb-emoji-icon="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 1024 1024"><path d="M510.944 960c-247.04 0-448-200.96-448-448s200.992-448 448-448 448 200.96 448 448-200.96 448-448 448zm0-832c-211.744 0-384 172.256-384 384s172.256 384 384 384 384-172.256 384-384-172.256-384-384-384z"/><path d="M512 773.344c-89.184 0-171.904-40.32-226.912-110.624-10.88-13.92-8.448-34.016 5.472-44.896 13.888-10.912 34.016-8.48 44.928 5.472 42.784 54.688 107.136 86.048 176.512 86.048 70.112 0 134.88-31.904 177.664-87.552 10.784-14.016 30.848-16.672 44.864-5.888 14.016 10.784 16.672 30.88 5.888 44.864C685.408 732.32 602.144 773.344 512 773.344zM368 515.2c-26.528 0-48-21.472-48-48v-64c0-26.528 21.472-48 48-48s48 21.472 48 48v64c0 26.496-21.504 48-48 48zm288 0c-26.496 0-48-21.472-48-48v-64c0-26.528 21.504-48 48-48s48 21.472 48 48v64c0 26.496-21.504 48-48 48z"/></svg>';

interface BytemdActionCtx {
  root: HTMLElement;
  editor: {
    focus: () => void;
    replaceSelection: (text: string) => void;
    setSelection: (anchor: unknown, head: unknown) => void;
    listSelections?: () => Array<{ anchor: unknown; head: unknown }>;
  };
}

interface BytemdAction {
  position?: 'left' | 'right';
  title: string;
  icon: string;
  handler: {
    type: 'action';
    click: (ctx: BytemdActionCtx) => void;
  };
}

function createPanel(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'vb-emoji-container vb-emoji-hidden';

  const picker = document.createElement('emoji-picker');
  // Local data source — served from /emoji-data.json (app/public/).
  // Caddy marks it immutable + 1yr cache, so first load is the only network hit.
  picker.dataSource = EMOJI_DATA_URL;
  picker.locale = 'zh';

  wrapper.appendChild(picker);
  return wrapper;
}

function positionPanel(panel: HTMLElement, root: HTMLElement, button: HTMLElement) {
  const toolbar = root.querySelector('.bytemd-toolbar-left') as HTMLElement | null;
  if (!toolbar) return;

  const toolbarRect = toolbar.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  // emoji-picker-element default width is 352px; clamp into the toolbar.
  const panelWidth = panel.offsetWidth || 352;
  const left = Math.max(
    0,
    Math.min(buttonRect.left - toolbarRect.left, toolbar.clientWidth - panelWidth),
  );
  panel.style.left = `${left}px`;
}

export function emoji(): BytemdPlugin {
  let panel: HTMLElement | null = null;
  let activeButton: HTMLElement | null = null;
  let lastSelection: { anchor: unknown; head: unknown } | null = null;
  let removeDocClick: (() => void) | null = null;
  let lastInsert: { glyph: string; time: number } | null = null;

  const closePanel = () => {
    panel?.classList.add('vb-emoji-hidden');
    activeButton?.classList.remove('vb-emoji-button-active');
    activeButton = null;
    removeDocClick?.();
    removeDocClick = null;
  };

  const bindDocClick = () => {
    removeDocClick?.();
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && (panel?.contains(target) || activeButton?.contains(target))) return;
      closePanel();
    };
    document.addEventListener('click', handler);
    removeDocClick = () => document.removeEventListener('click', handler);
  };

  const insertGlyph = (glyph: string, editor: BytemdActionCtx['editor']) => {
    // Debounce duplicate native emoji-click events the picker sometimes emits.
    const now = Date.now();
    if (lastInsert?.glyph === glyph && now - lastInsert.time < 120) return;
    lastInsert = { glyph, time: now };

    if (lastSelection?.anchor && lastSelection?.head) {
      editor.setSelection(lastSelection.anchor, lastSelection.head);
    }
    editor.focus();
    editor.replaceSelection(glyph);
    lastSelection = editor.listSelections?.()?.[0] || null;
    closePanel();
  };

  return {
    editorEffect: (ctx: BytemdActionCtx) => {
      const container = ctx.root.querySelector('.bytemd-toolbar-left');
      const existing = ctx.root.querySelector('.vb-emoji-container') as HTMLElement | null;
      if (existing) {
        panel = existing;
        const picker = existing.querySelector('emoji-picker');
        picker?.addEventListener('emoji-click', (e: Event) => {
          const detail = (e as CustomEvent<{ unicode?: string }>).detail;
          if (detail?.unicode) insertGlyph(detail.unicode, ctx.editor);
        });
        return;
      }

      if (!container) return;
      const newPanel = createPanel();
      container.appendChild(newPanel);
      panel = newPanel;

      const picker = newPanel.querySelector('emoji-picker');
      picker?.addEventListener('emoji-click', (e: Event) => {
        const detail = (e as CustomEvent<{ unicode?: string }>).detail;
        if (detail?.unicode) insertGlyph(detail.unicode, ctx.editor);
      });
    },
    actions: [
      {
        title: '表情',
        icon: EMOJI_ICON,
        handler: {
          type: 'action',
          click: ({ root, editor }) => {
            lastSelection = editor.listSelections?.()?.[0] || null;
            const el = root.querySelector('.vb-emoji-container') as HTMLElement | null;
            if (!el) return;
            panel = el;

            if (el.classList.contains('vb-emoji-hidden')) {
              el.classList.remove('vb-emoji-hidden');
              // Locate the toolbar icon we just rendered (it carries the data attr from EMOJI_ICON).
              const button = root
                .querySelector('[data-vb-emoji-icon="true"]')
                ?.closest('.bytemd-toolbar-icon') as HTMLElement | null;
              if (button) {
                activeButton = button;
                activeButton.classList.add('vb-emoji-button-active');
                positionPanel(el, root, button);
              }
              // Defer binding so the click that opened the panel doesn't immediately close it.
              setTimeout(bindDocClick, 100);
            } else {
              closePanel();
            }
          },
        },
      } satisfies BytemdAction,
    ],
  };
}
