import { customType } from 'drizzle-orm/sqlite-core';

/**
 * 自动反序列化的 JSON 列类型
 *
 * 修复 libsql 不自动反序列化的问题
 *
 * @example
 * const table = sqliteTable('my_table', {
 *   data: jsonb<MyType>(),
 * });
 */
export const jsonb = <T = unknown>() =>
  customType<{ data: T; driverData: string }>({
    dataType() {
      return 'text';
    },

    // 写入时：序列化为 JSON 字符串
    toDriver(value: T): string {
      return JSON.stringify(value);
    },

    // 读取时：自动反序列化
    fromDriver(value: string | T): T {
      // 如果已经是对象（better-sqlite3），直接返回
      if (typeof value !== 'string') {
        return value;
      }

      // 字符串格式（libsql），解析为对象
      try {
        return JSON.parse(value) as T;
      } catch {
        // 解析失败，返回原值
        return value as unknown as T;
      }
    },
  })();
