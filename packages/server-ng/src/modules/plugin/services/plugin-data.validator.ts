import { Injectable } from '@nestjs/common';
import { z, type ZodType } from 'zod';

/**
 * 负责验证与规范化插件提供的公共数据
 * - 支持新版 envelope { schema, data }：若提供 schema（Zod），按 schema 校验并仅输出 data
 * - 无 schema 时：只要可 JSON 序列化则通过
 * - 不可序列化或校验失败：丢弃该插件的数据（不影响其他插件）
 */
@Injectable()
export class PluginDataValidator {
  validatePluginData(
    pluginName: string,
    data: unknown,
    schema?: ZodType,
  ): { valid: boolean; errors?: string[] } {
    if (!schema) {
      // 无 schema，按可序列化性兜底
      return this.isJsonSerializable(data)
        ? { valid: true }
        : { valid: false, errors: [`${pluginName}: data is not JSON-serializable`] };
    }

    try {
      schema.parse(data);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const { issues } = error;
        return {
          valid: false,
          errors: issues.map((issue) => issue.message),
        };
      }
      return { valid: false, errors: [String(error)] };
    }
  }

  /**
   * 规范化 provider 返回值：
   * - 若形如 { schema, data } 且 schema 为 Zod，且校验通过 => 返回 data
   * - 若形如 { data } 但没有有效 schema => 若 data 可序列化 => 返回 data
   * - 其他任意值 => 若可序列化 => 原样返回
   * - 非法 => 返回 undefined
   */
  normalizeProviderResult(pluginName: string, value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      const maybeSchema = obj.schema;
      const hasData = Object.prototype.hasOwnProperty.call(obj, 'data');

      if (hasData) {
        const { data } = obj;
        if (this.isZodSchema(maybeSchema)) {
          const result = this.validatePluginData(pluginName, data, maybeSchema);
          if (result.valid) {
            return this.ensureSerializable(data);
          }
          return undefined;
        }
        // 没有有效 schema，则仅检查可序列化
        return this.ensureSerializable(data);
      }
    }

    return this.ensureSerializable(value);
  }

  /** 简单可序列化检查：利用 JSON.stringify 捕获循环/不支持类型（如 BigInt、Symbol、函数） */
  isJsonSerializable(value: unknown): boolean {
    // 顶层不可序列化的类型：undefined / function / symbol / bigint
    if (
      value === undefined ||
      typeof value === 'function' ||
      typeof value === 'symbol' ||
      typeof value === 'bigint'
    ) {
      return false;
    }
    try {
      // 对于循环引用等情况，JSON.stringify 会抛错
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }

  private ensureSerializable<T>(value: T): T | undefined {
    return this.isJsonSerializable(value) ? value : undefined;
  }

  private isZodSchema(s: unknown): s is ZodType {
    if (s === null || s === undefined || typeof s !== 'object') return false;
    const maybe = s as { parse?: unknown };
    return typeof maybe.parse === 'function';
  }
}
