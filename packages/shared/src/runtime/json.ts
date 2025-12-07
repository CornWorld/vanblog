import { z } from 'zod';

/**
 * Safely parse JSON string with schema validation
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
 * Transform: JSON string → array
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
 * Transform: array → JSON string
 */
export const arrToJson = (arr: string[] | undefined | null): string | null => {
  return arr ? JSON.stringify(arr) : null;
};

/**
 * Transform: JSON string → object
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
 * Transform: object → JSON string
 */
export const objToJson = <T>(obj: T | undefined | null): string | null => {
  return obj !== undefined && obj !== null ? JSON.stringify(obj) : null;
};
