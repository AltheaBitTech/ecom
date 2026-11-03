import { Injectable } from '@nestjs/common';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import { AppException } from '../../common/errors/app-exception';

/**
 * Validates a product's `customAttributes` against the TENANT'S OWN JSON Schema
 * (`TenantSettings.productAttributeSchema`). This is the mechanism that keeps
 * the platform category-agnostic: a grocery tenant's schema requires
 * `expiry_date` (format: date); an apparel tenant's requires `size`/`color`
 * enums. The engine compiles and applies whatever schema the tenant configured
 * and never references a specific attribute key.
 *
 * Compiled validators are cached by schema identity so repeated writes for a
 * tenant don't recompile.
 */
@Injectable()
export class AttributeValidatorService {
  private readonly ajv: Ajv;
  private readonly cache = new Map<string, ValidateFunction>();

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false, removeAdditional: false });
    addFormats(this.ajv);
  }

  /**
   * Validate `attributes` against `schema`. An empty/absent schema means the
   * tenant hasn't constrained attributes yet — any object is accepted. Throws
   * `invalid_custom_attributes` (422) with a readable list of violations.
   */
  validate(schema: unknown, attributes: Record<string, unknown>): void {
    if (!this.isUsableSchema(schema)) return;

    const validate = this.compile(schema as Record<string, unknown>);
    if (!validate(attributes)) {
      const details = (validate.errors ?? [])
        .map((e) => `${e.instancePath || '(root)'} ${e.message}`.trim())
        .join('; ');
      throw new AppException(
        'invalid_custom_attributes',
        `custom_attributes do not match this store's product schema: ${details}`,
        422,
      );
    }
  }

  private isUsableSchema(schema: unknown): boolean {
    return (
      typeof schema === 'object' &&
      schema !== null &&
      Object.keys(schema as Record<string, unknown>).length > 0
    );
  }

  private compile(schema: Record<string, unknown>): ValidateFunction {
    const key = JSON.stringify(schema);
    let validate = this.cache.get(key);
    if (!validate) {
      try {
        validate = this.ajv.compile(schema);
      } catch (err) {
        throw new AppException(
          'invalid_attribute_schema',
          `The store's product attribute schema is not a valid JSON Schema: ${(err as Error).message}`,
          400,
        );
      }
      this.cache.set(key, validate);
    }
    return validate;
  }
}
