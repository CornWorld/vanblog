import { Injectable, Logger } from '@nestjs/common';

/**
 * 插件公共数据提供者函数类型
 */
export type PublicDataProvider<T = unknown> = () => Promise<T> | T;

/**
 * 插件注册信息
 */
export interface PluginRegistration<T = unknown> {
  /** 插件名称 */
  name: string;
  /** 数据提供者函数 */
  provider: PublicDataProvider<T>;
  /** 优先级，数字越小优先级越高 */
  priority: number;
  /** 注册时间 */
  registeredAt: Date;
}

/**
 * 插件注册表服务
 *
 * 负责管理插件的公共数据提供者，实现插件数据的统一聚合
 * 遵循 Linus 的"好品味"原则：消除特殊情况，统一处理逻辑
 */
@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly registrations = new Map<string, PluginRegistration>();

  /**
   * 注册插件的公共数据提供者
   *
   * @param pluginName 插件名称
   * @param provider 数据提供者函数
   * @param priority 优先级，默认为 10
   */
  register<T = unknown>(pluginName: string, provider: PublicDataProvider<T>, priority = 10): void {
    if (pluginName === '' || typeof pluginName !== 'string') {
      throw new Error('Plugin name must be a non-empty string');
    }

    if (typeof provider !== 'function') {
      throw new Error('Provider must be a function');
    }

    if (this.registrations.has(pluginName)) {
      this.logger.warn(`Plugin '${pluginName}' is already registered, overwriting`);
    }

    this.registrations.set(pluginName, {
      name: pluginName,
      provider,
      priority,
      registeredAt: new Date(),
    });

    this.logger.debug(`Registered plugin '${pluginName}' with priority ${priority}`);
  }

  /**
   * 取消注册插件
   *
   * @param pluginName 插件名称
   * @returns 是否成功取消注册
   */
  unregister(pluginName: string): boolean {
    const existed = this.registrations.delete(pluginName);
    if (existed) {
      this.logger.debug(`Unregistered plugin '${pluginName}'`);
    }
    return existed;
  }

  /**
   * 检查插件是否已注册
   *
   * @param pluginName 插件名称
   * @returns 是否已注册
   */
  isRegistered(pluginName: string): boolean {
    return this.registrations.has(pluginName);
  }

  /**
   * 获取所有已注册的插件名称
   *
   * @returns 插件名称数组，按优先级排序
   */
  getRegisteredPlugins(): string[] {
    return Array.from(this.registrations.values())
      .sort((a, b) => a.priority - b.priority)
      .map((reg) => reg.name);
  }

  /**
   * 获取所有插件的公共数据
   *
   * 按优先级顺序执行所有插件的数据提供者，收集结果
   * 失败的插件会被跳过，不影响其他插件
   *
   * @returns 插件数据对象，键为插件名称，值为插件数据
   */
  async getAllPublicData(): Promise<Record<string, unknown>> {
    const sortedRegistrations = Array.from(this.registrations.values()).sort(
      (a, b) => a.priority - b.priority,
    );

    const results: Record<string, unknown> = {};

    // 并行执行所有插件的数据提供者
    const promises = sortedRegistrations.map(async (registration) => {
      try {
        const data = await registration.provider();
        return { name: registration.name, data };
      } catch (error) {
        this.logger.error(
          `Failed to get data from plugin '${registration.name}': ${error instanceof Error ? error.message : String(error)}`,
        );
        return { name: registration.name, data: null };
      }
    });

    const settledResults = await Promise.allSettled(promises);

    // 收集成功的结果
    settledResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.data !== null) {
        results[result.value.name] = result.value.data;
      }
    });

    this.logger.debug(
      `Collected data from ${Object.keys(results).length}/${sortedRegistrations.length} plugins`,
    );

    return results;
  }

  /**
   * 获取特定插件的公共数据
   *
   * @param pluginName 插件名称
   * @returns 插件数据，如果插件不存在或执行失败则返回 null
   */
  async getPluginData<T = unknown>(pluginName: string): Promise<T | null> {
    const registration = this.registrations.get(pluginName);
    if (!registration) {
      return null;
    }

    try {
      const data = await registration.provider();
      return data as T;
    } catch (error) {
      this.logger.error(
        `Failed to get data from plugin '${pluginName}': ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * 清除所有注册的插件
   */
  clear(): void {
    const count = this.registrations.size;
    this.registrations.clear();
    this.logger.debug(`Cleared ${count} plugin registrations`);
  }

  /**
   * 获取注册统计信息
   */
  getStats(): {
    totalRegistrations: number;
    registrationsByPriority: Record<number, number>;
  } {
    const registrations = Array.from(this.registrations.values());
    const priorityStats: Record<number, number> = {};

    registrations.forEach((reg) => {
      priorityStats[reg.priority] = (priorityStats[reg.priority] ?? 0) + 1;
    });

    return {
      totalRegistrations: registrations.length,
      registrationsByPriority: priorityStats,
    };
  }
}
