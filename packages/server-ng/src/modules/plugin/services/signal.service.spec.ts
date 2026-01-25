import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

import { SignalBus } from './signal.service';

import type { SyncSignal, AsyncSignal } from '@vanblog/shared/signals';

// 创建测试用的 Signal 定义
const testSyncSignal: SyncSignal<z.ZodObject<{ value: z.ZodNumber }>> = {
  id: 'test.sync',
  schema: z.object({ value: z.number() }),
  type: 'sync',
  description: 'Test sync signal',
};

const testAsyncSignal: AsyncSignal<z.ZodObject<{ message: z.ZodString }>> = {
  id: 'test.async',
  schema: z.object({ message: z.string() }),
  type: 'async',
  description: 'Test async signal',
};

describe('SignalBus', () => {
  let signalBus: SignalBus;

  beforeEach(() => {
    signalBus = new SignalBus();
  });

  describe('connect (同步 Signal)', () => {
    it('应该连接同步 receiver 并返回断开连接函数', () => {
      const receiver = vi.fn((data: { value: number }) => data);

      const disconnect = signalBus.connect(testSyncSignal, receiver);

      expect(typeof disconnect).toBe('function');
      expect(signalBus.hasSyncReceivers(testSyncSignal.id)).toBe(true);
      expect(signalBus.getSyncReceiverCount(testSyncSignal.id)).toBe(1);

      // 断开连接
      disconnect();
      expect(signalBus.getSyncReceiverCount(testSyncSignal.id)).toBe(0);
    });

    it('应该按优先级顺序调用多个 receivers', async () => {
      const callOrder: number[] = [];

      signalBus.connect(
        testSyncSignal,
        (data) => {
          callOrder.push(2);
          return data;
        },
        20,
      );

      signalBus.connect(
        testSyncSignal,
        (data) => {
          callOrder.push(1);
          return data;
        },
        10,
      );

      signalBus.connect(
        testSyncSignal,
        (data) => {
          callOrder.push(3);
          return data;
        },
        30,
      );

      await signalBus.send(testSyncSignal, { value: 42 });

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('应该在相同优先级时按注册顺序调用', async () => {
      const callOrder: string[] = [];

      signalBus.connect(
        testSyncSignal,
        (data) => {
          callOrder.push('first');
          return data;
        },
        10,
      );

      signalBus.connect(
        testSyncSignal,
        (data) => {
          callOrder.push('second');
          return data;
        },
        10,
      );

      await signalBus.send(testSyncSignal, { value: 1 });

      expect(callOrder).toEqual(['first', 'second']);
    });
  });

  describe('subscribe (异步 Signal)', () => {
    it('应该订阅异步 receiver 并返回取消订阅函数', () => {
      const receiver = vi.fn();

      const unsubscribe = signalBus.subscribe(testAsyncSignal, receiver);

      expect(typeof unsubscribe).toBe('function');
      expect(signalBus.hasAsyncReceivers(testAsyncSignal.id)).toBe(true);
      expect(signalBus.getAsyncReceiverCount(testAsyncSignal.id)).toBe(1);

      // 取消订阅
      unsubscribe();
      expect(signalBus.getAsyncReceiverCount(testAsyncSignal.id)).toBe(0);
    });

    it('应该支持多个异步 subscribers', () => {
      const receiver1 = vi.fn();
      const receiver2 = vi.fn();

      signalBus.subscribe(testAsyncSignal, receiver1);
      signalBus.subscribe(testAsyncSignal, receiver2);

      expect(signalBus.getAsyncReceiverCount(testAsyncSignal.id)).toBe(2);
    });
  });

  describe('send (发送同步 Signal)', () => {
    it('应该通过所有 receivers 传递数据并返回最终结果', async () => {
      signalBus.connect(testSyncSignal, (data) => ({
        value: data.value + 1,
      }));

      signalBus.connect(testSyncSignal, (data) => ({
        value: data.value * 2,
      }));

      const result = await signalBus.send(testSyncSignal, { value: 5 });

      // (5 + 1) * 2 = 12
      expect(result).toEqual({ value: 12 });
    });

    it('没有 receivers 时应该返回原始数据', async () => {
      const data = { value: 42 };
      const result = await signalBus.send(testSyncSignal, data);

      expect(result).toEqual(data);
    });

    it('应该对输入数据进行 Zod 校验', async () => {
      const receiver = vi.fn((data: { value: number }) => data);
      signalBus.connect(testSyncSignal, receiver);

      // 发送有效数据
      await signalBus.send(testSyncSignal, { value: 10 });
      expect(receiver).toHaveBeenCalledWith({ value: 10 }, expect.any(Object));
    });

    it('receiver 校验失败时应跳过该 receiver', async () => {
      const badReceiver = vi.fn(() => {
        // 返回无效数据（缺少 value 字段）
        return {} as { value: number };
      });
      const goodReceiver = vi.fn((data: { value: number }) => ({
        value: data.value + 100,
      }));

      signalBus.connect(testSyncSignal, badReceiver, 10);
      signalBus.connect(testSyncSignal, goodReceiver, 20);

      const result = await signalBus.send(testSyncSignal, { value: 1 });

      // badReceiver 返回无效数据，被跳过
      // goodReceiver 收到原始数据并处理
      expect(result).toEqual({ value: 101 });
    });

    it('receiver 抛出错误时应继续处理下一个 receiver', async () => {
      const errorReceiver = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalReceiver = vi.fn((data: { value: number }) => ({
        value: data.value + 50,
      }));

      signalBus.connect(testSyncSignal, errorReceiver, 10);
      signalBus.connect(testSyncSignal, normalReceiver, 20);

      const result = await signalBus.send(testSyncSignal, { value: 10 });

      expect(errorReceiver).toHaveBeenCalled();
      expect(normalReceiver).toHaveBeenCalled();
      expect(result).toEqual({ value: 60 });
    });
  });

  describe('emit (发送异步 Signal)', () => {
    it('应该并行调用所有 subscribers', async () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      signalBus.subscribe(testAsyncSignal, subscriber1);
      signalBus.subscribe(testAsyncSignal, subscriber2);

      await signalBus.emit(testAsyncSignal, { message: 'hello' });

      expect(subscriber1).toHaveBeenCalledWith({ message: 'hello' }, expect.any(Object));
      expect(subscriber2).toHaveBeenCalledWith({ message: 'hello' }, expect.any(Object));
    });

    it('没有 subscribers 时应该正常完成', async () => {
      await expect(signalBus.emit(testAsyncSignal, { message: 'test' })).resolves.not.toThrow();
    });

    it('subscriber 错误不应影响其他 subscribers', async () => {
      const errorSubscriber = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalSubscriber = vi.fn();

      signalBus.subscribe(testAsyncSignal, errorSubscriber);
      signalBus.subscribe(testAsyncSignal, normalSubscriber);

      await signalBus.emit(testAsyncSignal, { message: 'test' });

      expect(errorSubscriber).toHaveBeenCalled();
      expect(normalSubscriber).toHaveBeenCalled();
    });
  });

  describe('辅助方法', () => {
    it('getAllSyncSignalIds 应返回所有注册的同步 Signal ID', () => {
      signalBus.connect(testSyncSignal, (d) => d);

      const ids = signalBus.getAllSyncSignalIds();

      expect(ids).toContain(testSyncSignal.id);
    });

    it('getAllAsyncSignalIds 应返回所有注册的异步 Signal ID', () => {
      signalBus.subscribe(testAsyncSignal, () => {});

      const ids = signalBus.getAllAsyncSignalIds();

      expect(ids).toContain(testAsyncSignal.id);
    });

    it('clearAll 应清除所有 receivers', () => {
      signalBus.connect(testSyncSignal, (d) => d);
      signalBus.subscribe(testAsyncSignal, () => {});

      signalBus.clearAll();

      expect(signalBus.getSyncReceiverCount(testSyncSignal.id)).toBe(0);
      expect(signalBus.getAsyncReceiverCount(testAsyncSignal.id)).toBe(0);
    });

    it('clearSignal 应清除指定 Signal 的所有 receivers', () => {
      signalBus.connect(testSyncSignal, (d) => d);
      signalBus.subscribe(testAsyncSignal, () => {});

      signalBus.clearSignal(testSyncSignal.id);

      expect(signalBus.getSyncReceiverCount(testSyncSignal.id)).toBe(0);
      expect(signalBus.getAsyncReceiverCount(testAsyncSignal.id)).toBe(1);
    });
  });

  describe('类型安全', () => {
    it('应该正确推导同步 Signal 的数据类型', async () => {
      const numberSignal: SyncSignal<z.ZodNumber> = {
        id: 'number.signal',
        schema: z.number(),
        type: 'sync',
        description: 'Number signal',
      };

      signalBus.connect(numberSignal, (num) => num * 2);

      const result = await signalBus.send(numberSignal, 5);
      expect(result).toBe(10);
    });

    it('应该正确推导异步 Signal 的数据类型', async () => {
      const stringSignal: AsyncSignal<z.ZodString> = {
        id: 'string.signal',
        schema: z.string(),
        type: 'async',
        description: 'String signal',
      };

      const receiver = vi.fn((str: string) => {
        expect(typeof str).toBe('string');
      });

      signalBus.subscribe(stringSignal, receiver);
      await signalBus.emit(stringSignal, 'hello');

      expect(receiver).toHaveBeenCalledWith('hello', expect.any(Object));
    });
  });
});
