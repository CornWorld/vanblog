import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

export const tsRestClient = initClient(contract, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  baseHeaders: {},
});
