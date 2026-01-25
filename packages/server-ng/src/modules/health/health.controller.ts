import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Health Check Controller
 *
 * Provides a simple health check endpoint
 * - /health (without global prefix when fullConfig=false)
 * - /api/health (with global prefix when fullConfig=true)
 */
@ApiTags('health')
@Controller({ path: 'health' })
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        timestamp: {
          type: 'string',
          description: 'ISO 8601 timestamp',
        },
      },
    },
  })
  healthCheck(): { timestamp: string } {
    return {
      timestamp: new Date().toISOString(),
    };
  }
}
