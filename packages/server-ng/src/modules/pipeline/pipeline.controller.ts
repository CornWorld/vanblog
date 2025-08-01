import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PipelineService } from './services/pipeline.service';
import { CreatePipelineDto, UpdatePipelineDto } from './dto';
import { Pipeline } from './entities/pipeline.entity';

@ApiTags('pipelines')
@Controller('pipelines')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new pipeline' })
  @ApiResponse({ status: 201, description: 'Pipeline created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async create(@Body() createPipelineDto: CreatePipelineDto): Promise<Pipeline> {
    return this.pipelineService.create(createPipelineDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all pipelines' })
  @ApiResponse({ status: 200, description: 'Pipelines retrieved successfully' })
  async findAll(): Promise<Pipeline[]> {
    return this.pipelineService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a pipeline by ID' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Pipeline> {
    return this.pipelineService.findOne(id);
  }

  @Get('event/:eventName')
  @ApiOperation({ summary: 'Get pipelines by event name' })
  @ApiParam({ name: 'eventName', description: 'Event name' })
  @ApiResponse({ status: 200, description: 'Pipelines retrieved successfully' })
  async findByEvent(@Param('eventName') eventName: string): Promise<Pipeline[]> {
    return this.pipelineService.findByEvent(eventName);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a pipeline' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline updated successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePipelineDto: UpdatePipelineDto,
  ): Promise<Pipeline> {
    return this.pipelineService.update(id, updatePipelineDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a pipeline' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 204, description: 'Pipeline deleted successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.pipelineService.remove(id);
  }

  @Post(':id/trigger')
  @ApiOperation({ summary: 'Manually trigger a pipeline' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline triggered successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async trigger(
    @Param('id', ParseIntPipe) id: number,
    @Body() data?: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    return this.pipelineService.triggerById(id, data);
  }
}
