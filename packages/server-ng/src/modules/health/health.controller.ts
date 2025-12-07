import { Controller } from '@nestjs/common';
import { initContract } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { dayjs } from '@vanblog/shared';
import { createHealthContract } from '@vanblog/shared/contracts/health.contract';

const c = initContract();
const healthContract = createHealthContract(c);

@Controller()
export class HealthController {
  @TsRestHandler(healthContract.getHealth)
  getHealth(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(healthContract.getHealth, async () => ({
      status: 200 as const,
      body: { timestamp: dayjs().format() },
    }));
  }
}
