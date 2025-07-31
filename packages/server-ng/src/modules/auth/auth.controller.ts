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
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from '../user/entities/user.entity';
import { UserType } from '../user/dto/create-user.dto';
import { LoginLogService } from './login-log.service';
import { LoginLogQueryDto, LoginLogResponseDto } from './dto/login-log.dto';
import { RequireAuth, RequireAdmin } from './auth.decorator';
import { Request as ExpressRequest } from 'express';

interface RequestWithUser extends ExpressRequest {
  user: User;
}

@ApiTags('auth')
@Controller('api/v2/auth')
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
  async login(
    @Request() req: RequestWithUser,
  ): Promise<{ token: string; access_token: string; user: Omit<User, 'password'> }> {
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
  logout(): { message: string } {
    return { message: 'Logout successful' };
  }

  @Get('logs')
  @RequireAdmin()
  @ApiOperation({ summary: 'Get login logs' })
  @ApiResponse({ status: 200, description: 'Login logs retrieved successfully' })
  @ApiQuery({ name: 'username', required: false })
  @ApiQuery({ name: 'success', required: false, type: Boolean })
  async getLoginLogs(
    @Request() req: RequestWithUser,
    @Query() query: LoginLogQueryDto,
  ): Promise<LoginLogResponseDto[]> {
    if (req.user.type !== UserType.ADMIN) {
      throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
    }
    return this.loginLogService.getLogs(query);
  }
}
