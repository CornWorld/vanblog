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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
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

/**
 * V1 API 认证控制器
 * 提供与现有 v1 API 兼容的认证接口
 */
@ApiTags('Auth (v1 Compatible)')
@Controller({ path: 'auth', version: '1' })
export class AuthV1Controller {
  constructor(
    private readonly authService: AuthService,
    private readonly loginLogService: LoginLogService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard, LocalAuthGuard)
  @ApiOperation({ summary: 'User login (v1 compatible)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(
    @Request() req: RequestWithUser,
  ): Promise<{ token: string; access_token: string; user: Omit<User, 'password'> }> {
    const result = this.authService.login(req.user);

    await this.loginLogService.createLog({
      username: req.user.username,
      ip: req.ip,
      userAgent: req.get('User-Agent') ?? '',
      success: true,
    });

    return {
      ...result,
      token: result.access_token, // v1 compatibility
    };
  }

  @Get('profile')
  @RequireAuth()
  @ApiOperation({ summary: 'Get current user profile (v1 compatible)' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  getProfile(@Request() req: RequestWithUser): Omit<User, 'password'> {
    const { password: _password, ...profile } = req.user;
    return profile;
  }

  @Post('logout')
  @RequireAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout (v1 compatible)' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  logout(): { message: string } {
    return { message: 'Logout successful' };
  }

  @Get('logs')
  @RequireAdmin()
  @ApiOperation({ summary: 'Get login logs (v1 compatible)' })
  @ApiResponse({ status: 200, description: 'Login logs retrieved successfully' })
  @ApiQuery({ name: 'username', required: false })
  @ApiQuery({ name: 'success', required: false, type: Boolean })
  async getLoginLogs(
    @Request() req: RequestWithUser,
    @Query(new ZodValidationPipe(LoginLogQuerySchema)) query: LoginLogQueryDto,
  ): Promise<LoginLogResponseDto[]> {
    if (req.user.type !== UserType.ADMIN) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    return await this.loginLogService.getLogs(query);
  }
}
