import { ResultCodeEnum, ResultCodeMessage } from './ResultCodeEnum';

export interface IResult<T = unknown> {
  statusCode: number;
  message?: string;
  data?: T | null;
}

/**
 * @description: 统一返回结果的生成工具类
 * @param {number} statusCode - 状态码
 * @param {string} message - 信息
 * @param {T} data - 返回数据
 */
export class Result<T = unknown> {
  private statusCode: number;
  private message?: string;
  private data?: T | null;

  constructor(statusCode: number, message?: string, data?: T | null) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }

  // 静态构建方法 - 基础实现
  private static baseBuild<T>(data?: T | null): Result<T> {
    return new Result<T>(ResultCodeEnum.SUCCESS, ResultCodeMessage[ResultCodeEnum.SUCCESS], data);
  }

  static build<T>(body: T, statusCode: number, message?: string): Result<T>;

  static build<T>(statusCode: number, message?: string): Result<T>;

  static build<T>(body: T, resultCodeEnum: ResultCodeEnum): Result<T>;

  static build<T>(
    arg1: T | number,
    arg2?: number | string | ResultCodeEnum,
    arg3?: string,
  ): Result<T> {
    const result = this.baseBuild<T>(null);

    if (typeof arg1 !== 'number' && arg2 !== undefined && typeof arg2 === 'number') {
      result.data = arg1;
      result.statusCode = arg2;
      if (typeof arg3 === 'string') {
        result.message = arg3;
      } else {
        result.message = ResultCodeMessage[arg2 as ResultCodeEnum] || undefined;
      }
      return result;
    } else if (typeof arg1 === 'number' && typeof arg2 === 'string') {
      result.statusCode = arg1;
      result.message = arg2;
      return result;
    } else if (typeof arg1 !== 'number' && typeof arg2 === 'number') {
      result.data = arg1;
      result.statusCode = arg2;
      result.message = ResultCodeMessage[arg2 as ResultCodeEnum] || undefined;
      return result;
    } else if (typeof arg1 === 'number') {
      result.statusCode = arg1;
      result.message = ResultCodeMessage[arg1 as ResultCodeEnum] || undefined;
      return result;
    }

    return result;
  }

  static ok<T>(data?: T): Result<T> {
    return this.build(data ?? null, ResultCodeEnum.SUCCESS);
  }

  static fail<T>(message: string): Result<T> {
    return this.build(ResultCodeEnum.FAIL, message);
  }

  setMessage(msg?: string): this {
    this.message = msg;
    return this;
  }

  setStatusCode(statusCode: number): this {
    this.statusCode = statusCode;
    return this;
  }

  toObject(): IResult<T> {
    const result: IResult<T> = {
      statusCode: this.statusCode,
    };

    if (this.message !== undefined) {
      result.message = this.message;
    }

    if (this.data !== undefined) {
      result.data = this.data;
    }

    return result;
  }
}
