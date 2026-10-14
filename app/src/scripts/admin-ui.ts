// ============================================================
// Admin UI 原语 —— 后台通用交互 (toast / dialog)
// ------------------------------------------------------------
// 由 AdminLayout 通过 <script> installAdminUI() 安装到
// window.vanblogUI，供各 admin 页面脚本以
//   self.vanblogUI?.toast('已保存', 'success')
//   await self.vanblogUI?.confirmDialog({ message: '…' })
// 形式懒调用（页面脚本可能先于本模块执行，因此始终用 ?. 取用）。
// 取代原生 alert()/confirm()/prompt() 的阻塞式交互。
// 样式类走 Tailwind 工具类（global.css 已 @source 本目录）。
// ============================================================

export type ToastType = 'success' | 'error' | 'info';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（删除/恢复备份）→ 红色确认按钮。 */
  danger?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  label?: string;
  type?: 'text' | 'password';
  placeholder?: string;
  initial?: string;
  /** 返回错误文案表示校验失败（显示在输入框下）；返回 null 表示通过。 */
  validate?: (value: string) => string | null;
}

declare global {
  interface Window {
    vanblogUI?: {
      toast(message: string, type?: ToastType, ttl?: number): void;
      confirmDialog(options: ConfirmOptions): Promise<boolean>;
      promptDialog(options: PromptOptions): Promise<string | null>;
    };
  }
}

// ── helpers ──────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DIALOG_CLS =
  'w-[90vw] max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-2xl p-0 backdrop:bg-black/40';

// ── Toast ────────────────────────────────────────────────────

const TOAST_CLS: Record<ToastType, string> = {
  success: 'border-[var(--success)]/40 text-[var(--success)]',
  error: 'border-[var(--error)]/40 text-[var(--error)]',
  info: 'border-[var(--border)] text-[var(--text)]',
};

let toastBox: HTMLDivElement | null = null;

function toastContainer(): HTMLDivElement {
  if (toastBox) return toastBox;
  toastBox = document.createElement('div');
  toastBox.className = 'fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2';
  toastBox.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastBox);
  return toastBox;
}

/** 非阻塞右下角提示。ttl=0 表示常驻直到被替换/点击。 */
export function toast(message: string, type: ToastType = 'info', ttl = 3000): void {
  const el = document.createElement('div');
  el.className = `pointer-events-auto cursor-pointer rounded-lg border bg-[var(--surface)] px-4 py-2.5 text-sm shadow-lg ${TOAST_CLS[type]}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  el.addEventListener('click', () => el.remove());
  toastContainer().appendChild(el);
  if (ttl > 0) setTimeout(() => el.remove(), ttl);
}

// ── Dialogs（原生 <dialog>，Esc/点击遮罩 = 取消）─────────────

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  const dialog = document.createElement('dialog');
  dialog.className = DIALOG_CLS;
  dialog.innerHTML = `
    <form method="dialog" class="flex flex-col gap-3 p-5">
      ${opts.title ? `<h2 class="text-base font-semibold">${esc(opts.title)}</h2>` : ''}
      <p class="text-sm whitespace-pre-wrap text-[var(--text-muted)]">${esc(opts.message)}</p>
      <div class="mt-2 flex justify-end gap-2">
        <button value="cancel" class="btn">${esc(opts.cancelText ?? '取消')}</button>
        <button value="confirm" class="${opts.danger ? 'btn btn-danger' : 'btn btn-primary'}">${esc(opts.confirmText ?? '确定')}</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  const { promise, resolve } = Promise.withResolvers<boolean>();
  dialog.addEventListener('close', () => {
    dialog.remove();
    resolve(dialog.returnValue === 'confirm');
  });
  dialog.showModal();
  return promise;
}

export function promptDialog(opts: PromptOptions): Promise<string | null> {
  const dialog = document.createElement('dialog');
  dialog.className = DIALOG_CLS;
  dialog.innerHTML = `
    <form class="flex flex-col gap-3 p-5">
      ${opts.title ? `<h2 class="text-base font-semibold">${esc(opts.title)}</h2>` : ''}
      ${opts.message ? `<p class="text-sm whitespace-pre-wrap text-[var(--text-muted)]">${esc(opts.message)}</p>` : ''}
      <label class="flex flex-col gap-1 text-sm">
        ${opts.label ? `${esc(opts.label)}` : ''}
        <input name="value" type="${opts.type ?? 'text'}" class="px-2 py-1.5"
               placeholder="${esc(opts.placeholder ?? '')}" value="${esc(opts.initial ?? '')}" autofocus />
      </label>
      <p class="hidden text-xs text-[var(--error)]" data-err></p>
      <div class="mt-2 flex justify-end gap-2">
        <button type="button" data-cancel class="btn">${esc(opts.cancelText ?? '取消')}</button>
        <button type="submit" class="${opts.danger ? 'btn btn-danger' : 'btn btn-primary'}">${esc(opts.confirmText ?? '确定')}</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector('form')!;
  const input = form.querySelector('input[name="value"]') as HTMLInputElement;
  const err = form.querySelector('[data-err]') as HTMLParagraphElement;
  const { promise, resolve } = Promise.withResolvers<string | null>();
  const finish = (value: string | null) => {
    dialog.remove();
    resolve(value);
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalid = opts.validate?.(input.value) ?? null;
    if (invalid) {
      err.textContent = invalid;
      err.classList.remove('hidden');
      input.focus();
      return;
    }
    finish(input.value);
  });
  form.querySelector('[data-cancel]')?.addEventListener('click', () => finish(null));
  dialog.addEventListener('cancel', () => finish(null)); // Esc
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) finish(null);
  });
  dialog.showModal();
  return promise;
}

// ── Install ──────────────────────────────────────────────────

export function installAdminUI(): void {
  if (typeof window === 'undefined' || window.vanblogUI) return;
  window.vanblogUI = { toast, confirmDialog, promptDialog };
}
