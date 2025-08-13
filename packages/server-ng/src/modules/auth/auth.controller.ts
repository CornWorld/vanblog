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

@ApiTags('Auth')
@Controller({ path: 'auth', version: '2' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginLogService: LoginLogService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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

  @Post('revoke-all')
  @RequireAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all user tokens' })
  @ApiResponse({ status: 200, description: 'All tokens revoked successfully' })
  revokeAllTokens(@Request() req: RequestWithUser): { message: string } {
    this.authService.revokeAllUserTokens(req.user.id);
    return { message: 'All tokens revoked successfully' };
  }

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
}
