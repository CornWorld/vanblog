import { Injectable, OnModuleInit } from '@nestjs/common';

import { HookService } from '../plugin/services/hook.service';

import { TokenService } from './token.service';

@Injectable()
export class PasswordChangeHandlerService implements OnModuleInit {
  constructor(
    private readonly hookService: HookService,
    private readonly tokenService: TokenService,
  ) {}

  onModuleInit(): void {
    // Register hook to handle password changes
    this.hookService.addAction('user.passwordChanged', (data: unknown) => {
      const { userId } = data as { userId: number };
      // Revoke all tokens for the user when password is changed
      this.tokenService.revokeAllUserTokens(userId);
    });
  }
}
