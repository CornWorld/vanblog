import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import dayjs from 'dayjs';

interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

@ApiTags('System')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    type: Object,
  })
  healthCheck(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: dayjs().toISOString(),
      uptime: process.uptime(),
      environment: process.env['NODE_ENV'] ?? 'development',
      version: '2.0.0',
    };
  }
}
