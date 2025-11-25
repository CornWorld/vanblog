import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { AuthService } from './auth.service';

@Controller()
export class AuthTsRestController {
  constructor(private readonly authService: AuthService) {}

  @TsRestHandler(contract.login)
  login(): TsRestHandler<typeof contract.login> {
    return tsRestHandler(contract.login, async ({ body }) => {
      const user = await this.authService.validateUser(
        (body as { name: string }).name,
        (body as { password: string }).password,
      );
      if (!user) {
        return { status: 401, body: { message: 'Invalid credentials' } as unknown as never };
      }
      const result = this.authService.login(user);
      return { status: 200, body: { token: result.access_token } };
    });
  }

  @TsRestHandler(contract.logout)
  logout(): TsRestHandler<typeof contract.logout> {
    return tsRestHandler(contract.logout, async ({ headers }) => {
      const authHeader = headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (token) {
        await this.authService.revokeToken(token);
      }
      return { status: 200, body: { success: true } };
    });
  }
}
