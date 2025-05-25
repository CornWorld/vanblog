import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { InitDto } from '../../../types/meta/init.dto';
import { InitProvider } from '../provider/init.provider';
import { ISRProvider } from '../../isr/provider/isr.provider';
import { StaticProvider } from '../../assetManage/provider/static.provider';
import { ApiToken } from '../../../common/swagger/token';
import { Result } from 'src/common/result/Result';

@ApiTags('init')
@ApiToken
@Controller('/api/admin')
export class InitController {
  constructor(
    private readonly initProvider: InitProvider,
    private readonly staticProvider: StaticProvider,
    private readonly isrProvider: ISRProvider,
  ) { }

  @Post('/init')
  async initSystem(@Body() initDto: InitDto) {
    const hasInit = await this.initProvider.checkHasInited();
    if (hasInit) {
      throw new HttpException('已初始化', 500);
    }
    await this.initProvider.init(initDto);
    this.isrProvider.activeAll('初始化触发增量渲染！', undefined, {
      forceActice: true,
    });
    return Result.build(200, "初始化成功!").toObject();
  }

  @Get('/init')
  async checkInit() {
    const hasInit = await this.initProvider.checkHasInited();
    return Result.ok({ hasInit }).toObject();
  }

  @Post('/init/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImg(@UploadedFile() file: Express.Multer.File, @Query('favicon') favicon: string) {
    const hasInit = await this.initProvider.checkHasInited();
    if (hasInit) {
      throw new HttpException('已初始化', 500);
    }
    let isFavicon = false;
    if (favicon && favicon == 'true') {
      isFavicon = true;
    }
    const res = await this.staticProvider.upload(file, 'img', isFavicon);
    return Result.ok(res).toObject();
  }
}
