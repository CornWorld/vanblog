import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

import {
  HookService as IHookService,
  ActionCallback,
  FilterCallback,
  ActionRegistration,
  FilterRegistration,
} from '../interfaces/hook.interface';

@Injectable()
export class HookService implements IHookService {
  private readonly logger = new Logger(HookService.name);
  private readonly actions = new Map<string, ActionRegistration[]>();
  private readonly filters = new Map<string, FilterRegistration[]>();

  /**
   * Normalize hook name to a single canonical scheme.
   * - Module prefix is normalized to lowercase.
   * - Support both legacy 'module.event' and canonical 'module|event' separators (unified to '|').
   * - Event part supports legacy aliases and case styles:
   *   - before_create | before-create | beforeCreate  => beforeCreate
   *   - before_update | before-update | beforeUpdate  => beforeUpdate
   *   - before_delete | before-delete | beforeDelete  => beforeDelete
   *   - created  => afterCreate
   *   - updated  => afterUpdate
   *   - deleted  => afterDelete
   *   - password_changed | password-changed => afterPasswordChange
   *   - generated => afterGenerate
   *   - snake_case or kebab-case will be camelCased; unknown events keep their camel-cased form.
   *
   * Always returns the canonical form: `${module}|${event}`.
   */
  private normalizeHookName(hookName: string): string {
    // 支持两种分隔符：优先使用 '|', 其次兼容 '.'
    let sepIndex = hookName.indexOf('|');
    if (sepIndex <= 0 || sepIndex === hookName.length - 1) {
      const dotIndex = hookName.indexOf('.');
      if (dotIndex > 0 && dotIndex < hookName.length - 1) {
        sepIndex = dotIndex;
      }
    }

    const moduleRaw = sepIndex > 0 ? hookName.slice(0, sepIndex) : hookName;
    const eventRaw = sepIndex > 0 ? hookName.slice(sepIndex + 1) : '';

    const modulePart = moduleRaw.toLowerCase();
    const eventPart = eventRaw.trim();

    // Convert snake_case / kebab-case to camelCase (idempotent for camelCase)
    const toCamel = (s: string): string =>
      s.replace(/[-_]+([a-zA-Z0-9])/g, (_: string, c: string) => c.toUpperCase());

    let e = toCamel(eventPart);

    // Normalize well-known aliases to tenseless canonical forms
    if (e === 'beforeCreate' || e === 'beforecreate') e = 'beforeCreate';
    else if (e === 'beforeUpdate' || e === 'beforeupdate') e = 'beforeUpdate';
    else if (e === 'beforeDelete' || e === 'beforedelete') e = 'beforeDelete';
    // Past-tense and alias map to canonical afterXxx (tenseless base form)
    else if (e === 'afterCreate' || e === 'aftercreate' || e === 'created') e = 'afterCreate';
    else if (e === 'afterUpdate' || e === 'afterupdate' || e === 'updated') e = 'afterUpdate';
    else if (e === 'afterDelete' || e === 'afterdelete' || e === 'deleted') e = 'afterDelete';
    // Additional common events (media/comment/auth/etc.)
    else if (e === 'beforeUpload' || e === 'beforeupload') e = 'beforeUpload';
    else if (e === 'uploaded') e = 'afterUpload';
    else if (e === 'beforeDeleteBatch' || e === 'beforedeletebatch') e = 'beforeDeleteBatch';
    else if (e === 'deletedBatch') e = 'afterDeleteBatch';
    else if (e === 'beforeStart' || e === 'beforestart') e = 'beforeStart';
    else if (e === 'started') e = 'afterStart';
    else if (e === 'beforeStop' || e === 'beforestop') e = 'beforeStop';
    else if (e === 'stopped') e = 'afterStop';
    else if (e === 'passwordChanged' || e === 'passwordchanged') e = 'afterPasswordChange';
    // Normalize publish lifecycle
    else if (e === 'afterPublish' || e === 'afterpublish' || e === 'published') e = 'afterPublish';
    // bootstrap pipeline alias
    else if (e === 'generated') e = 'afterGenerate';

    return `${modulePart}|${e}`;
  }

  private validateHookName(hookName: string): void {
    // Be permissive: support both 'module|event' and legacy 'module.event'
    if (typeof hookName !== 'string') {
      throw new Error(
        `Invalid hook name '${String(hookName)}'. Expected format: module|event or module.event (e.g., article|afterCreate)`,
      );
    }

    const pipeIndex = hookName.indexOf('|');
    const dotIndex = hookName.indexOf('.');
    const hasPipe = pipeIndex > 0 && pipeIndex < hookName.length - 1;
    const hasDot = dotIndex > 0 && dotIndex < hookName.length - 1;

    if (!hasPipe && !hasDot) {
      throw new Error(
        `Invalid hook name '${hookName}'. Expected format: module|event or module.event (e.g., article|afterCreate)`,
      );
    }
  }

