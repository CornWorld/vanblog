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

  private validateAndNormalizeHookName(hookName: string): string {
    if (typeof hookName !== 'string' || hookName.trim().length === 0) {
      throw new Error(
        `Invalid hook name '${String(hookName)}'. Expected format: module|event (e.g., article|afterCreate)`,
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

  private isValidModuleName(module: string): boolean {
    // Module names: lowercase alphanumeric with optional hyphens
    return /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(module);
  }

  private isValidEventName(event: string): boolean {
    // Event names: strict camelCase starting with lowercase
    return /^[a-z][a-zA-Z0-9]*$/.test(event);
  }

  private suggestEventName(invalidEvent: string): string | null {
    const suggestions: Record<string, string> = {
      // snake_case suggestions
      after_create: 'afterCreate',
      before_create: 'beforeCreate',
      after_update: 'afterUpdate',
      before_update: 'beforeUpdate',
      after_delete: 'afterDelete',
      before_delete: 'beforeDelete',
      password_changed: 'afterPasswordChange',
      before_upload: 'beforeUpload',
      after_upload: 'afterUpload',
      before_login: 'beforeLogin',
      after_login: 'afterLogin',
      logged_in: 'afterLogin',
      validate_user_failed: 'validateUserFailed',
      validated_user: 'validatedUser',
      before_validate_user: 'beforeValidateUser',
      transform_response: 'transformResponse',
      // kebab-case suggestions
      'after-create': 'afterCreate',
      'before-create': 'beforeCreate',
      'after-update': 'afterUpdate',
      'before-update': 'beforeUpdate',
      'after-delete': 'afterDelete',
      'before-delete': 'beforeDelete',
      'password-changed': 'afterPasswordChange',
      'before-upload': 'beforeUpload',
      'after-upload': 'afterUpload',
      'before-login': 'beforeLogin',
      'after-login': 'afterLogin',
      // past tense suggestions
      created: 'afterCreate',
      updated: 'afterUpdate',
      deleted: 'afterDelete',
      uploaded: 'afterUpload',
      published: 'afterPublish',
      generated: 'afterGenerate',
      started: 'afterStart',
      stopped: 'afterStop',
    };

    return suggestions[invalidEvent.toLowerCase()];
  }

  addAction(hookName: string, callback: ActionCallback, priority = 10): string {
    const normalized = this.validateAndNormalizeHookName(hookName);
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
    const normalized = this.validateAndNormalizeHookName(hookName);
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
    const normalized = this.validateAndNormalizeHookName(hookName);
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
    const normalized = this.validateAndNormalizeHookName(hookName);
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
          error instanceof Error ? error.message : String(error),
        );
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
          error instanceof Error ? error.message : String(error),
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
