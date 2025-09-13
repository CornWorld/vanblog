export type MaybePromise<T> = T | Promise<T>;

export interface HookCallback<T = unknown> {
  (...args: unknown[]): MaybePromise<T>;
}

export interface ActionCallback {
  (...args: unknown[]): MaybePromise<void>;
}

export interface FilterCallback<T = unknown> {
  (value: T, ...args: unknown[]): MaybePromise<T>;
}

export interface HookRegistration {
  callback: HookCallback;
  priority: number;
  id: string;
  sequence: number;
}

export interface ActionRegistration {
  callback: ActionCallback;
  priority: number;
  id: string;
  sequence: number;
}

export interface FilterRegistration<T = unknown> {
  callback: FilterCallback<T>;
  priority: number;
  id: string;
  sequence: number;
}

export interface HookService {
  addAction(hookName: string, callback: ActionCallback, priority?: number): string;
  addFilter<T>(hookName: string, callback: FilterCallback<T>, priority?: number): string;
  removeAction(hookName: string, id: string): boolean;
  removeFilter(hookName: string, id: string): boolean;
  doAction(hookName: string, ...args: unknown[]): Promise<void>;
  applyFilters<T>(hookName: string, value: T, ...args: unknown[]): Promise<T>;
  hasAction(hookName: string): boolean;
  hasFilter(hookName: string): boolean;
  getActionCount(hookName: string): number;
  getFilterCount(hookName: string): number;
}
