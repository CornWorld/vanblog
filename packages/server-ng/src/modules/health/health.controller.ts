import { Controller } from '@nestjs/common';
import { initContract } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { dayjs } from '@vanblog/shared';
import { createHealthContract } from '@vanblog/shared/contracts';

const c = initContract();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for ts-rest contract initialization type compatibility
const healthContract = createHealthContract(c as any);

@Controller()
export class HealthController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for ts-rest decorator type compatibility
  @TsRestHandler(healthContract.getHealth as any)
  getHealth(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(healthContract.getHealth, async () => {
      await Promise.resolve();
      return { status: 200 as const, body: { timestamp: dayjs().format() } };
    });
  }
}
