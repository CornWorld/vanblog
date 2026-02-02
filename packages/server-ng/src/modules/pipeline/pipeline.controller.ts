import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

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
  async findAll() {
    const result = await this.pipelineService.findAll();
    return result.items;
  }

  @Get('config')
  @Permission('pipeline', ['read'])
  @ApiOperation({ summary: 'Get pipeline configuration' })
  @ApiResponse({ status: 200, description: 'Return pipeline config' })
  async getConfig() {
    return this.pipelineService.getConfig();
  }

  @Get(':id')
  @Permission('pipeline', ['read'])
  @ApiOperation({ summary: 'Get pipeline by ID' })
  @ApiResponse({ status: 200, description: 'Return pipeline' })
  async findOne(@Param('id') id: string) {
    return this.pipelineService.findOne(Number(id));
  }

  @Post()
  @Permission('pipeline', ['create'])
  @ApiOperation({ summary: 'Create pipeline' })
  @ApiResponse({ status: 201, description: 'Pipeline created' })
  async create(@Body() body: unknown) {
    return this.pipelineService.create(body);
  }

  @Put(':id')
  @Permission('pipeline', ['update'])
  @ApiOperation({ summary: 'Update pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline updated' })
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.pipelineService.update(Number(id), body);
  }

  @Delete(':id')
  @Permission('pipeline', ['delete'])
  @ApiOperation({ summary: 'Delete pipeline' })
  @ApiResponse({ status: 200, description: 'Pipeline deleted' })
  async remove(@Param('id') id: string) {
    await this.pipelineService.remove(Number(id));
    return { success: true };
  }

  /**
   * Get all pipelines
   */
  @TsRestHandler(contract.getPipelines)
  @Permission('pipeline', ['read'])
  @Get()
  getPipelines_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getPipelines, async () => {
      const result = await this.pipelineService.findAll();
      return { status: 200, body: result.items };
    });
  }

  /**
   * Get pipeline configuration (available events)
   */
  @TsRestHandler(contract.getPipelineConfig)
  @Permission('pipeline', ['read'])
  @Get()
  getPipelineConfig_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getPipelineConfig, () => {
      const config = this.pipelineService.getConfig();
      return { status: 200, body: config };
    });
  }

  /**
   * Get a pipeline by ID
   */
  @TsRestHandler(contract.getPipeline)
  @Permission('pipeline', ['read'])
  @Get()
  getPipeline_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getPipeline, async ({ params }) => {
      const pipeline = await this.pipelineService.findOne(Number(params.id));
      return { status: 200, body: pipeline };
    });
  }

  /**
   * Create a new pipeline
   */
  @TsRestHandler(contract.createPipeline)
  @Permission('pipeline', ['create'])
  @Post()
  createPipeline_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createPipeline, async ({ body }) => {
      const pipeline = await this.pipelineService.create(body);
      return { status: 201, body: pipeline };
    });
  }

  /**
   * Update a pipeline
   */
  @TsRestHandler(contract.updatePipeline)
  @Permission('pipeline', ['update'])
  @Put()
  updatePipeline_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updatePipeline, async ({ params, body }) => {
      const pipeline = await this.pipelineService.update(Number(params.id), body);
      return { status: 200, body: pipeline };
    });
  }

  /**
   * Delete a pipeline
   */
  @TsRestHandler(contract.deletePipeline)
  @Permission('pipeline', ['delete'])
  @Delete()
  deletePipeline_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deletePipeline, async ({ params }) => {
      await this.pipelineService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }

  /**
   * Trigger a pipeline
   */
  @TsRestHandler(contract.triggerPipeline)
  @Permission('pipeline', ['execute'])
  @Post()
  triggerPipeline_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.triggerPipeline, async ({ params, body }) => {
      const result = await this.pipelineService.triggerById(Number(params.id), body);
      return { status: 200, body: result };
    });
  }
}
