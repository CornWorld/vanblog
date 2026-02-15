import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Perm } from '../auth/permissions.decorator';

@ApiTags('ISR')
@Controller({ path: 'isr', version: '2' })
export class IsrController {
  /**
   * Standard NestJS route for ISR trigger
   */
  @Post('trigger')
  @Perm({ authOnly: true, roles: ['admin'] })
  @ApiOperation({ summary: 'Trigger ISR rebuild' })
  @ApiResponse({ status: 200, description: 'ISR triggered successfully' })
  triggerISRStd(): { success: boolean } {
    return { success: true };
  }
}
