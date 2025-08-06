import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

import {
  CreateCodeSnippetDto,
  UpdateCodeSnippetDto,
  CodeSnippetQueryDto,
  CodeSnippetExecuteDto,
  CodeSnippetResponseDto,
  CodeSnippetListResponseDto,
  CodeSnippetExecuteResponseDto,
} from '../dto/code-snippet.dto';
import { CodeSnippetService } from '../services/code-snippet.service';

@ApiTags('Code Snippets')
@Controller('v2/code-snippets')
export class CodeSnippetController {
  constructor(private readonly codeSnippetService: CodeSnippetService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new code snippet' })
  @ApiResponse({
    status: 201,
    description: 'Code snippet created successfully',
    type: CodeSnippetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(
    @Body() createCodeSnippetDto: CreateCodeSnippetDto,
  ): Promise<CodeSnippetResponseDto> {
    return this.codeSnippetService.create(createCodeSnippetDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all code snippets with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'Code snippets retrieved successfully',
    type: CodeSnippetListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'hookName', required: false, type: String, description: 'Filter by hook name' })
  @ApiQuery({
    name: 'hookType',
    required: false,
    enum: ['action', 'filter'],
    description: 'Filter by hook type',
  })
  @ApiQuery({
    name: 'enabled',
    required: false,
    type: Boolean,
    description: 'Filter by enabled status',
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in name' })
  async findAll(@Query() query: CodeSnippetQueryDto): Promise<CodeSnippetListResponseDto> {
    return this.codeSnippetService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a code snippet by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Code snippet ID' })
  @ApiResponse({
    status: 200,
    description: 'Code snippet retrieved successfully',
    type: CodeSnippetResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Code snippet not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CodeSnippetResponseDto> {
    return this.codeSnippetService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a code snippet' })
  @ApiParam({ name: 'id', type: Number, description: 'Code snippet ID' })
  @ApiResponse({
    status: 200,
    description: 'Code snippet updated successfully',
    type: CodeSnippetResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Code snippet not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCodeSnippetDto: UpdateCodeSnippetDto,
  ): Promise<CodeSnippetResponseDto> {
    return this.codeSnippetService.update(id, updateCodeSnippetDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a code snippet' })
  @ApiParam({ name: 'id', type: Number, description: 'Code snippet ID' })
  @ApiResponse({ status: 204, description: 'Code snippet deleted successfully' })
  @ApiResponse({ status: 404, description: 'Code snippet not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.codeSnippetService.remove(id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a code snippet manually' })
  @ApiParam({ name: 'id', type: Number, description: 'Code snippet ID' })
  @ApiResponse({
    status: 200,
    description: 'Code snippet executed successfully',
    type: CodeSnippetExecuteResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Code snippet not found' })
  @ApiResponse({ status: 400, description: 'Code snippet is disabled or execution failed' })
  async execute(
    @Param('id', ParseIntPipe) id: number,
    @Body() executeDto: CodeSnippetExecuteDto,
  ): Promise<CodeSnippetExecuteResponseDto> {
    return this.codeSnippetService.execute(id, executeDto);
  }

  @Get('hooks/:hookName/:hookType')
  @ApiOperation({ summary: 'Get code snippets by hook name and type' })
  @ApiParam({ name: 'hookName', type: String, description: 'Hook name' })
  @ApiParam({ name: 'hookType', enum: ['action', 'filter'], description: 'Hook type' })
  @ApiResponse({
    status: 200,
    description: 'Code snippets retrieved successfully',
    type: [CodeSnippetResponseDto],
  })
  async findByHook(
    @Param('hookName') hookName: string,
    @Param('hookType') hookType: 'action' | 'filter',
  ): Promise<CodeSnippetResponseDto[]> {
    return this.codeSnippetService.findByHook(hookName, hookType);
  }
}
