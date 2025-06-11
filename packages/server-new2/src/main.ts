import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// @ts-expect-error import.meta.env is not available in the test environment
if (import.meta.env.PROD) {
  async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
  }

  bootstrap();
}

export const viteNodeApp = NestFactory.create(AppModule);
