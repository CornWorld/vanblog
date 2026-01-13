import { Controller } from '@nestjs/common';
import { initContract } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { createLoginLogContract } from '@vanblog/shared/contracts';

import { LoginLogQueryDto } from './dto/login-log.dto';
import { LoginLogService } from './login-log.service';

const c = initContract();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for ts-rest contract initialization type compatibility
const loginLogContract = createLoginLogContract(c as any);

@Controller()
export class LoginLogTsRestController {
  constructor(private readonly loginLogService: LoginLogService) {}

  @TsRestHandler(loginLogContract.getLoginLogs)
  getLoginLogs(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(loginLogContract.getLoginLogs, async ({ query }) => {
      try {
        const { username, success, startDate, endDate } = query;
        const q: LoginLogQueryDto = {
          username,
          success,
          startDate,
          endDate,
        };
        const result = await this.loginLogService.getLogs(q);
        return { status: 200, body: result };
      } catch (_err) {
        return { status: 200, body: [] };
      }
    });
  }

  @TsRestHandler(loginLogContract.getRecentFailedAttemptsByUsername)
  getRecentFailedAttemptsByUsername(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(loginLogContract.getRecentFailedAttemptsByUsername, async ({ query }) => {
      try {
        const minutes = query.cutoffMinutes ?? 30;
        const count = await this.loginLogService.getRecentFailedAttempts(query.username, minutes);
        return { status: 200, body: { count } };
      } catch (_err) {
        return { status: 200, body: { count: 0 } };
      }
    });
  }

  @TsRestHandler(loginLogContract.getRecentFailedAttemptsByIp)
  getRecentFailedAttemptsByIp(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(loginLogContract.getRecentFailedAttemptsByIp, async ({ query }) => {
      try {
        const minutes = query.cutoffMinutes ?? 30;
        const count = await this.loginLogService.getRecentFailedAttemptsByIp(query.ip, minutes);
        return { status: 200, body: { count } };
      } catch (_err) {
        return { status: 200, body: { count: 0 } };
      }
    });
  }
}
