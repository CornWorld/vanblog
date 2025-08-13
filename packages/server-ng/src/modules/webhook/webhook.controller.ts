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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookDto,
  WebhookQueryDto,
  WebhookLogQueryDto,
  WebhookEvent,
  AVAILABLE_WEBHOOK_EVENTS,
} from './dto/webhook.dto';
import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller({ path: 'webhooks', version: '2' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly webhookRegistryService: WebhookRegistryService,
  ) {}

  @Post()
  @Permissions('webhook:create')
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully', type: WebhookDto })
  async create(@Body() createWebhookDto: CreateWebhookDto): Promise<WebhookDto> {
    const webhook = await this.webhookService.create(createWebhookDto);
    return {
      ...webhook,
      secret: webhook.secret ?? undefined,
    } as WebhookDto;
  }

  @Get()
  @Permissions('webhook:read')
  @ApiOperation({ summary: 'Get all webhooks' })
  @ApiResponse({ status: 200, description: 'Webhooks retrieved successfully' })
  async findAll(@Query() query: WebhookQueryDto): Promise<{
    data: WebhookDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.webhookService.findAll(query);
    const pagination = result.pagination as { total: number; page: number; limit: number };
    const data = result.data as Array<{ secret: string | null; [key: string]: unknown }>;
    return {
      data: data.map((webhook) => ({
        ...webhook,
        secret: webhook.secret ?? undefined,
      })) as WebhookDto[],
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  @Get('events')
  @Permissions('webhook:read')
  @ApiOperation({ summary: 'Get available webhook events' })
  @ApiResponse({ status: 200, description: 'Available events retrieved successfully' })
  getAvailableEvents(): { events: string[]; categories: Record<string, string[]> } {
    return {
      events: AVAILABLE_WEBHOOK_EVENTS,
      categories: this.webhookRegistryService.getEventCategories(),
    };
  }

  @Get('stats')
  @Permissions('webhook:read')
  @ApiOperation({ summary: 'Get webhook statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiQuery({ name: 'webhookId', required: false, type: Number })
  async getStats(
    @Query('webhookId', ParseIntPipe) webhookId?: number,
  ): Promise<Record<string, unknown>> {
    return this.webhookService.getStats(webhookId);
  }

  @Get('logs')
  @Permissions('webhook:read')
  @ApiOperation({ summary: 'Get webhook execution logs' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  async getLogs(@Query() query: WebhookLogQueryDto): Promise<Record<string, unknown>> {
    return this.webhookService.getLogs(query);
  }

  @Get(':id')
  @Permissions('webhook:read')
  @ApiOperation({ summary: 'Get a webhook by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook retrieved successfully', type: WebhookDto })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<WebhookDto> {
    const webhook = (await this.webhookService.findOne(id)) as WebhookDto | null;
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return webhook;
  }

  @Patch(':id')
  @Permissions('webhook:update')
  @ApiOperation({ summary: 'Update a webhook' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook updated successfully', type: WebhookDto })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWebhookDto: UpdateWebhookDto,
  ): Promise<WebhookDto> {
    const webhook = (await this.webhookService.update(id, updateWebhookDto)) as WebhookDto | null;
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return webhook;
  }

  @Delete(':id')
  @Permissions('webhook:delete')
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.webhookService.remove(id);
    return { message: 'Webhook deleted successfully' };
  }

  @Post(':id/test')
  @Permissions('webhook:test')
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

  @Post(':id/trigger')
  @Permissions('webhook:trigger')
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

    await this.webhookRegistryService.triggerEvent(
      testData.event as WebhookEvent,
      testData.payload,
    );

    return { message: 'Webhook triggered successfully' };
  }
}
