import { z } from 'zod';

/**
 * 安全地解析 JSON 字符串并进行 schema 验证
 *
 * Safely parse JSON string with schema validation.
 * Returns null if the string is empty, invalid JSON, or fails schema validation.
 *
 * @param jsonString - JSON 字符串（可为 null 或 undefined）
 * @param schema - Zod schema 用于验证解析结果
 * @returns 解析并验证后的数据，失败时返回 null
 *
 * @example
 * ```ts
 * const result = safeParseJson('{"name":"test"}', z.object({ name: z.string() }));
 * // result: { name: "test" } | null
 * ```
 */
export function safeParseJson<T>(
  jsonString: string | null | undefined,
  schema: z.ZodType<T>,
): T | null {
  if (!jsonString) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(jsonString);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * 将 JSON 字符串转换为字符串数组
 *
 * Transform JSON string to array of strings.
 * Used in Drizzle schemas for database text → array conversion.
 *
 * @param s - JSON 字符串（可为 null）
 * @returns 字符串数组，失败时返回空数组
 *
 * @example
 * ```ts
 * jsonToArr('["tag1","tag2"]') // ["tag1", "tag2"]
 * jsonToArr(null) // []
 * ```
 */
export const jsonToArr = (s: string | null): string[] => {
  if (!s || s === '') return [];
  try {
    return JSON.parse(s) as string[];
  } catch {
    return [];
  }
};

/**
 * 将字符串数组转换为 JSON 字符串
 *
 * Transform array of strings to JSON string.
 * Used in Drizzle schemas for array → database text conversion.
 *
 * @param arr - 字符串数组（可为 undefined 或 null）
 * @returns JSON 字符串，输入为空时返回 null
 *
 * @example
 * ```ts
 * arrToJson(["tag1", "tag2"]) // '["tag1","tag2"]'
 * arrToJson(null) // null
 * ```
 */
export const arrToJson = (arr: string[] | undefined | null): string | null => {
  return arr ? JSON.stringify(arr) : null;
};

/**
 * 将 JSON 字符串转换为对象
 *
 * Transform JSON string to typed object.
 * Generic version for any object type.
 *
 * @param s - JSON 字符串（可为 null）
 * @returns 解析后的对象，失败时返回 null
 *
 * @example
 * ```ts
 * jsonToObj<{ id: number }>("{'id':1}") // { id: 1 }
 * ```
 */
export const jsonToObj = <T>(s: string | null): T | null => {
  if (!s || s === '') return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

/**
 * 将对象转换为 JSON 字符串
 *
 * Transform typed object to JSON string.
 * Generic version for any object type.
 *
 * @param obj - 对象（可为 undefined 或 null）
 * @returns JSON 字符串，输入为空时返回 null
 *
 * @example
 * ```ts
 * objToJson({ id: 1 }) // '{"id":1}'
 * objToJson(null) // null
 * ```
 */
export const objToJson = <T>(obj: T | undefined | null): string | null => {
  return obj !== undefined && obj !== null ? JSON.stringify(obj) : null;
};
