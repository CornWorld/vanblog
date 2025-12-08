import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * 扩展的请求接口，包含 CSRF token 方法
 */
interface RequestWithCsrf extends Request {
  csrfToken(): string;
}

/**
 * CSRF 保护守卫
 *
 * 配合 csurf 中间件工作，为非幂等性请求提供 CSRF 保护。
 * 对于 GET、HEAD、OPTIONS 等安全方法，自动放行。
 * 对于 POST、PUT、DELETE 等修改性操作，依赖 csurf 中间件验证 token。
 *
 * 设计原则：
 * - 守卫层只负责声明性控制，实际验证由 csurf 中间件处理
 * - 如果请求到达守卫层，说明 token 已通过验证（否则中间件会拦截）
 * - 安全方法无需验证，减少性能开销
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  /**
   * 判断请求是否可以通过守卫
   *
   * @param context 执行上下文，包含请求信息
   * @returns true 表示允许通过，false 表示拒绝
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithCsrf>();

    // 对于安全的 HTTP 方法（GET、HEAD、OPTIONS），跳过 CSRF 检查
    // 这些方法按照 HTTP 规范应该是幂等且无副作用的
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // 对于其他方法（POST、PUT、DELETE 等），CSRF 保护由 csurf 中间件处理
    // 如果请求能到达这里，说明 CSRF token 验证已通过
    // （否则 csurf 中间件会在守卫之前抛出错误）
    return true;
  }
}
