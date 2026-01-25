import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';

import { Permission } from '../auth/permissions.decorator';

import {
  CreatePipelineSchema,
  UpdatePipelineSchema,
  TriggerPipelineSchema,
  PipelineListResponseSchema,
  PipelineSchema,
  PipelineExecutionResultSchema,
} from './dto/pipeline.dto';
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

  /**
   * Get all pipelines
   */
  @Get()
  @Permission('pipeline:read')
  @ApiOperation({ summary: 'Get all pipelines' })
  @ApiResponse({ status: 200, description: 'Return all pipelines' })
  async findAll(): Promise<z.infer<typeof PipelineListResponseSchema>> {
    return this.pipelineService.findAll();
  }

  /**
   * Get pipeline configuration (available events)
   */
  @Get('config')
  @Permission('pipeline:read')
  @ApiOperation({ summary: 'Get pipeline configuration' })
  @ApiResponse({ status: 200, description: 'Return pipeline config' })
  getConfig(): { events: string[] } {
    return this.pipelineService.getConfig();
  }

  /**
   * Get a pipeline by ID
   */
  @Get(':id')
  @Permission('pipeline:read')
  @ApiOperation({ summary: 'Get pipeline by ID' })
  @ApiResponse({ status: 200, description: 'Return pipeline' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<z.infer<typeof PipelineSchema>> {
    return this.pipelineService.findOne(id);
  }

  /**
   * Create a new pipeline
   */
  @Post()
  @Permission('pipeline:create')
  @ApiOperation({ summary: 'Create a new pipeline' })
  @ApiResponse({ status: 201, description: 'Pipeline created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(
    @Body() createDto: z.infer<typeof CreatePipelineSchema>,
  ): Promise<z.infer<typeof PipelineSchema>> {
    return this.pipelineService.create(createDto);
  }

  /**
   * Update a pipeline
   */
  @Put(':id')
  @Permission('pipeline:update')
  @ApiOperation({ summary: 'Update a pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline updated' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: z.infer<typeof UpdatePipelineSchema>,
  ): Promise<z.infer<typeof PipelineSchema>> {
    return this.pipelineService.update(id, updateDto);
  }

  /**
   * Delete a pipeline
   */
  @Delete(':id')
  @Permission('pipeline:delete')
  @ApiOperation({ summary: 'Delete a pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline deleted' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.pipelineService.remove(id);
    return { success: true };
  }

  /**
   * Trigger a pipeline
   */
  @Post(':id/trigger')
  @Permission('pipeline:execute')
  @ApiOperation({ summary: 'Trigger a pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline executed' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  @ApiResponse({ status: 400, description: 'Pipeline is disabled' })
  async trigger(
    @Param('id', ParseIntPipe) id: number,
    @Body() triggerDto: z.infer<typeof TriggerPipelineSchema>,
  ): Promise<z.infer<typeof PipelineExecutionResultSchema>> {
    return this.pipelineService.triggerById(id, triggerDto.input);
  }
}
