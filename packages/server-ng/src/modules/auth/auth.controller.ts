import {
  Controller,
  Post,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  HttpException,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';

import { UserType } from '../user/dto/create-user.dto';
import { User } from '../user/entities/user.entity';

import { RequireAuth, RequireAdmin } from './auth.decorator';
import { AuthService } from './auth.service';
import { LoginLogQueryDto, LoginLogResponseDto, LoginLogQuerySchema } from './dto/login-log.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginLogService } from './login-log.service';

interface RequestWithUser extends ExpressRequest {
  user: User;
}

interface RequestWithCsrf extends ExpressRequest {
  csrfToken(): string;
}

/**
 * 认证控制器
 *
 * 提供用户认证相关的核心功能，包括登录、登出、令牌刷新、用户信息获取等。
 * 支持 JWT 令牌认证、CSRF 保护和登录日志记录。
 */
@ApiTags('Auth')
@Controller({ path: 'auth', version: '2' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginLogService: LoginLogService,
  ) {}

  /**
   * 用户登录
   *
   * 验证用户凭据并生成访问令牌和刷新令牌。包含频率限制保护。
   *
   * @param req 包含用户信息的请求对象
   * @returns 包含令牌和用户信息的登录响应
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard, LocalAuthGuard)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Request() req: RequestWithUser): Promise<{
    token: string;
    access_token: string;
    refresh_token: string;
    user: Omit<User, 'password'>;
  }> {
    const result = this.authService.login(req.user);

    await this.loginLogService.createLog({
      username: req.user.username,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? '',
      success: true,
      message: 'Login successful',
    });

    return {
      ...result,
      token: result.access_token, // For backward compatibility
    };
  }

  /**
   * 获取当前用户信息
   *
   * 返回当前认证用户的详细信息，不包含密码字段。
   *
   * @param req 包含用户信息的请求对象
   * @returns 用户信息（不含密码）
   */
  @Get('profile')
  @RequireAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  getProfile(@Request() req: RequestWithUser): Omit<User, 'password'> {
    const { password, ...user } = req.user;
    void password;
    return {
      ...user,
      permissions: user.permissions,
    };
  }

  /**
   * 用户登出
   *
   * 撤销指定的访问令牌或刷新令牌，使其失效。
   *
   * @param req 包含用户信息的请求对象
   * @param body 包含要撤销的令牌信息
   * @returns 登出成功消息
   */
  @Post('logout')
  @RequireAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiBody({ schema: { type: 'object', properties: { token: { type: 'string' } } } })
  logout(
    @Request() req: RequestWithUser,
    @Body() body: { token?: string; refresh_token?: string },
  ): { message: string } {
    // Extract token from Authorization header if not provided in body
    const authHeader = req.headers.authorization;
    const token =
      body.token ?? (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (token) {
      this.authService.revokeToken(token);
    }

    if (body.refresh_token) {
      this.authService.revokeToken(body.refresh_token);
    }

    return { message: 'Logout successful' };
  }

  /**
   * 刷新访问令牌
   *
   * 使用有效的刷新令牌生成新的访问令牌和刷新令牌。
   *
   * @param body 包含刷新令牌的请求体
   * @returns 新的访问令牌和刷新令牌
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refresh_token: { type: 'string' } },
      required: ['refresh_token'],
    },
  })
  async refreshToken(
    @Body() body: { refresh_token: string },
  ): Promise<{ access_token: string; refresh_token: string }> {
    const tokenPair = await this.authService.refreshToken(body.refresh_token);
    return {
      access_token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
    };
  }

  /**
   * 撤销所有令牌
   *
   * 撤销当前用户的所有访问令牌和刷新令牌，强制用户重新登录。
   *
   * @param req 包含用户信息的请求对象
   * @returns 撤销成功消息
   */
  @Post('revoke-all')
  @RequireAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all user tokens' })
  @ApiResponse({ status: 200, description: 'All tokens revoked successfully' })
  revokeAllTokens(@Request() req: RequestWithUser): { message: string } {
    this.authService.revokeAllUserTokens(req.user.id);
    return { message: 'All tokens revoked successfully' };
  }

  /**
   * 获取登录日志
   *
   * 查询系统登录日志，支持按用户名和登录状态过滤。仅管理员可访问。
   *
   * @param req 包含用户信息的请求对象
   * @param query 查询参数，包含用户名和成功状态过滤条件
   * @returns 登录日志列表
   */
  @Get('logs')
  @RequireAdmin()
  @ApiOperation({ summary: 'Get login logs' })
  @ApiResponse({ status: 200, description: 'Login logs retrieved successfully' })
  @ApiQuery({ name: 'username', required: false })
  @ApiQuery({ name: 'success', required: false, type: Boolean })
  async getLoginLogs(
    @Request() req: RequestWithUser,
    @Query(new ZodValidationPipe(LoginLogQuerySchema)) query: LoginLogQueryDto,
  ): Promise<LoginLogResponseDto[]> {
    if (req.user.type !== UserType.ADMIN) {
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }
    return this.loginLogService.getLogs(query);
  }

  /**
   * 获取 CSRF 令牌
   *
   * 生成并返回 CSRF 令牌，用于防止跨站请求伪造攻击。
   *
   * @param req 包含 CSRF 令牌生成方法的请求对象
   * @returns CSRF 令牌
   */
  @Get('csrf-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get CSRF token' })
  @ApiResponse({ status: 200, description: 'CSRF token retrieved successfully' })
  getCsrfToken(@Request() req: RequestWithCsrf): { csrfToken: string } {
    // The CSRF token is automatically added to req by the csurf middleware
    // In test environment, CSRF is disabled, so we return a mock token
    if (process.env.NODE_ENV === 'test') {
      return { csrfToken: 'test-csrf-token' };
    }
    return { csrfToken: req.csrfToken() };
  }
}
