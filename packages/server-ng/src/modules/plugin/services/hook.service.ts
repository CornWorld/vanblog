import { randomUUID } from 'crypto';

import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../../database';
import { codeSnippets } from '../../../database/schema';
import {
  HookService as IHookService,
  ActionCallback,
  FilterCallback,
  ActionRegistration,
  FilterRegistration,
} from '../interfaces/hook.interface';

import type { Database } from '../../../database/connection';

@Injectable()
export class HookService implements IHookService, OnModuleInit {
  private readonly logger = new Logger(HookService.name);
  private readonly actions = new Map<string, ActionRegistration[]>();
  private readonly filters = new Map<string, FilterRegistration[]>();

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async onModuleInit(): Promise<void> {
    await this.loadCodeSnippets();
  }

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

  /**
   * Clear all registered actions and filters
   */
  clearAll(): void {
    this.actions.clear();
    this.filters.clear();
    this.logger.debug('Cleared all registered actions and filters');
  }

  clearHook(hookName: string): void {
    this.actions.delete(hookName);
    this.filters.delete(hookName);
    this.logger.debug(`Hook '${hookName}' cleared`);
  }

  async loadCodeSnippets(): Promise<void> {
    try {
      const snippets = await this.db
        .select()
        .from(codeSnippets)
        .where(eq(codeSnippets.enabled, true));

      for (const snippet of snippets) {
        if (snippet.hookType === 'action') {
          this.addAction(
            snippet.hookName,
            this.createActionCallback(snippet.code, snippet.timeout),
            snippet.priority,
          );
        } else {
          // hookType is 'filter'
          this.addFilter(
            snippet.hookName,
            this.createFilterCallback(snippet.code, snippet.timeout),
            snippet.priority,
          );
        }
      }

      this.logger.log(`Loaded ${String(snippets.length)} code snippets`);
    } catch (error) {
      this.logger.error(
        'Failed to load code snippets:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async reloadCodeSnippets(): Promise<void> {
    this.clearAllHooks();
    await this.loadCodeSnippets();
  }

  private createActionCallback(code: string, timeout: number): ActionCallback {
    return async (...args: unknown[]) => {
      try {
        await this.executeCodeSnippet(code, timeout, undefined, args);
      } catch (error) {
        this.logger.error(
          'Error executing action code snippet:',
          error instanceof Error ? error.message : String(error),
        );
      }
    };
  }

  private createFilterCallback(code: string, timeout: number): FilterCallback {
    return async (value: unknown, ...args: unknown[]) => {
      try {
        const result = await this.executeCodeSnippet(code, timeout, value, args);
        return result !== undefined ? result : value;
      } catch (error) {
        this.logger.error(
          'Error executing filter code snippet:',
          error instanceof Error ? error.message : String(error),
        );
        return value;
      }
    };
  }

  private async executeCodeSnippet(
    code: string,
    timeout: number,
    data?: unknown,
    args: unknown[] = [],
  ): Promise<unknown> {
    const vm = await import('vm');

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Code snippet execution timed out after ${String(timeout)}ms`));
      }, timeout);

      try {
        const context = {
          data,
          args,
          console: {
            log: (...args: unknown[]) => {
              this.logger.debug('Code snippet log:', ...args);
            },
            error: (...args: unknown[]) => {
              this.logger.error('Code snippet error:', ...args);
            },
            warn: (...args: unknown[]) => {
              this.logger.warn('Code snippet warn:', ...args);
            },
          },
          setTimeout: (fn: () => void, delay: number) => {
            if (delay > timeout) {
              throw new Error('setTimeout delay cannot exceed snippet timeout');
            }
            return setTimeout(fn, delay);
          },
        };

        const vmContext = vm.createContext(context);

        const wrappedCode = `
          (function() {
            ${code}
          })()
        `;

        const result = vm.runInContext(wrappedCode, vmContext, {
          timeout,
          displayErrors: true,
        }) as unknown;

        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}
