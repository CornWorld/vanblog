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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { PipelineService } from './services/pipeline.service';
import { CreatePipelineDto, UpdatePipelineDto } from './dto';
import { Pipeline } from './entities/pipeline.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@ApiTags('pipelines')
@Controller('pipelines')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Post()
  @Permissions('pipeline:create')
  @ApiOperation({ summary: 'Create a new pipeline' })
  @ApiResponse({ status: 201, description: 'Pipeline created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async create(@Body() createPipelineDto: CreatePipelineDto): Promise<Pipeline> {
    return this.pipelineService.create(createPipelineDto);
  }

  @Get()
  @Permissions('pipeline:read')
  @ApiOperation({ summary: 'Get all pipelines' })
  @ApiResponse({ status: 200, description: 'Pipelines retrieved successfully' })
  async findAll(): Promise<Pipeline[]> {
    return this.pipelineService.findAll();
  }

  @Get(':id')
  @Permissions('pipeline:read')
  @ApiOperation({ summary: 'Get a pipeline by ID' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 200, description: 'Pipeline retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Pipeline> {
    return this.pipelineService.findOne(id);
  }

  @Get('event/:eventName')
  @Permissions('pipeline:read')
  @ApiOperation({ summary: 'Get pipelines by event name' })
  @ApiParam({ name: 'eventName', description: 'Event name' })
  @ApiResponse({ status: 200, description: 'Pipelines retrieved successfully' })
  async findByEvent(@Param('eventName') eventName: string): Promise<Pipeline[]> {
    return this.pipelineService.findByEvent(eventName);
  }

  @Patch(':id')
  @Permissions('pipeline:update')
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
  @Permissions('pipeline:delete')
  @ApiOperation({ summary: 'Delete a pipeline' })
  @ApiParam({ name: 'id', description: 'Pipeline ID' })
  @ApiResponse({ status: 204, description: 'Pipeline deleted successfully' })
  @ApiResponse({ status: 404, description: 'Pipeline not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.pipelineService.remove(id);
  }

  @Post(':id/trigger')
  @Permissions('pipeline:execute')
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
