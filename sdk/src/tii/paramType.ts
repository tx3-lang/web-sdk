import type { JsonSchema } from './spec.js';

/** One case of a {@link ParamType} of kind `variant`. */
export interface VariantCase {
  tag: string;
  fields: ParamType;
}

export type ParamType =
  | { kind: 'bytes' }
  | { kind: 'integer' }
  | { kind: 'boolean' }
  | { kind: 'unit' }
  | { kind: 'utxoRef' }
  | { kind: 'address' }
  | { kind: 'utxo' }
  | { kind: 'anyAsset' }
  | { kind: 'list'; inner: ParamType }
  | { kind: 'tuple'; elements: ParamType[] }
  | { kind: 'map'; value: ParamType }
  | { kind: 'record'; fields: Record<string, ParamType> }
  | { kind: 'variant'; cases: VariantCase[] }
  | { kind: 'unknown'; schema: JsonSchema };

function isSchema(value: unknown): value is JsonSchema {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Matches a built-in core type by the trailing name of its `$ref`, so both the
 * canonical `…/tii#/$defs/<Name>` and legacy `…/core#<Name>` forms resolve. */
function coreRefType(ref: string): ParamType | undefined {
  const name = ref.split('#').pop()?.split('/').pop();
  switch (name) {
    case 'Bytes':
      return ParamType.bytes();
    case 'Address':
      return ParamType.address();
    case 'UtxoRef':
      return ParamType.utxoRef();
    case 'Utxo':
      return ParamType.utxo();
    case 'AnyAsset':
      return ParamType.anyAsset();
    default:
      return undefined;
  }
}

/** Interprets one externally-tagged `oneOf` branch into a {@link VariantCase}. */
function variantCase(
  branch: unknown,
  components?: Record<string, JsonSchema>,
): VariantCase {
  const schema = isSchema(branch) ? branch : {};
  const required = schema['required'];
  const tag =
    Array.isArray(required) && typeof required[0] === 'string' ? required[0] : '';

  let fields: ParamType = ParamType.unknown(schema);
  const properties = schema['properties'];
  if (isSchema(properties)) {
    const fieldSchema = (properties as Record<string, unknown>)[tag];
    if (isSchema(fieldSchema)) {
      fields = ParamType.fromJsonSchema(fieldSchema, components);
    }
  }
  return { tag, fields };
}

export const ParamType = {
  bytes: (): ParamType => ({ kind: 'bytes' }),
  integer: (): ParamType => ({ kind: 'integer' }),
  boolean: (): ParamType => ({ kind: 'boolean' }),
  unit: (): ParamType => ({ kind: 'unit' }),
  utxoRef: (): ParamType => ({ kind: 'utxoRef' }),
  address: (): ParamType => ({ kind: 'address' }),
  utxo: (): ParamType => ({ kind: 'utxo' }),
  anyAsset: (): ParamType => ({ kind: 'anyAsset' }),
  list: (inner: ParamType): ParamType => ({ kind: 'list', inner }),
  tuple: (elements: ParamType[]): ParamType => ({ kind: 'tuple', elements }),
  map: (value: ParamType): ParamType => ({ kind: 'map', value }),
  record: (fields: Record<string, ParamType>): ParamType => ({
    kind: 'record',
    fields,
  }),
  variant: (cases: VariantCase[]): ParamType => ({ kind: 'variant', cases }),
  unknown: (schema: JsonSchema): ParamType => ({ kind: 'unknown', schema }),

  /**
   * Interprets a JSON schema node into a {@link ParamType}. Never throws: any
   * shape it does not recognize — a bare `string`, an unresolved object, an
   * unknown `$ref` — becomes a `unknown` kind carrying the raw schema.
   * `components` is the TII's `components.schemas` table, used to resolve
   * `#/components/schemas/<Name>` references to user-defined types.
   */
  fromJsonSchema(
    schema: JsonSchema,
    components?: Record<string, JsonSchema>,
  ): ParamType {
    if (!isSchema(schema)) {
      return ParamType.unknown(schema);
    }

    const ref = schema['$ref'];
    if (typeof ref === 'string') {
      // User-defined record / variant, referenced into components.schemas.
      if (ref.includes('/components/schemas/')) {
        const name = ref.split('/').pop() as string;
        const resolved = components?.[name];
        return resolved
          ? ParamType.fromJsonSchema(resolved, components)
          : ParamType.unknown(schema);
      }
      return coreRefType(ref) ?? ParamType.unknown(schema);
    }

    // Variant: a tagged union of externally-tagged cases.
    if (Array.isArray(schema['oneOf'])) {
      return ParamType.variant(
        (schema['oneOf'] as unknown[]).map((branch) =>
          variantCase(branch, components),
        ),
      );
    }

    const type = schema['type'];
    switch (type) {
      case 'integer':
        return ParamType.integer();
      case 'boolean':
        return ParamType.boolean();
      case 'null':
        return ParamType.unit();
      // Compound array shape: a tuple carries positional `prefixItems`, a list
      // carries a single `items` element schema.
      case 'array': {
        const prefixItems = schema['prefixItems'];
        if (Array.isArray(prefixItems)) {
          return ParamType.tuple(
            prefixItems.map((el) => ParamType.fromJsonSchema(el as JsonSchema, components)),
          );
        }
        const items = schema['items'];
        if (isSchema(items)) {
          return ParamType.list(ParamType.fromJsonSchema(items, components));
        }
        return ParamType.unknown(schema);
      }
      // Object shape: `additionalProperties` is a map; `properties` is a record.
      case 'object': {
        const additional = schema['additionalProperties'];
        if (isSchema(additional)) {
          return ParamType.map(ParamType.fromJsonSchema(additional, components));
        }
        const properties = schema['properties'];
        if (isSchema(properties)) {
          const fields: Record<string, ParamType> = {};
          for (const [key, value] of Object.entries(
            properties as Record<string, unknown>,
          )) {
            fields[key] = isSchema(value)
              ? ParamType.fromJsonSchema(value, components)
              : ParamType.unknown(schema);
          }
          return ParamType.record(fields);
        }
        return ParamType.unknown(schema);
      }
      default:
        return ParamType.unknown(schema);
    }
  },
};

export type ParamMap = Map<string, ParamType>;

export function paramsFromSchema(
  schema: JsonSchema,
  components?: Record<string, JsonSchema>,
): ParamMap {
  const params: ParamMap = new Map();
  const properties = schema['properties'];
  if (isSchema(properties)) {
    for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
      params.set(
        key,
        isSchema(value)
          ? ParamType.fromJsonSchema(value, components)
          : ParamType.unknown(schema),
      );
    }
  }
  return params;
}
