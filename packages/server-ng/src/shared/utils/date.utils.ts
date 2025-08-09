import dayjs, { type Dayjs } from 'dayjs';

/**
 * Convert Date or string to Dayjs instance
 */
export function toDatejs(date: Date | string | Dayjs): Dayjs {
  if (dayjs.isDayjs(date)) {
    return date;
  }
  return dayjs(date);
}

/**
 * Convert database record dates to Dayjs
 */
export function convertDatesToDatejs<T extends Record<string, unknown>>(
  record: T,
  dateFields: (keyof T)[] = ['createdAt', 'updatedAt'],
): T {
  const converted = { ...record };

  for (const field of dateFields) {
    if (field in converted && converted[field]) {
      converted[field] = toDatejs(converted[field] as Date | string) as T[keyof T];
    }
  }

  return converted;
}

/**
 * Convert array of database records dates to Dayjs
 */
export function convertArrayDatesToDatejs<T extends Record<string, unknown>>(
  records: T[],
  dateFields: (keyof T)[] = ['createdAt', 'updatedAt'],
): T[] {
  return records.map((record) => convertDatesToDatejs(record, dateFields));
}
