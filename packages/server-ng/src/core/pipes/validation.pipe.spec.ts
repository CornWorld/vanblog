import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ValidationPipe } from './validation.pipe';
import { IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { describe, it, expect, beforeEach } from 'vitest';

class TestDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  age!: number;
}

describe('ValidationPipe', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe();
  });

  it('should pass validation for valid data', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: TestDto,
      data: '',
    };

    const validData = { name: 'John', age: 25 };
    const result = (await pipe.transform(validData, metadata)) as TestDto;

    expect(result).toBeInstanceOf(TestDto);
    expect(result.name).toBe('John');
    expect(result.age).toBe(25);
  });

  it('should throw BadRequestException for invalid data', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: TestDto,
      data: '',
    };

    const invalidData = { name: 123, age: -5 };

    await expect(pipe.transform(invalidData, metadata)).rejects.toThrow(BadRequestException);
  });

  it('should not validate primitive types', async () => {
    const metadata: ArgumentMetadata = {
      type: 'custom',
      metatype: String,
      data: '',
    };

    const result = await pipe.transform('test', metadata);
    expect(result).toBe('test');
  });

  it('should reject non-whitelisted properties', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: TestDto,
      data: '',
    };

    const dataWithExtraProps = {
      name: 'John',
      age: 25,
      extraProp: 'should be rejected',
    };

    // Since forbidNonWhitelisted is true, it should throw an error
    await expect(pipe.transform(dataWithExtraProps, metadata)).rejects.toThrow(BadRequestException);
  });

  it('should transform and validate data correctly', async () => {
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: TestDto,
      data: '',
    };

    const validData = { name: 'John', age: '25' }; // age as string to test transform
    const result = (await pipe.transform(validData, metadata)) as TestDto;

    expect(result).toBeInstanceOf(TestDto);
    expect(result.name).toBe('John');
    expect(result.age).toBe(25); // Should be transformed to number
  });
});
