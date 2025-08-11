import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfig } from '../../../config/config.interface';

@Injectable()
export class DemoModeGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AllConfig>) {}

  canActivate(_context: ExecutionContext): boolean {
    const isDemoMode = this.configService.get('runtime.demoMode', { infer: true });

    if (isDemoMode) {
      throw new ForbiddenException('This operation is not allowed in demo mode');
    }

    return true;
  }
}
