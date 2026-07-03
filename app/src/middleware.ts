import { createVanblogMiddleware } from '@vanblog/sdk/server';

export const onRequest = createVanblogMiddleware({
  pbUrl: 'http://127.0.0.1:8090',
});
