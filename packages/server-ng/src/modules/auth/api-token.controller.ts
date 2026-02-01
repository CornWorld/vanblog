import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { ApiTokenService } from './api-token.service';
import { Permission } from './permissions.decorator';

@ApiTags('Auth')
@Controller({ path: 'admin/tokens', version: '2' })
export class ApiTokenController {
  constructor(private readonly apiTokenService: ApiTokenService) {}

  @TsRestHandler(contract.getTokens)
  @Permission('user', ['read'])
  getTokens_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getTokens, async () => {
      const tokens = await this.apiTokenService.getAllTokens();
      return { status: 200, body: tokens };
    });
  }

  @TsRestHandler(contract.createToken)
  @Permission('user', ['create'])
  createToken_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createToken, async ({ body }) => {
      const token = await this.apiTokenService.createToken(body.name);
      return { status: 201, body: token };
    });
  }

  @TsRestHandler(contract.deleteToken)
  @Permission('user', ['delete'])
  deleteToken_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteToken, async ({ params }) => {
      const { id } = params;
      const success = await this.apiTokenService.deleteToken(id);
      return { status: 200, body: { success } };
    });
  }
}
