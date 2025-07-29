import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

type Constructor<T = object> = new (...args: unknown[]) => T;
type MetaType = typeof String | typeof Boolean | typeof Number | typeof Array | typeof Object;

@Injectable()
export class ValidationPipe implements PipeTransform {
  async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype as Constructor, value as Record<string, unknown>);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const messages = this.buildErrorMessage(errors);
      throw new BadRequestException(messages);
    }

    return object;
  }

  private toValidate(metatype: unknown): boolean {
    const types: MetaType[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype as MetaType);
  }

  private buildErrorMessage(errors: ValidationError[]): string[] {
    return errors.map((err) => {
      const constraints = err.constraints ?? {};
      return Object.values(constraints).join(', ');
    });
  }
}
