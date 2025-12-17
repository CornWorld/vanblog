/**
 * @file signal.service.ts
 *
 * SignalBus 服务 - VanBlog 插件系统 Signal 机制实现
 *
 * ## 概述
 *
 * SignalBus 是 VanBlog 插件系统的核心通信机制，提供类型安全的事件发布/订阅功能。
 * 相比传统的 Hook 系统，Signal 机制提供：
 * - 代码对象引用（IDE 跳转、自动补全）
 * - TypeScript 类型推导
 * - 运行时 Zod 校验（安全兜底）
 *
 * ## API 设计
 *
 * | 方法 | 用途 | 返回 |
 * |------|------|------|
 * | `connect()` | 连接同步 Signal，可修改数据 | 断开连接函数 |
 * | `subscribe()` | 订阅异步 Signal，仅接收通知 | 取消订阅函数 |
 * | `send()` | 发送同步 Signal，等待数据修改 | 修改后的数据 |
 * | `emit()` | 发送异步 Signal，不等待响应 | void |
 */

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import type {
  SyncSignal,
  AsyncSignal,
  SyncReceiver,
  AsyncReceiver,
  SignalContext,
  ISignalBus,
} from '@vanblog/shared/signals';

interface ReceiverEntry<T> {
  receiver: T;
  priority: number;
  id: string;
  sequence: number;
}

@Injectable()
export class SignalBus implements ISignalBus {
  private readonly logger = new Logger(SignalBus.name);

  /** 同步 Signal receivers */
  private readonly syncReceivers = new Map<string, ReceiverEntry<SyncReceiver<unknown>>[]>();

  /** 异步 Signal receivers */
  private readonly asyncReceivers = new Map<string, ReceiverEntry<AsyncReceiver<unknown>>[]>();

  /** 序列号（保证相同优先级的注册顺序） */
  private nextSequence = 0;

  // ============================================================
  // 注册方法
  // ============================================================

  /**
   * 连接同步 Signal
   *
   * @param signal - Signal 定义（来自 @vanblog/shared/signals）
   * @param receiver - 处理函数，必须返回与输入相同类型的数据
   * @param priority - 优先级（数字越小越先执行，默认 10）
   * @returns 断开连接的函数
   *
   * @example
   * ```typescript
   * import { signals } from '@vanblog/shared/signals';
   *
   * const disconnect = signalBus.connect(
   *   signals.article.beforeCreate,
   *   (article, ctx) => ({
   *     ...article,
   *     title: article.title + '喵',
   *   }),
   *   10,
   * );
   *
   * // 稍后断开连接
   * disconnect();
   * ```
   */
  connect<T extends z.ZodType>(
    signal: SyncSignal<T>,
    receiver: SyncReceiver<z.infer<T>>,
    priority = 10,
  ): () => void {
    const id = crypto.randomUUID();
    const entry: ReceiverEntry<SyncReceiver<unknown>> = {
      receiver: receiver as SyncReceiver<unknown>,
      priority,
      id,
      sequence: this.nextSequence++,
    };

    const receivers = this.syncReceivers.get(signal.id) ?? [];
    receivers.push(entry);
    this.sortReceivers(receivers);
    this.syncReceivers.set(signal.id, receivers);

    this.logger.debug(`[${signal.id}] Sync receiver connected (priority: ${priority}, id: ${id})`);

    // 返回断开连接函数
    return () => {
      const idx = receivers.findIndex((r) => r.id === id);
      if (idx !== -1) {
        receivers.splice(idx, 1);
        this.logger.debug(`[${signal.id}] Sync receiver disconnected (id: ${id})`);
      }
    };
  }

  /**
   * 订阅异步 Signal
   *
   * @param signal - Signal 定义
   * @param receiver - 处理函数，不返回值（副作用）
   * @param priority - 优先级（数字越小越先执行，默认 10）
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * import { signals } from '@vanblog/shared/signals';
   *
   * const unsubscribe = signalBus.subscribe(
   *   signals.article.afterCreate,
   *   (article, ctx) => {
   *     console.log(`Article created: ${article.title}`);
   *   },
   * );
   *
   * // 稍后取消订阅
   * unsubscribe();
   * ```
   */
  subscribe<T extends z.ZodType>(
    signal: AsyncSignal<T>,
    receiver: AsyncReceiver<z.infer<T>>,
    priority = 10,
  ): () => void {
    const id = crypto.randomUUID();
    const entry: ReceiverEntry<AsyncReceiver<unknown>> = {
      receiver: receiver as AsyncReceiver<unknown>,
      priority,
      id,
      sequence: this.nextSequence++,
    };

    const receivers = this.asyncReceivers.get(signal.id) ?? [];
    receivers.push(entry);
    this.sortReceivers(receivers);
    this.asyncReceivers.set(signal.id, receivers);

    this.logger.debug(
      `[${signal.id}] Async receiver subscribed (priority: ${priority}, id: ${id})`,
    );

    // 返回取消订阅函数
    return () => {
      const idx = receivers.findIndex((r) => r.id === id);
      if (idx !== -1) {
        receivers.splice(idx, 1);
        this.logger.debug(`[${signal.id}] Async receiver unsubscribed (id: ${id})`);
      }
    };
  }

  // ============================================================
  // 发送方法
  // ============================================================

