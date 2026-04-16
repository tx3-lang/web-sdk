import { InvalidParamTypeError } from './errors.js';
import type { JsonSchema } from './spec.js';

export type ParamType =
  | { kind: 'bytes' }
  | { kind: 'integer' }
  | { kind: 'boolean' }
  | { kind: 'utxoRef' }
  | { kind: 'address' }
  | { kind: 'list'; inner: ParamType }
  | { kind: 'custom'; schema: JsonSchema };

export const ParamType = {
  bytes: (): ParamType => ({ kind: 'bytes' }),
  integer: (): ParamType => ({ kind: 'integer' }),
  boolean: (): ParamType => ({ kind: 'boolean' }),
  utxoRef: (): ParamType => ({ kind: 'utxoRef' }),
  address: (): ParamType => ({ kind: 'address' }),
  list: (inner: ParamType): ParamType => ({ kind: 'list', inner }),
  custom: (schema: JsonSchema): ParamType => ({ kind: 'custom', schema }),

  fromJsonSchema(schema: JsonSchema): ParamType {
    const ref = schema['$ref'];
    if (typeof ref === 'string') {
      switch (ref) {
        case 'https://tx3.land/specs/v1beta0/core#Bytes':
          return ParamType.bytes();
        case 'https://tx3.land/specs/v1beta0/core#Address':
          return ParamType.address();
        case 'https://tx3.land/specs/v1beta0/core#UtxoRef':
          return ParamType.utxoRef();
        default:
          throw new InvalidParamTypeError(`unknown $ref: ${ref}`);
      }
    }

    const type = schema['type'];
    if (typeof type === 'string') {
      switch (type) {
        case 'integer':
          return ParamType.integer();
        case 'boolean':
          return ParamType.boolean();
        default:
          throw new InvalidParamTypeError(`unsupported type: ${type}`);
      }
    }

    throw new InvalidParamTypeError();
  },
};

export type ParamMap = Map<string, ParamType>;

export function paramsFromSchema(schema: JsonSchema): ParamMap {
  const params: ParamMap = new Map();
  const properties = schema['properties'];
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new InvalidParamTypeError(`property ${key} is not a schema object`);
      }
      params.set(key, ParamType.fromJsonSchema(value as JsonSchema));
    }
  }
  return params;
}
