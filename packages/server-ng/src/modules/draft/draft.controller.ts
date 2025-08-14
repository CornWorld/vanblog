import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { Article } from '../article/entities/article.entity';
import { RequireAuth } from '../auth/auth.decorator';

import { DraftVersionService } from './draft-version.service';
import { DraftService } from './draft.service';
import {
  DraftDto,
  CreateDraftDto,
  UpdateDraftDto,
  DraftListResponseDto,
  DraftQueryDto,
  PublishDraftDto,
  DraftVersionDto,
  DraftVersionListResponseDto,
  CreateDraftSchema,
  UpdateDraftSchema,
  PublishDraftSchema,
} from './dto/draft.dto';

@ApiTags('drafts')
@Controller({ path: 'drafts', version: '2' })
export class DraftController {
  constructor(
    private readonly draftService: DraftService,
    private readonly draftVersionService: DraftVersionService,
  ) {}

  @Get()
  @RequireAuth('draft:read')
  @ApiOperation({ summary: 'Get all drafts' })
  @ApiResponse({ status: 200, description: 'Return all drafts' })
  async findAll(@Query() query: DraftQueryDto): Promise<DraftListResponseDto> {
    return this.draftService.findAll(query);
  }

  @Get(':id')
  @RequireAuth('draft:read')
  @ApiOperation({ summary: 'Get draft by ID' })
  @ApiResponse({ status: 200, description: 'Return draft by ID' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<DraftDto> {
    return this.draftService.findOne(id);
  }

  @Post()
  @RequireAuth('draft:create')
  @ApiOperation({ summary: 'Create draft' })
  @ApiResponse({ status: 201, description: 'Create new draft' })
  async create(
    @Body(new ZodValidationPipe(CreateDraftSchema)) createDraftDto: CreateDraftDto,
  ): Promise<DraftDto> {
    return this.draftService.create(createDraftDto);
  }

  @Put(':id')
  @RequireAuth('draft:update')
  @ApiOperation({ summary: 'Update draft' })
  @ApiResponse({ status: 200, description: 'Update existing draft' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateDraftSchema)) updateDraftDto: UpdateDraftDto,
  ): Promise<DraftDto> {
    return this.draftService.update(id, updateDraftDto);
  }

  @Delete(':id')
  @RequireAuth('draft:delete')
  @ApiOperation({ summary: 'Delete draft' })
  @ApiResponse({ status: 200, description: 'Draft deleted successfully' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.draftService.remove(id);
  }

  @Post(':id/publish')
  @RequireAuth('draft:publish')
  @ApiOperation({ summary: 'Publish draft as article' })
  @ApiResponse({ status: 200, description: 'Draft published successfully', type: Article })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async publish(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(PublishDraftSchema)) publishDto: PublishDraftDto,
  ): Promise<Article> {
    return this.draftService.publish(id, publishDto);
  }

  @Post('import')
  @RequireAuth('draft:create')
  @ApiOperation({ summary: 'Import multiple drafts' })
  @ApiResponse({ status: 200, description: 'Drafts imported successfully' })
  async importDrafts(@Body() draftDtos: CreateDraftDto[]): Promise<void> {
    return this.draftService.importDrafts(draftDtos);
  }

  @Put(':id/auto-save')
  @RequireAuth('draft:update')
  @ApiOperation({ summary: 'Auto-save draft' })
  @ApiResponse({ status: 200, description: 'Draft auto-saved successfully' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async autoSave(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDraftDto: UpdateDraftDto,
  ): Promise<DraftDto> {
    return this.draftService.autoSave(id, updateDraftDto);
  }

  @Get(':id/versions')
  @RequireAuth('draft:read')
  @ApiOperation({ summary: 'Get draft versions' })
  @ApiResponse({
    status: 200,
    description: 'Return draft versions',
  })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async getVersions(@Param('id', ParseIntPipe) id: number): Promise<DraftVersionListResponseDto> {
    const versions = await this.draftVersionService.getVersions(id);
    return {
      items: versions,
      total: versions.length,
      page: 1,
      pageSize: versions.length,
      totalPages: 1,
    };
  }

  @Get(':id/versions/:version')
  @RequireAuth('draft:read')
  @ApiOperation({ summary: 'Get specific draft version' })
  @ApiResponse({ status: 200, description: 'Return draft version' })
  @ApiResponse({ status: 404, description: 'Draft version not found' })
  async getVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<DraftVersionDto> {
    return this.draftVersionService.getVersion(id, version);
  }

  @Post(':id/versions/:version/restore')
  @RequireAuth('draft:update')
  @ApiOperation({ summary: 'Restore draft to specific version' })
  @ApiResponse({ status: 200, description: 'Draft restored successfully' })
  @ApiResponse({ status: 404, description: 'Draft version not found' })
  async restoreVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<void> {
    return this.draftVersionService.restoreVersion(id, version);
  }

  @Delete(':id/versions/:version')
  @RequireAuth('draft:delete')
  @ApiOperation({ summary: 'Delete draft version' })
  @ApiResponse({ status: 200, description: 'Draft version deleted successfully' })
  @ApiResponse({ status: 404, description: 'Draft version not found' })
  async deleteVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<void> {
    return this.draftVersionService.deleteVersion(id, version);
  }
}
