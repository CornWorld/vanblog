import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

export const client = initClient(contract, {
  baseUrl: '/api/v2',
  baseHeaders: {
    // Add auth headers if needed
  },
});
