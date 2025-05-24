import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { Response } from 'express';
import { ResultCodeEnum } from '../result/ResultCodeEnum';
import { Result } from '../result/Result';

/**
 * 捕获未被捕获的运行时异常
 */
@Catch(Error)
export class ErrorFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = ResultCodeEnum.FAIL;
    console.error("发生未被捕获异常：" + exception.message); // 获取请求信息
    response.status(status).json(Result.build(status, "发生未知内部异常"));
  }
}
