import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { PermissionService, ModulePermissionInfo } from '../permission.service';

@ApiTags('permission-demo')
@Controller({ path: 'permission-demo', version: '2' })
export class PermissionDemoController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('modules')
  @ApiOperation({ summary: 'Get all module permissions' })
  @ApiResponse({ status: 200, description: 'Module permissions retrieved successfully' })
  getAllModulePermissions(): Record<string, ModulePermissionInfo> {
    return this.permissionService.getAllModulePermissions();
  }

  @Get('modules/:module')
  @ApiOperation({ summary: 'Get specific module permissions' })
  @ApiResponse({ status: 200, description: 'Module permissions retrieved successfully' })
  getModulePermissions(module: string): string[] {
    return this.permissionService.getModulePermissions(module);
  }

  @Get('modules/:module/semantic')
  @ApiOperation({ summary: 'Get specific module semantic permissions' })
  @ApiResponse({ status: 200, description: 'Module semantic permissions retrieved successfully' })
  getModuleSemanticPermissions(module: string): string[] {
    return this.permissionService.getModuleSemanticPermissions(module);
  }
}
