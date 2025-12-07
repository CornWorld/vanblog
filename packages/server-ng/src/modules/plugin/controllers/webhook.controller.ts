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
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { dateStr } from '@vanblog/shared';
import { z } from 'zod';

import {
  selectWebhookSchema,
  insertWebhookSchema,
  updateWebhookSchema,
} from '@vanblog/shared/drizzle';
import { Perm } from '../../auth/permissions.decorator';
import { WebhookDto } from '../dto/webhook.dto';
import { WebhookRegistryService } from '../services/webhook-registry.service';
import { WebhookService } from '../services/webhook.service';

/**
 * Webhook 管理控制器
 *
 * 提供 Webhook 的完整生命周期管理，包括创建、查询、更新、删除、
 * 事件注册、日志查看、测试和手动触发等功能。支持多种事件类型和
 * 灵活的配置选项。
 */
@ApiTags('Webhooks')
@Controller({ path: 'webhooks', version: '2' })
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly webhookRegistryService: WebhookRegistryService,
  ) {}

  /**
   * 创建新的 Webhook
   *
   * 创建一个新的 Webhook 配置，包括 URL、事件类型、认证信息等。
   * 创建成功后会自动注册到相应的事件监听器中。
   *
   * @param createWebhookDto Webhook 创建数据
   * @returns 创建的 Webhook 信息
   */
  @Post()
  @Perm('webhook', ['create'])
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  async create(@Body() raw: unknown): Promise<WebhookDto> {
    const createWebhookDto = insertWebhookSchema.parse(raw);
    const webhook = await this.webhookService.create(createWebhookDto);
    const parsedWebhook = selectWebhookSchema.parse(webhook);
    return parsedWebhook as unknown as WebhookDto;
  }

  /**
   * 获取 Webhook 列表
   *
   * 分页查询所有 Webhook 配置，支持按名称、状态等条件过滤。
   *
   * @param query 查询参数
   * @returns 分页的 Webhook 列表
   */
  @Get()
  @Perm('webhook', ['read'])
  @ApiOperation({ summary: 'Get all webhooks' })
  @ApiResponse({ status: 200, description: 'Webhooks retrieved successfully' })
  async findAll(@Query() raw: unknown): Promise<{
    data: WebhookDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const QuerySchema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      active: z.coerce.boolean().optional(),
      event: z.string().optional(),
    });
    const query = QuerySchema.parse(raw);
    const result = await this.webhookService.findAll(query);
    const { pagination, data } = result;
    const { total, page, limit } = pagination as { total: number; page: number; limit: number };
    const webhooks = data as unknown[];
    return {
      data: webhooks.map((webhook) => selectWebhookSchema.parse(webhook) as unknown as WebhookDto),
      total,
      page,
      limit,
    };
  }

  /**
   * 获取可用的 Webhook 事件
   *
   * 返回系统支持的所有 Webhook 事件类型和分类信息。
   *
   * @returns 事件列表和分类信息
   */
  @Get('events')
  @Perm('webhook', ['read'])
  @ApiOperation({ summary: 'Get available webhook events' })
  @ApiResponse({ status: 200, description: 'Available events retrieved successfully' })
  getAvailableEvents(): { events: string[]; categories: Record<string, string[]> } {
    return {
      events: this.webhookRegistryService.getAvailableEvents(),
      categories: this.webhookRegistryService.getEventCategories(),
    };
  }

  @Get('stats')
  @Perm('webhook', ['read'])
  @ApiOperation({ summary: 'Get webhook statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'webhookId', required: false, type: Number })
  async getStats(
    @Query('webhookId', ParseIntPipe) webhookId?: number,
  ): Promise<Record<string, unknown>> {
    return this.webhookService.getStats(webhookId);
  }

  @Post('refresh')
  @Perm('webhook', ['admin'])
  @ApiOperation({ summary: 'Refresh webhook event registrations' })
  @ApiResponse({ status: 200, description: 'Webhook registrations refreshed successfully' })
  refreshRegistrations(): { message: string; events: string[] } {
    const events = this.webhookRegistryService.getAvailableEvents();
    return {
      message: 'Webhook registrations refreshed successfully',
      events,
    };
  }

  @Post(':id/register')
  @Perm('webhook', ['admin'])
  @ApiOperation({ summary: 'Manually register a webhook for events' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook registered successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async registerWebhook(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { events: string[] },
  ): Promise<{ message: string; registeredEvents: string[] }> {
    const webhook = await this.webhookService.findOne(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    this.webhookRegistryService.registerWebhook(id, body.events);
    return {
      message: 'Webhook registered successfully',
      registeredEvents: body.events,
    };
  }

  @Delete(':id/register')
  @Perm('webhook', ['admin'])
  @ApiOperation({ summary: 'Unregister a webhook from all events' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook unregistered successfully' })
  unregisterWebhook(@Param('id', ParseIntPipe) id: number): { message: string } {
    this.webhookRegistryService.unregisterWebhookFromAllEvents(id);
    return {
      message: 'Webhook unregistered from all events successfully',
    };
  }

  @Get('logs')
  @Perm('webhook', ['read'])
  @ApiOperation({ summary: 'Get webhook execution logs' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  async getLogs(@Query() raw: unknown): Promise<Record<string, unknown>> {
    const LogQuerySchema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      webhookId: z.coerce.number().optional(),
      event: z.string().optional(),
      status: z.enum(['success', 'failed', 'timeout']).optional(),
      startDate: dateStr.optional(),
      endDate: dateStr.optional(),
    });
    const query = LogQuerySchema.parse(raw);
    return this.webhookService.getLogs(query);
  }

  @Get(':id')
  @Perm('webhook', ['read'])
  @ApiOperation({ summary: 'Get a webhook by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<WebhookDto> {
    const webhook = await this.webhookService.findOne(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    const parsedWebhook = selectWebhookSchema.parse(webhook);
    return parsedWebhook as unknown as WebhookDto;
  }

  @Patch(':id')
  @Perm('webhook', ['update'])
  @ApiOperation({ summary: 'Update a webhook' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook updated successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() raw: unknown): Promise<WebhookDto> {
    const updateWebhookDto = updateWebhookSchema.parse(raw);
    const webhook = await this.webhookService.update(id, updateWebhookDto);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    const parsedWebhook = selectWebhookSchema.parse(webhook);
    return parsedWebhook as unknown as WebhookDto;
  }

  @Delete(':id')
  @Perm('webhook', ['delete'])
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.webhookService.remove(id);
    return { message: 'Webhook deleted successfully' };
  }

  /**
   * 测试 Webhook
   *
   * 使用指定的事件和数据测试 Webhook 的连通性和响应。
   * 不会触发实际的业务逻辑，仅用于验证配置是否正确。
   *
   * @param id Webhook ID
   * @param testData 测试数据，包含事件类型和载荷
   * @returns 测试结果
   */
  @Post(':id/test')
  @Perm('webhook', ['test'])
  @ApiOperation({ summary: 'Test a webhook' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook test completed' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async test(
    @Param('id', ParseIntPipe) id: number,
    @Body() testData: { event: string; payload: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    const webhook = (await this.webhookService.findOne(id)) as WebhookDto | null;
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return this.webhookService.test(id, testData);
  }

  /**
   * 手动触发 Webhook
   *
   * 手动触发指定的 Webhook，模拟真实事件的发生。
   * 与测试不同，这会执行完整的 Webhook 流程。
   *
   * @param id Webhook ID
   * @param testData 触发数据，包含事件类型和载荷
   * @returns 触发结果
   */
  @Post(':id/trigger')
  @Perm('webhook', ['trigger'])
  @ApiOperation({ summary: 'Manually trigger a webhook' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook triggered successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async trigger(
    @Param('id', ParseIntPipe) id: number,
    @Body() testData: { event: string; payload: Record<string, unknown> },
  ): Promise<{ message: string }> {
    const webhook = (await this.webhookService.findOne(id)) as WebhookDto | null;
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    // Check if the event is supported
    if (!this.webhookRegistryService.isEventSupported(testData.event)) {
      throw new NotFoundException('Event not supported');
    }

    await this.webhookRegistryService.triggerEvent(testData.event, testData.payload);

    return { message: 'Webhook triggered successfully' };
  }
}