  /**
   * 发送同步 Signal
   *
   * 按优先级顺序调用所有 receivers，每个 receiver 可以修改数据。
   * 包含运行时 Zod 校验，确保插件返回的数据符合 Schema。
   *
   * @param signal - Signal 定义
   * @param data - 输入数据
   * @param context - 上下文信息（可选）
   * @returns 经过所有 receivers 处理后的数据
   *
   * @example
   * ```typescript
   * import { signals } from '@vanblog/shared/signals';
   *
   * const filteredData = await signalBus.send(
   *   signals.article.beforeCreate,
   *   articleData,
   *   { pluginId: 'my-plugin' },
   * );
   * ```
   */
  async send<T extends z.ZodType>(
    signal: SyncSignal<T>,
    data: z.infer<T>,
    context?: SignalContext,
  ): Promise<z.infer<T>> {
    const receivers = this.syncReceivers.get(signal.id) ?? [];

    if (receivers.length === 0) {
      this.logger.debug(`[${signal.id}] No sync receivers, returning original data`);
      return data;
    }

    this.logger.debug(`[${signal.id}] Sending to ${receivers.length} sync receivers`);

    let result = data;
    const ctx = context ?? {};

    for (const { receiver, id } of receivers) {
      try {
        // 输入校验
        const inputParsed = signal.schema.safeParse(result);
        if (!inputParsed.success) {
          this.logger.error(
            `[${signal.id}] Input validation failed for receiver ${id}:`,
            inputParsed.error.format(),
          );
          continue; // 跳过此 receiver，保持当前结果
        }

        // 调用 receiver
        const output = await receiver(inputParsed.data, ctx);

        // 输出校验
        const outputParsed = signal.schema.safeParse(output);
        if (!outputParsed.success) {
          this.logger.error(
            `[${signal.id}] Output validation failed for receiver ${id}:`,
            outputParsed.error.format(),
          );
          continue; // 校验失败，保持当前结果
        }

        result = outputParsed.data;
      } catch (err) {
        this.logger.error(
          `[${signal.id}] Receiver ${id} error:`,
          err instanceof Error ? err.message : String(err),
        );
        // 发生错误，保持当前结果，继续处理下一个 receiver
      }
    }

    return result;
  }

  /**
   * 发送异步 Signal
   *
   * 并行调用所有 receivers（不阻塞主流程）。
   * 包含运行时 Zod 校验，确保传递给插件的数据符合 Schema。
   *
   * @param signal - Signal 定义
   * @param data - 输入数据
   * @param context - 上下文信息（可选）
   *
   * @example
   * ```typescript
   * import { signals } from '@vanblog/shared/signals';
   *
   * await signalBus.emit(
   *   signals.article.afterCreate,
   *   savedArticle,
   *   { pluginId: 'my-plugin' },
   * );
   * ```
   */
  async emit<T extends z.ZodType>(
    signal: AsyncSignal<T>,
    data: z.infer<T>,
    context?: SignalContext,
  ): Promise<void> {
    const receivers = this.asyncReceivers.get(signal.id) ?? [];

    if (receivers.length === 0) {
      this.logger.debug(`[${signal.id}] No async receivers`);
      return;
    }

    this.logger.debug(`[${signal.id}] Emitting to ${receivers.length} async receivers`);

    const ctx = context ?? {};

    // 并行执行所有 receivers
    const results = await Promise.allSettled(
      receivers.map(async ({ receiver, id }) => {
        try {
          // 输入校验
          const parsed = signal.schema.safeParse(data);
          if (!parsed.success) {
            this.logger.error(
              `[${signal.id}] Validation failed for receiver ${id}:`,
              parsed.error.format(),
            );
            return;
          }

          await receiver(parsed.data, ctx);
        } catch (err) {
          this.logger.error(
            `[${signal.id}] Receiver ${id} error:`,
            err instanceof Error ? err.message : String(err),
          );
          throw err; // 重新抛出以便 Promise.allSettled 记录
        }
      }),
    );

    // 记录失败的 receivers
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(`[${signal.id}] ${failed.length}/${receivers.length} receivers failed`);
    }
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 按优先级和注册顺序排序
   */
  private sortReceivers<T>(receivers: ReceiverEntry<T>[]): void {
    receivers.sort((a, b) => {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return a.sequence - b.sequence;
    });
  }

  /**
   * 检查是否有同步 receivers
   */
  hasSyncReceivers(signalId: string): boolean {
    const receivers = this.syncReceivers.get(signalId);
    return receivers !== undefined && receivers.length > 0;
  }

  /**
   * 检查是否有异步 receivers
   */
  hasAsyncReceivers(signalId: string): boolean {
    const receivers = this.asyncReceivers.get(signalId);
    return receivers !== undefined && receivers.length > 0;
  }

  /**
   * 获取同步 receivers 数量
   */
  getSyncReceiverCount(signalId: string): number {
    return this.syncReceivers.get(signalId)?.length ?? 0;
  }

  /**
   * 获取异步 receivers 数量
   */
  getAsyncReceiverCount(signalId: string): number {
    return this.asyncReceivers.get(signalId)?.length ?? 0;
  }

  /**
   * 获取所有已注册的同步 Signal IDs
   */
  getAllSyncSignalIds(): string[] {
    return Array.from(this.syncReceivers.keys());
  }

  /**
   * 获取所有已注册的异步 Signal IDs
   */
  getAllAsyncSignalIds(): string[] {
    return Array.from(this.asyncReceivers.keys());
  }

  /**
   * 清除所有 receivers（主要用于测试）
   */
  clearAll(): void {
    this.syncReceivers.clear();
    this.asyncReceivers.clear();
    this.logger.debug('All receivers cleared');
  }

  /**
   * 清除指定 Signal 的所有 receivers
   */
  clearSignal(signalId: string): void {
    this.syncReceivers.delete(signalId);
    this.asyncReceivers.delete(signalId);
    this.logger.debug(`[${signalId}] Receivers cleared`);
  }
}