  addAction(hookName: string, callback: ActionCallback, priority = 10): string {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const id = randomUUID();
    const registration: ActionRegistration = {
      callback,
      priority,
      id,
    };

    if (!this.actions.has(normalized)) {
      this.actions.set(normalized, []);
    }

    const hooks = this.actions.get(normalized);
    if (hooks) {
      hooks.push(registration);
      hooks.sort((a, b) => a.priority - b.priority);
    }

    this.logger.debug(
      `Action added to hook '${normalized}' with priority ${String(priority)} and id ${id}`,
    );
    return id;
  }

  addFilter<T>(hookName: string, callback: FilterCallback<T>, priority = 10): string {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const id = randomUUID();
    const registration: FilterRegistration = {
      callback: callback as FilterCallback,
      priority,
      id,
    };

    if (!this.filters.has(normalized)) {
      this.filters.set(normalized, []);
    }

    const hooks = this.filters.get(normalized);
    if (hooks) {
      hooks.push(registration);
      hooks.sort((a, b) => a.priority - b.priority);
    }

    this.logger.debug(
      `Filter added to hook '${normalized}' with priority ${String(priority)} and id ${id}`,
    );
    return id;
  }

  removeAction(hookName: string, id: string): boolean {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const hooks = this.actions.get(normalized);
    if (!hooks) {
      return false;
    }

    const index = hooks.findIndex((hook) => hook.id === id);
    if (index === -1) {
      return false;
    }

    hooks.splice(index, 1);
    this.logger.debug(`Action removed from hook '${normalized}' with id ${id}`);
    return true;
  }

  removeFilter(hookName: string, id: string): boolean {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const hooks = this.filters.get(normalized);
    if (!hooks) {
      return false;
    }

    const index = hooks.findIndex((hook) => hook.id === id);
    if (index === -1) {
      return false;
    }

    hooks.splice(index, 1);
    this.logger.debug(`Filter removed from hook '${normalized}' with id ${id}`);
    return true;
  }

  async doAction(hookName: string, ...args: unknown[]): Promise<void> {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const hooks = this.actions.get(normalized);
    if (!hooks || hooks.length === 0) {
      this.logger.debug(`No actions registered for hook '${normalized}'`);
      return;
    }

    this.logger.debug(`Executing ${String(hooks.length)} actions for hook '${normalized}'`);

    for (const hook of hooks) {
      try {
        await hook.callback(...args);
      } catch (error) {
        this.logger.error(
          `Error executing action for hook '${normalized}' with id ${hook.id}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  async applyFilters<T>(hookName: string, value: T, ...args: unknown[]): Promise<T> {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const hooks = this.filters.get(normalized);
    if (!hooks || hooks.length === 0) {
      this.logger.debug(`No filters registered for hook '${normalized}'`);
      return value;
    }

    this.logger.debug(`Applying ${String(hooks.length)} filters for hook '${normalized}'`);

    let result: unknown = value;
    for (const hook of hooks) {
      try {
        const newResult = await hook.callback(result, ...args);
        result = newResult;
      } catch (error) {
        this.logger.error(
          `Error applying filter for hook '${normalized}' with id ${hook.id}:`,
          error instanceof Error ? error.message : String(error),
        );
        // Continue with current result value on error, don't update result
      }
    }

    return result as T;
  }

  hasAction(hookName: string): boolean {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const hooks = this.actions.get(normalized);
    return hooks !== undefined && hooks.length > 0;
  }

  hasFilter(hookName: string): boolean {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const hooks = this.filters.get(normalized);
    return hooks !== undefined && hooks.length > 0;
  }

  getActionCount(hookName: string): number {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const hooks = this.actions.get(normalized);
    return hooks?.length ?? 0;
  }

  getFilterCount(hookName: string): number {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    const hooks = this.filters.get(normalized);
    return hooks?.length ?? 0;
  }

  getAllActionHooks(): string[] {
    return Array.from(this.actions.keys());
  }

  getAllFilterHooks(): string[] {
    return Array.from(this.filters.keys());
  }

  clearAllHooks(): void {
    this.actions.clear();
    this.filters.clear();
    this.logger.debug('All hooks cleared');
  }

  /**
   * Clear all registered actions and filters
   */
  clearAll(): void {
    this.actions.clear();
    this.filters.clear();
    this.logger.debug('Cleared all registered actions and filters');
  }

  clearHook(hookName: string): void {
    this.validateHookName(hookName);
    const normalized = this.normalizeHookName(hookName);
    this.actions.delete(normalized);
    this.filters.delete(normalized);
    this.logger.debug(`Hook '${normalized}' cleared`);
  }
}
