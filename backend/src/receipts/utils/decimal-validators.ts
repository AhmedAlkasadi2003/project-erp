import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Prisma } from '@prisma/client';

@ValidatorConstraint({ async: false })
export class IsPositiveDecimalConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    try {
      const dec = new Prisma.Decimal(value as number | string);
      return !dec.isNaN() && dec.isPositive() && !dec.isZero();
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a strictly positive decimal number (greater than 0)`;
  }
}

@ValidatorConstraint({ async: false })
export class IsNonNegativeDecimalConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    try {
      const dec = new Prisma.Decimal(value as number | string);
      return !dec.isNaN() && (dec.isPositive() || dec.isZero());
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a non-negative decimal number (0 or greater)`;
  }
}

export function IsPositiveDecimal(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveDecimalConstraint,
    });
  };
}

export function IsNonNegativeDecimal(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNonNegativeDecimalConstraint,
    });
  };
}
