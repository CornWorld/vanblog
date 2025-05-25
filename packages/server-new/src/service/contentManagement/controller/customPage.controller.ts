import {
  Controller,
  UseGuards,
  Logger,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { config } from 'src/common/config';
import { AdminGuard } from '../../auth/guard/auth.guard';
import { CustomPageProvider } from '../provider/customPage.provider';
import { StaticProvider } from '../../assetManage/provider/static.provider';
import { ApiToken } from 'src/common/swagger/token';
import { CustomPage } from 'src/scheme/customPage.schema';
import { Result } from 'src/common/result/Result';

@ApiTags('customPage')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/customPage')
export class CustomPageController {
  private readonly logger = new Logger(CustomPageController.name);
  constructor(
    private readonly customPageProvider: CustomPageProvider,
    private readonly staticProvider: StaticProvider,
  ) { }
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: any,
    @Query('path') path: string,
    @Query('name') name: string,
  ) {
    this.logger.log(`上传自定义页面文件：${path}\t ${name}`);
    file.originalname = name;
    const res = await this.staticProvider.upload(file, 'customPage', false, path);
    return Result.ok(res).toObject();
  }

  @Get('/all')
  async getAll() {
    const data = await this.customPageProvider.getAll();
    return Result.ok(data).toObject();
  }
  @Get('/folder')
  async getFolderFiles(@Query('path') path: string) {
    const data = await this.staticProvider.getFolderFiles(path);
    return Result.ok(data).toObject();
  }
  @Get('/file')
  async getFileData(@Query('path') path: string, @Query('key') subPath: string) {
    const data = await this.staticProvider.getFileContent(path, subPath);
    return Result.ok(data).toObject();
  }
  @Get()
  async getOneByPath(@Query('path') path: string) {
    const data = await this.customPageProvider.getCustomPageByPath(path);
    return Result.ok(data).toObject();
  }
  @Post()
  async createOne(@Body() dto: CustomPage) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.customPageProvider.createCustomPage(dto);
    return Result.ok(data).toObject();
  }
  @Post('file')
  async createFile(@Query('path') pathname: string, @Query('subPath') subPath: string) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.staticProvider.createFile(pathname, subPath);
    return Result.ok(data).toObject();
  }
  @Post('folder')
  async createFolder(@Query('path') pathname: string, @Query('subPath') subPath: string) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.staticProvider.createFolder(pathname, subPath);
    return Result.ok(data).toObject();
  }

  @Put('file')
  async updateFileInFolder(@Body() dto: { filePath: string; pathname: string; content: string }) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }

    const data = await this.staticProvider.updateCustomPageFileContent(
      dto.pathname,
      dto.filePath,
      dto.content,
    );
    return Result.ok(data).toObject();
  }
  @Put()
  async updateOne(@Body() dto: CustomPage) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const data = await this.customPageProvider.updateCustomPage(dto);
    return Result.ok(data).toObject();
  }
  @Delete()
  async deleteOne(@Query('path') path: string) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改此项！').toObject();
    }
    const toDelete = await this.customPageProvider.getCustomPageByPath(path);
    if (toDelete && toDelete.type == 'folder') {
      await this.staticProvider.deleteCustomPage(path);
    }
    const data = await this.customPageProvider.deleteByPath(path);
    return Result.ok(data).toObject();
  }
}
