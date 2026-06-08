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

  fromJsonSchema(
    schema: JsonSchema,
    components?: Record<string, JsonSchema>,
  ): ParamType {
    const ref = schema['$ref'];
    if (typeof ref === 'string') {
      // User-defined record / variant, referenced into components.schemas.
      if (ref.includes('/components/schemas/')) {
        const name = ref.split('/').pop() as string;
        return ParamType.custom(components?.[name] ?? schema);
      }
      // Builtin core type, matched by trailing name so both the
      // `…/tii#/$defs/<Name>` and legacy `…/core#<Name>` forms resolve.
      const name = ref.split('#').pop()?.split('/').pop();
      switch (name) {
        case 'Bytes':
          return ParamType.bytes();
        case 'Address':
          return ParamType.address();
        case 'UtxoRef':
          return ParamType.utxoRef();
        default:
          throw new InvalidParamTypeError(`unknown $ref: ${ref}`);
      }
    }

    // Variant: a tagged union of cases.
    if (Array.isArray(schema['oneOf'])) {
      return ParamType.custom(schema);
    }

    const type = schema['type'];
    if (typeof type === 'string') {
      switch (type) {
        case 'integer':
          return ParamType.integer();
        case 'boolean':
          return ParamType.boolean();
        // Inline record / custom object shape.
        case 'object':
          return ParamType.custom(schema);
        default:
          throw new InvalidParamTypeError(`unsupported type: ${type}`);
      }
    }

    throw new InvalidParamTypeError();
  },
};

export type ParamMap = Map<string, ParamType>;

export function paramsFromSchema(
  schema: JsonSchema,
  components?: Record<string, JsonSchema>,
): ParamMap {
  const params: ParamMap = new Map();
  const properties = schema['properties'];
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new InvalidParamTypeError(`property ${key} is not a schema object`);
      }
      params.set(key, ParamType.fromJsonSchema(value as JsonSchema, components));
    }
  }
  return params;
}
