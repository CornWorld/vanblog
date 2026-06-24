import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';

import { Permission } from '../auth/permissions.decorator';

import { PipelineService } from './pipeline.service';

/**
 * Pipeline Controller
 *
 * Manages pipeline CRUD operations and execution.
 * All endpoints require admin permissions.
 */
@ApiTags('Pipelines')
@Controller({ path: 'pipelines', version: '2' })
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  @Permission('pipeline', ['read'])
  @ApiOperation({ summary: 'Get all pipelines' })
  @ApiResponse({ status: 200, description: 'Return all pipelines' })
  async findAll(): Promise<unknown> {
    const result = await this.pipelineService.findAll();
    return result.items;
  }

  @Get('config')
  @Permission('pipeline', ['read'])
  @ApiOperation({ summary: 'Get pipeline configuration' })
  @ApiResponse({ status: 200, description: 'Return pipeline config' })
  getConfig(): unknown {
    return this.pipelineService.getConfig();
  }

  @Get(':id')
  @Permission('pipeline', ['read'])
  @ApiOperation({ summary: 'Get pipeline by ID' })
  @ApiResponse({ status: 200, description: 'Return pipeline' })
  async findOne(@Param('id') id: string): Promise<unknown> {
    return this.pipelineService.findOne(Number(id));
  }

  @Post()
  @Permission('pipeline', ['create'])
  @ApiOperation({ summary: 'Create pipeline' })
  @ApiResponse({ status: 201, description: 'Pipeline created' })
  async create(@Body() body: unknown): Promise<unknown> {
    return this.pipelineService.create(body);
  }

  @Put(':id')
  @Permission('pipeline', ['update'])
  @ApiOperation({ summary: 'Update pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline updated' })
  async update(@Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    return this.pipelineService.update(Number(id), body);
  }

  @Delete(':id')
  @Permission('pipeline', ['delete'])
  @ApiOperation({ summary: 'Delete pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline deleted' })
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.pipelineService.remove(Number(id));
    return { success: true };
  }

  @Post(':id/trigger')
  @Permission('pipeline', ['execute'])
  @ApiOperation({ summary: 'Trigger a pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline triggered' })
  async triggerPipeline(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.pipelineService.triggerById(id, body);
  }
}
