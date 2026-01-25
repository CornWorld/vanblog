/**
 * @file plugin-service-registry.service.ts
 *
 * 插件服务注册表
 *
 * 管理插件提供的服务，支持跨插件服务注入
 */

import { Injectable, Logger, Type } from '@nestjs/common';

// ============================================================
// 服务注册项
// ============================================================

interface ServiceEntry {
  pluginId: string;
  serviceClass: Type;
  instance: any;
  scope: 'singleton' | 'transient';
}

// ============================================================
// 插件服务注册表
// ============================================================

@Injectable()
export class PluginServiceRegistryService {
  private readonly logger = new Logger(PluginServiceRegistryService.name);

  /**
   * 服务注册表
   *
   * Key: `${pluginId}:${serviceName}`
   * Value: ServiceEntry
   */
  private readonly services = new Map<string, ServiceEntry>();

  /**
   * 注册服务
   *
   * @param pluginId - 插件 ID
   * @param serviceClass - 服务类
   * @param instance - 服务实例
   * @param scope - 作用域
   */
  registerService(
    pluginId: string,
    serviceClass: Type,
    instance: any,
    scope: 'singleton' | 'transient' = 'singleton',
  ): void {
    const key = this.makeKey(pluginId, serviceClass.name);

    if (this.services.has(key)) {
      this.logger.warn(`[${pluginId}] 服务 ${serviceClass.name} 已注册，将覆盖`);
    }

    this.services.set(key, {
      pluginId,
      serviceClass,
      instance,
      scope,
    });

    this.logger.log(`[${pluginId}] 注册服务: ${serviceClass.name} (${scope})`);
  }

  /**
   * 取消注册服务
   *
   * @param pluginId - 插件 ID
   * @param serviceClass - 服务类
   * @returns 是否成功取消注册
   */
  unregisterService(pluginId: string, serviceClass: Type): boolean {
    const key = this.makeKey(pluginId, serviceClass.name);
    const existed = this.services.delete(key);
    if (existed) {
      this.logger.debug(`[${pluginId}] 取消注册服务: ${serviceClass.name}`);
    }
    return existed;
  }

  /**
   * 获取服务
   *
   * @param pluginId - 插件 ID
   * @param serviceClass - 服务类
   * @returns 服务实例或 null
   */
  getService<T>(pluginId: string, serviceClass: Type<T>): T | null {
    const key = this.makeKey(pluginId, serviceClass.name);
    const entry = this.services.get(key);

    if (!entry) {
      return null;
    }

    // 如果是 transient 作用域，每次返回新实例
    if (entry.scope === 'transient') {
      try {
        return new entry.serviceClass();
      } catch (error) {
        this.logger.error(`[${pluginId}] 创建 transient 服务实例失败: ${serviceClass.name}`, error);
        return null;
      }
    }

    // singleton 作用域，返回缓存的实例
    return entry.instance;
  }

  /**
   * 检查服务是否存在
   *
   * @param pluginId - 插件 ID
   * @param serviceClass - 服务类
   * @returns 是否存在
   */
  hasService(pluginId: string, serviceClass: Type): boolean {
    const key = this.makeKey(pluginId, serviceClass.name);
    return this.services.has(key);
  }

  /**
   * 获取插件的所有服务
   *
   * @param pluginId - 插件 ID
   * @returns 服务类数组
   */
  getPluginServices(pluginId: string): Type[] {
    const services: Type[] = [];

    for (const [_key, entry] of this.services.entries()) {
      if (entry.pluginId === pluginId) {
        services.push(entry.serviceClass);
      }
    }

    return services;
  }

  /**
   * 清除插件的所有服务
   *
   * @param pluginId - 插件 ID
   */
  clearPluginServices(pluginId: string): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.services.entries()) {
      if (entry.pluginId === pluginId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.services.delete(key);
    }

    this.logger.log(`[${pluginId}] 清除了 ${keysToDelete.length} 个服务`);
  }

  /**
   * 清除所有服务（测试用）
   */
  clearAllServices(): void {
    this.services.clear();
    this.logger.warn('清除了所有插件服务');
  }

  /**
   * 生成服务键
   */
  private makeKey(pluginId: string, serviceName: string): string {
    return `${pluginId}:${serviceName}`;
  }

  /**
   * 获取所有注册的服务（调试用）
   */
  getAllServices(): Array<{ pluginId: string; serviceName: string; scope: string }> {
    const services: Array<{ pluginId: string; serviceName: string; scope: string }> = [];

    for (const entry of this.services.values()) {
      services.push({
        pluginId: entry.pluginId,
        serviceName: entry.serviceClass.name,
        scope: entry.scope,
      });
    }

    return services;
  }
}
