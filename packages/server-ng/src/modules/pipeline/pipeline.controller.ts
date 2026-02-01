import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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

  /**
   * Get all pipelines
   */
  @TsRestHandler(contract.getPipelines)
  @Permission('pipeline', ['read'])
  getPipelines(): ReturnType<typeof tsRestHandler> {
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
  getPipelineConfig(): ReturnType<typeof tsRestHandler> {
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
  getPipeline(): ReturnType<typeof tsRestHandler> {
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
  createPipeline(): ReturnType<typeof tsRestHandler> {
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
  updatePipeline(): ReturnType<typeof tsRestHandler> {
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
  deletePipeline(): ReturnType<typeof tsRestHandler> {
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
  triggerPipeline(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.triggerPipeline, async ({ params, body }) => {
      const result = await this.pipelineService.triggerById(Number(params.id), body);
      return { status: 200, body: result };
    });
  }
}
