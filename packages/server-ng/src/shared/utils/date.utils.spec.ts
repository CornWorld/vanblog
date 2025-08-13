import dayjs, { type Dayjs } from 'dayjs';
import { describe, it, expect } from 'vitest';

import { toDatejs, convertDatesToDatejs, convertArrayDatesToDatejs } from './date.utils';

describe('DateUtils', () => {
  describe('toDatejs', () => {
    it('should return the same Dayjs instance if input is already Dayjs', () => {
      const dayjsInstance = dayjs('2023-01-01');
      const result = toDatejs(dayjsInstance);
      expect(result).toBe(dayjsInstance);
    });

    it('should convert Date to Dayjs', () => {
      const date = new Date('2023-01-01');
      const result = toDatejs(date);
      expect(dayjs.isDayjs(result)).toBe(true);
      expect(result.format('YYYY-MM-DD')).toBe('2023-01-01');
    });

    it('should convert string to Dayjs', () => {
      const dateString = '2023-01-01';
      const result = toDatejs(dateString);
      expect(dayjs.isDayjs(result)).toBe(true);
      expect(result.format('YYYY-MM-DD')).toBe('2023-01-01');
    });
  });

  describe('convertDatesToDatejs', () => {
    it('should convert default date fields to Dayjs', () => {
      const record = {
        id: 1,
        name: 'test',
        createdAt: new Date('2023-01-01'),
        updatedAt: '2023-01-02',
      };

      const result = convertDatesToDatejs(record);

      expect(result.id).toBe(1);
      expect(result.name).toBe('test');
      expect(dayjs.isDayjs(result.createdAt)).toBe(true);
      expect(dayjs.isDayjs(result.updatedAt)).toBe(true);
      expect((result.createdAt as unknown as Dayjs).format('YYYY-MM-DD')).toBe('2023-01-01');
      expect((result.updatedAt as unknown as Dayjs).format('YYYY-MM-DD')).toBe('2023-01-02');
    });

    it('should convert custom date fields to Dayjs', () => {
      const record = {
        id: 1,
        publishedAt: new Date('2023-01-01'),
        scheduledAt: '2023-01-02',
      };

      const result = convertDatesToDatejs(record, ['publishedAt', 'scheduledAt']);

      expect(result.id).toBe(1);
      expect(dayjs.isDayjs(result.publishedAt)).toBe(true);
      expect(dayjs.isDayjs(result.scheduledAt)).toBe(true);
    });

    it('should handle null and undefined date fields', () => {
      const record = {
        id: 1,
        createdAt: null,
        updatedAt: undefined,
        name: 'test',
      };

      const result = convertDatesToDatejs(record);

      expect(result.id).toBe(1);
      expect(result.name).toBe('test');
      expect(result.createdAt).toBeNull();
      expect(result.updatedAt).toBeUndefined();
    });

    it('should not modify fields that do not exist in the record', () => {
      const record = {
        id: 1,
        name: 'test',
      };

      const result = convertDatesToDatejs(record);

      expect(result).toEqual(record);
    });

    it('should preserve original record structure', () => {
      const record = {
        id: 1,
        name: 'test',
        createdAt: new Date('2023-01-01'),
        nested: {
          value: 'nested',
        },
      };

      const result = convertDatesToDatejs(record);

      expect(result.id).toBe(1);
      expect(result.name).toBe('test');
      expect(result.nested).toEqual({ value: 'nested' });
      expect(dayjs.isDayjs(result.createdAt)).toBe(true);
    });
  });

  describe('convertArrayDatesToDatejs', () => {
    it('should convert date fields in array of records', () => {
      const records = [
        {
          id: 1,
          name: 'test1',
          createdAt: new Date('2023-01-01'),
          updatedAt: '2023-01-02',
        },
        {
          id: 2,
          name: 'test2',
          createdAt: new Date('2023-01-03'),
          updatedAt: '2023-01-04',
        },
      ];

      const result = convertArrayDatesToDatejs(records);

      expect(result).toHaveLength(2);

      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('test1');
      expect(dayjs.isDayjs(result[0].createdAt)).toBe(true);
      expect(dayjs.isDayjs(result[0].updatedAt)).toBe(true);

      expect(result[1].id).toBe(2);
      expect(result[1].name).toBe('test2');
      expect(dayjs.isDayjs(result[1].createdAt)).toBe(true);
      expect(dayjs.isDayjs(result[1].updatedAt)).toBe(true);
    });

    it('should handle empty array', () => {
      const records: Array<Record<string, unknown>> = [];
      const result = convertArrayDatesToDatejs(records);
      expect(result).toEqual([]);
    });

    it('should convert custom date fields in array', () => {
      const records = [
        {
          id: 1,
          publishedAt: new Date('2023-01-01'),
        },
        {
          id: 2,
          publishedAt: '2023-01-02',
        },
      ];

      const result = convertArrayDatesToDatejs(records, ['publishedAt']);

      expect(result).toHaveLength(2);
      expect(dayjs.isDayjs(result[0].publishedAt)).toBe(true);
      expect(dayjs.isDayjs(result[1].publishedAt)).toBe(true);
    });

    it('should handle records with missing date fields', () => {
      const records = [
        {
          id: 1,
          name: 'test1',
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 2,
          name: 'test2',
          // missing createdAt
        },
      ];

      const result = convertArrayDatesToDatejs(records);

      expect(result).toHaveLength(2);
      expect(dayjs.isDayjs(result[0].createdAt)).toBe(true);
      expect(result[1].createdAt).toBeUndefined();
    });
  });
});
