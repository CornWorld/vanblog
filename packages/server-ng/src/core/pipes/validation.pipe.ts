import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform {
  async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    if (errors.length > 0) {
      const messages = this.buildErrorMessage(errors);
      throw new BadRequestException(messages);
    }

    return object;
  }

  private toValidate(metatype: unknown): boolean {
    const types = [String, Boolean, Number, Array, Object];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !types.includes(metatype as any);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildErrorMessage(errors: Array<Record<string, any>>): string[] {
    return errors.map((err) => {
      const constraints = err.constraints ?? {};
      return Object.values(constraints as Record<string, string>).join(', ');
    });
  }
}
