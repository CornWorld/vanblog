import dayjs, { type Dayjs } from 'dayjs';

/**
 * 转换为 Dayjs 实例
 *
 * 将 Date 对象、字符串或已有的 Dayjs 实例统一转换为 Dayjs 实例。
 * 如果输入已经是 Dayjs 实例，则直接返回，避免重复转换。
 *
 * @param date 日期输入（Date、字符串或 Dayjs 实例）
 * @returns Dayjs 实例
 */
export function toDatejs(date: Date | string | Dayjs): Dayjs {
  if (dayjs.isDayjs(date)) {
    return date;
  }
  return dayjs(date);
}

/**
 * 转换数据库记录中的日期字段为 Dayjs
 *
 * 将数据库记录中指定的日期字段转换为 Dayjs 实例，便于后续的日期操作。
 * 默认转换 createdAt 和 updatedAt 字段，可自定义需要转换的字段列表。
 *
 * @param record 数据库记录对象
 * @param dateFields 需要转换的日期字段列表，默认为 ['createdAt', 'updatedAt']
 * @returns 转换后的记录对象
 */
export function convertDatesToDatejs<T extends Record<string, unknown>>(
  record: T,
  dateFields: (keyof T)[] = ['createdAt', 'updatedAt'],
): T {
  const converted = { ...record };

  for (const field of dateFields) {
    if (field in converted && converted[field] != null) {
      converted[field] = toDatejs(converted[field] as Date | string) as T[keyof T];
    }
  }

  return converted;
}

/**
 * 批量转换数据库记录数组中的日期字段为 Dayjs
 *
 * 对数组中的每个记录调用 convertDatesToDatejs，实现批量日期字段转换。
 * 适用于查询结果列表的日期字段统一处理。
 *
 * @param records 数据库记录数组
 * @param dateFields 需要转换的日期字段列表，默认为 ['createdAt', 'updatedAt']
 * @returns 转换后的记录数组
 */
export function convertArrayDatesToDatejs<T extends Record<string, unknown>>(
  records: T[],
  dateFields: (keyof T)[] = ['createdAt', 'updatedAt'],
): T[] {
  return records.map((record) => convertDatesToDatejs(record, dateFields));
}
