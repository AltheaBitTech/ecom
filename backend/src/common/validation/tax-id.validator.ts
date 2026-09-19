import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidGstin, isValidPan } from './gstin';

@ValidatorConstraint({ name: 'isGstin', async: false })
class IsGstinConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidGstin(value);
  }
  defaultMessage(): string {
    return 'gstin must be a valid GSTIN';
  }
}

@ValidatorConstraint({ name: 'isPan', async: false })
class IsPanConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidPan(value);
  }
  defaultMessage(): string {
    return 'pan must be a valid PAN';
  }
}

/** Validates a GSTIN's format and checksum. Combine with @IsOptional() for optional fields. */
export function IsGstin(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsGstinConstraint,
    });
  };
}

/** Validates a PAN's format (no checksum exists for PAN). Combine with @IsOptional() for optional fields. */
export function IsPan(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPanConstraint,
    });
  };
}
