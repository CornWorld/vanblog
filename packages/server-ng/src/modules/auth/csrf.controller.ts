import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * CSRF Controller
 *
 * Provides CSRF token generation endpoint for CSRF protection.
 */
@ApiTags('auth')
@Controller('auth')
export class CsrfController {
  @Get('csrf-token')
  @ApiOperation({ summary: 'Get CSRF token' })
  @ApiResponse({
    status: 200,
    description: 'CSRF token for form submissions',
    schema: {
      type: 'object',
      properties: {
        csrfToken: {
          type: 'string',
          description: 'CSRF token for validation',
        },
      },
    },
  })
  getCsrfToken(): { csrfToken: string } {
    // Generate a simple random token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    return {
      csrfToken: token,
    };
  }
}
