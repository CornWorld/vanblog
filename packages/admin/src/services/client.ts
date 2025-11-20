import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

export const client = initClient(contract, {
  baseUrl: '/api',
  baseHeaders: {
    // Add auth headers if needed
  },
});
