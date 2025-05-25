import {
  Controller,
  Request,
  Post,
  UseGuards,
  Put,
  Body,
  UnauthorizedException,
  Req
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { config } from '../../../common/config/index';
import { UpdateUserDto } from '../../../types/user/user.dto';
import { AdminGuard } from '../guard/auth.guard';
import { AuthProvider } from '../provider/auth.provider';
import { LogProvider } from 'src/infra/log/provider/log.provider';
import { UserProvider } from '../provider/user.provider';
import { LoginGuard } from '../guard/login.guard';
import { TokenProvider } from '../provider/token.provider';
import { CacheProvider } from '../../../infra/cache/cache.provider';
import { InitProvider } from '../../meta/provider/init.provider';
import { PipelineProvider } from '../../contentManagement/provider/pipeline.provider';
import { ApiToken } from 'src/common/swagger/token';
import { Result } from 'src/common/result/Result';
import { Request as ExpressRequest } from 'express';

@ApiTags('auth')
@Controller('/api/admin/auth/')
export class AuthController {
  constructor(
    private readonly authProvider: AuthProvider,
    private readonly userProvider: UserProvider,
    private readonly logProvider: LogProvider,
    private readonly tokenProvider: TokenProvider,
    private readonly cacheProvider: CacheProvider,
    private readonly initProvider: InitProvider,
    private readonly pipelineProvider: PipelineProvider,
  ) { }

  @UseGuards(LoginGuard, AuthGuard('local'))
  @Post('/login')
  async login(@Request() request: ExpressRequest & { user?: any }) {
    if (request?.user?.fail) {
      this.logProvider.login(request, false);
      throw new UnauthorizedException({
        statusCode: 401,
        message: '用户名或密码错误！',
      });
    }
    // 能到这里登陆就成功了
    this.logProvider.login(request, true);
    const data = await this.authProvider.login(request.user);
    this.pipelineProvider.dispatchEvent('login', data);
    return Result.ok(data).toObject();
  }

  @Post('/logout')
  async logout(@Request() request: ExpressRequest) {
    const token = request.headers['token'];
    if (!token) {
      throw new UnauthorizedException(Result.build(401, '无登录凭证！').toObject());
    }
    this.pipelineProvider.dispatchEvent('logout', {
      token,
    });
    await this.tokenProvider.disableToken(Array.isArray(token) ? token[0] : token);
    return Result.ok('登出成功！').toObject();
  }

  @Post('/restore')
  async restore(
    @Request() request: Request,
    @Body() body: { key: string; name: string; password: string },
  ) {
    const token = body.key;
    const keyInCache = await this.cacheProvider.get('restoreKey');
    if (!token || token != keyInCache) {
      throw new UnauthorizedException(Result.build(401, '恢复密钥错误！').toObject());
    }
    await this.userProvider.updateUser({
      name: body.name,
      password: body.password,
    });
    await this.initProvider.initRestoreKey();
    setTimeout(() => {
      // 在前端清理 localStore 之后
      this.tokenProvider.disableAll();
    }, 1000);

    return Result.ok('重置成功！').toObject()
  }

  @UseGuards(...AdminGuard)
  @ApiToken
  @Put()
  async updateUser(@Body() updateUserDto: UpdateUserDto) {
    if (config?.demo == true || config?.demo == 'true') {
      return Result.build(401, '演示站禁止修改账号密码！').toObject()
    }
    const data = await this.userProvider.updateUser(updateUserDto);
    setTimeout(() => {
      // 在前端清理 localStore 之后
      this.tokenProvider.disableAll();
    }, 1000);
    return Result.ok(data).toObject();
  }
}
