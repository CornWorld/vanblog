import { Injectable, Logger } from '@nestjs/common';
import {
  HookService as IHookService,
  ActionCallback,
  FilterCallback,
  ActionRegistration,
  FilterRegistration,
} from '../interfaces/hook.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class HookService implements IHookService {
  private readonly logger = new Logger(HookService.name);
  private readonly actions = new Map<string, ActionRegistration[]>();
  private readonly filters = new Map<string, FilterRegistration[]>();

  addAction(hookName: string, callback: ActionCallback, priority = 10): string {
    const id = randomUUID();
    const registration: ActionRegistration = {
      callback,
      priority,
      id,
    };

    if (!this.actions.has(hookName)) {
      this.actions.set(hookName, []);
    }

    const hooks = this.actions.get(hookName);
    if (hooks) {
      hooks.push(registration);
      hooks.sort((a, b) => a.priority - b.priority);
    }

    this.logger.debug(
      `Action added to hook '${hookName}' with priority ${String(priority)} and id ${id}`,
    );
    return id;
  }

  addFilter<T>(hookName: string, callback: FilterCallback<T>, priority = 10): string {
    const id = randomUUID();
    const registration: FilterRegistration = {
      callback: callback as FilterCallback,
      priority,
      id,
    };

    if (!this.filters.has(hookName)) {
      this.filters.set(hookName, []);
    }

    const hooks = this.filters.get(hookName);
    if (hooks) {
      hooks.push(registration);
      hooks.sort((a, b) => a.priority - b.priority);
    }

    this.logger.debug(
      `Filter added to hook '${hookName}' with priority ${String(priority)} and id ${id}`,
    );
    return id;
  }

  removeAction(hookName: string, id: string): boolean {
    const hooks = this.actions.get(hookName);
    if (!hooks) {
      return false;
    }

    const index = hooks.findIndex((hook) => hook.id === id);
    if (index === -1) {
      return false;
    }

    hooks.splice(index, 1);
    this.logger.debug(`Action removed from hook '${hookName}' with id ${id}`);
    return true;
  }

  removeFilter(hookName: string, id: string): boolean {
    const hooks = this.filters.get(hookName);
    if (!hooks) {
      return false;
    }

    const index = hooks.findIndex((hook) => hook.id === id);
    if (index === -1) {
      return false;
    }

    hooks.splice(index, 1);
    this.logger.debug(`Filter removed from hook '${hookName}' with id ${id}`);
    return true;
  }

  async doAction(hookName: string, ...args: unknown[]): Promise<void> {
    const hooks = this.actions.get(hookName);
    if (!hooks || hooks.length === 0) {
      this.logger.debug(`No actions registered for hook '${hookName}'`);
      return;
    }

    this.logger.debug(`Executing ${String(hooks.length)} actions for hook '${hookName}'`);

    for (const hook of hooks) {
      try {
        await hook.callback(...args);
      } catch (error) {
        this.logger.error(
          `Error executing action for hook '${hookName}' with id ${hook.id}:`,
          error,
        );
      }
    }
  }

  async applyFilters<T>(hookName: string, value: T, ...args: unknown[]): Promise<T> {
    const hooks = this.filters.get(hookName);
    if (!hooks || hooks.length === 0) {
      this.logger.debug(`No filters registered for hook '${hookName}'`);
      return value;
    }

    this.logger.debug(`Applying ${String(hooks.length)} filters for hook '${hookName}'`);

    let result: unknown = value;
    for (const hook of hooks) {
      try {
        result = await hook.callback(result, ...args);
      } catch (error) {
        this.logger.error(
          `Error applying filter for hook '${hookName}' with id ${hook.id}:`,
          error,
        );
      }
    }

    return result as T;
  }

  hasAction(hookName: string): boolean {
    const hooks = this.actions.get(hookName);
    return hooks !== undefined && hooks.length > 0;
  }

  hasFilter(hookName: string): boolean {
    const hooks = this.filters.get(hookName);
    return hooks !== undefined && hooks.length > 0;
  }

  getActionCount(hookName: string): number {
    const hooks = this.actions.get(hookName);
    return hooks?.length ?? 0;
  }

  getFilterCount(hookName: string): number {
    const hooks = this.filters.get(hookName);
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

  clearHook(hookName: string): void {
    this.actions.delete(hookName);
    this.filters.delete(hookName);
    this.logger.debug(`Hook '${hookName}' cleared`);
  }
}
