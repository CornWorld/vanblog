export interface PluginDataStorage {
  get(key: string): Promise<unknown>;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface PluginConfigReader {
  get(key: string): unknown;
  get<T>(key: string, defaultValue: T): T;
  getOrThrow(key: string): unknown;
  has(key: string): boolean;
}

export interface PluginContext {
  readonly pluginId: string;
  readonly config: PluginConfigReader;
  readonly data: PluginDataStorage;
}

export interface PluginContextFactory {
  createContext(pluginId: string): PluginContext;
}
