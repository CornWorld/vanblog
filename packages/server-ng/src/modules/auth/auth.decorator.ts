import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permissions } from './permissions.decorator';

export function RequireAuth(...permissions: string[]): MethodDecorator & ClassDecorator {
  const decorators = [
    UseGuards(JwtAuthGuard, PermissionsGuard),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
  ];

  if (permissions.length > 0) {
    decorators.push(Permissions(...permissions));
    decorators.push(
      ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' }),
    );
  }

  return applyDecorators(...decorators);
}

export function RequireAdmin(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden - Admin access only' }),
  );
}
