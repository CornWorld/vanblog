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
  private nextSequence = 0;

  private validateAndNormalizeHookName(hookName: string): string {
    if (typeof hookName !== 'string' || hookName.trim().length === 0) {
      throw new Error(
        `Invalid hook name '${hookName}'. Expected format: module|event (e.g., article|afterCreate)`,
      );
    }

    const trimmed = hookName.trim();
    const pipeIndex = trimmed.indexOf('|');

    // Only accept pipe separator, no legacy dot support
    if (pipeIndex <= 0 || pipeIndex >= trimmed.length - 1) {
      throw new Error(
        `Invalid hook name '${hookName}'. Expected format: module|event (e.g., article|afterCreate)`,
      );
    }

    const [modulePart, eventPart] = trimmed.split('|', 2);

    // Validate module part
    if (!this.isValidModuleName(modulePart)) {
      throw new Error(
        `Invalid module name '${modulePart}' in hook '${hookName}'. Module names must be lowercase alphanumeric with optional hyphens (e.g., 'article', 'user-auth')`,
      );
    }

    // Validate event part
    if (!this.isValidEventName(eventPart)) {
      const suggestion = this.suggestEventName(eventPart);
      throw new Error(
        `Invalid event name '${eventPart}' in hook '${hookName}'. Event names must be camelCase (e.g., 'afterCreate', 'beforeUpdate').${suggestion ? ` Did you mean '${suggestion}'?` : ''}`,
      );
    }

    return `${modulePart.toLowerCase()}|${eventPart}`;
  }

  private isValidModuleName(name: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
  }

  private isValidEventName(name: string): boolean {
    return /^[a-z]+(?:[A-Z][a-z0-9]*)*$/.test(name);
  }

  private suggestEventName(name: string): string | null {
    const raw = name.trim();
    const parts = raw.split(/[_-]+/).filter(Boolean);
    if (parts.length > 1) {
      const lower = parts.map((p) => p.toLowerCase());
      const last = lower[lower.length - 1];
      const suffixMap = new Map<string, string>([
        ['created', 'Create'],
        ['updated', 'Update'],
        ['deleted', 'Delete'],
        ['changed', 'Change'],
        ['change', 'Change'],
      ]);
      const suffix = suffixMap.get(last);
      if (suffix !== undefined) {
        const base = lower.slice(0, -1);
        const pascalBase = base.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
        return `after${pascalBase}${suffix}`;
      }
      // Fallback: simple camelCase conversion
      return lower
        .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('');
    }
    return null;
  }

  addAction(hookName: string, callback: ActionCallback, priority = 10): string {
    const normalized = this.validateAndNormalizeHookName(hookName);
    const id = randomUUID();
    const registration: ActionRegistration = {
      callback,
      priority,
      id,
      sequence: this.nextSequence++,
    };

    if (!this.actions.has(normalized)) {
      this.actions.set(normalized, []);
    }

    const hooks = this.actions.get(normalized);
    if (hooks) {
      hooks.push(registration);
      hooks.sort((a, b) => {
        const pd = a.priority - b.priority;
        if (pd !== 0) return pd;
        return a.sequence - b.sequence;
      });
    }

    this.logger.debug(
      `Action added to hook '${normalized}' with priority ${String(priority)} and id ${id}`,
    );
    return id;
  }

  addFilter<T>(hookName: string, callback: FilterCallback<T>, priority = 10): string {
    const normalized = this.validateAndNormalizeHookName(hookName);
    const id = randomUUID();
    const registration: FilterRegistration = {
      callback: callback as FilterCallback,
      priority,
      id,
      sequence: this.nextSequence++,
    };

    if (!this.filters.has(normalized)) {
      this.filters.set(normalized, []);
    }

    const hooks = this.filters.get(normalized);
    if (hooks) {
      hooks.push(registration);
      hooks.sort((a, b) => {
        const pd = a.priority - b.priority;
        if (pd !== 0) return pd;
        return a.sequence - b.sequence;
      });
    }

    this.logger.debug(
      `Filter added to hook '${normalized}' with priority ${String(priority)} and id ${id}`,
    );
    return id;
  }

  removeAction(hookName: string, id: string): boolean {
    const normalized = this.validateAndNormalizeHookName(hookName);
    const hooks = this.actions.get(normalized);
    if (!hooks) return false;

    const index = hooks.findIndex((h) => h.id === id);
    if (index === -1) return false;

    hooks.splice(index, 1);
    this.logger.debug(`Action with id ${id} removed from hook '${normalized}'`);
    return true;
  }

  removeFilter(hookName: string, id: string): boolean {
    const normalized = this.validateAndNormalizeHookName(hookName);
    const hooks = this.filters.get(normalized);
    if (!hooks) return false;

    const index = hooks.findIndex((h) => h.id === id);
    if (index === -1) return false;

    hooks.splice(index, 1);
    this.logger.debug(`Filter with id ${id} removed from hook '${normalized}'`);
    return true;
  }

  async doAction(hookName: string, ...args: unknown[]): Promise<void> {
    const normalized = this.validateAndNormalizeHookName(hookName);
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
          error instanceof Error ? error.message : error,
        );
        // Continue execution even if one action fails
      }
    }
  }

  async applyFilters<T>(hookName: string, value: T, ...args: unknown[]): Promise<T> {
    const normalized = this.validateAndNormalizeHookName(hookName);
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
          error instanceof Error ? error.message : error,
        );
        // Continue with current result value on error, don't update result
      }
    }

    return result as T;
  }

  hasAction(hookName: string): boolean {
    const normalized = this.validateAndNormalizeHookName(hookName);
    const hooks = this.actions.get(normalized);
    return hooks !== undefined && hooks.length > 0;
  }

  hasFilter(hookName: string): boolean {
    const normalized = this.validateAndNormalizeHookName(hookName);
    const hooks = this.filters.get(normalized);
    return hooks !== undefined && hooks.length > 0;
  }

  getActionCount(hookName: string): number {
    const normalized = this.validateAndNormalizeHookName(hookName);
    const hooks = this.actions.get(normalized);
    return hooks?.length ?? 0;
  }

  getFilterCount(hookName: string): number {
    const normalized = this.validateAndNormalizeHookName(hookName);
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
    const normalized = this.validateAndNormalizeHookName(hookName);
    this.actions.delete(normalized);
    this.filters.delete(normalized);
    this.logger.debug(`Hook '${normalized}' cleared`);
  }
}
