import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guard/auth.guard';
import { Request } from 'express';
import { PipelineProvider } from '../provider/pipeline.provider';
import { CreatePipelineDto } from 'src/types/pipeline.dto';
import { VanblogSystemEvents } from 'src/types/event';
import { ApiToken } from 'src/common/swagger/token';
import { Result } from 'src/common/result/Result';

@ApiTags('pipeline')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/pipeline')
export class PipelineController {
  constructor(private readonly pipelineProvider: PipelineProvider) { }
  @Get()
  async getAllPipelines(@Req() req: Request) {
    const pipelines = await this.pipelineProvider.getAll();
    return Result.ok(pipelines).toObject();
  }
  @Get('config')
  async getPipelineConfig(@Req() req: Request) {
    return {
      statusCode: 200,
      data: VanblogSystemEvents,
    };
  }
  @Get('/:id')
  async getPipelineById(@Param('id') idString: string) {
    const id = parseInt(idString);
    const pipeline = await this.pipelineProvider.getPipelineById(id);
    return Result.ok(pipeline).toObject();
  }
  @Post()
  async createPipeline(@Body() createPipelineDto: CreatePipelineDto) {
    const pipeline = await this.pipelineProvider.createPipeline(createPipelineDto);
    return Result.ok(pipeline).toObject();
  }
  @Delete('/:id')
  async deletePipelineById(@Param('id') idString: string) {
    const id = parseInt(idString);
    const pipeline = await this.pipelineProvider.deletePipelineById(id);
    return Result.ok(pipeline).toObject();
  }
  @Put('/:id')
  async updatePipelineById(
    @Param('id') idString: string,
    @Body() updatePipelineDto: CreatePipelineDto,
  ) {
    const id = parseInt(idString);
    const pipeline = await this.pipelineProvider.updatePipelineById(id, updatePipelineDto);
    return Result.ok(pipeline).toObject();
  }
  @Post('/trigger/:id')
  async triggerPipelineById(@Param('id') idString: string, @Body() triggerDto: { input?: any }) {
    const id = parseInt(idString);
    const result = await this.pipelineProvider.triggerById(id, triggerDto.input);
    return Result.ok(result).toObject();
  }
}
