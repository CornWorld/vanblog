import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { AuthService } from './auth.service';

@Controller()
export class AuthTsRestController {
  constructor(private readonly authService: AuthService) {}

  @TsRestHandler(contract.login)
  login(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.login, async ({ body }) => {
      const { name, password } = body;
      const user = await this.authService.validateUser(name, password);
      if (!user) {
        return { status: 401, body: { message: 'Invalid credentials' } };
      }
      const result = this.authService.login(user);
      return { status: 200, body: { token: result.access_token } };
    });
  }

  @TsRestHandler(contract.logout)
  logout(): ReturnType<typeof tsRestHandler> {
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
