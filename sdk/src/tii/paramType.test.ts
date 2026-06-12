import { ParamType, paramsFromSchema } from './paramType.js';
import type { JsonSchema } from './spec.js';

const TII = 'https://tx3.land/specs/v1beta0/tii#/$defs/';
const CORE = 'https://tx3.land/specs/v1beta0/core#';

describe('ParamType.fromJsonSchema', () => {
  it('maps primitives and unit', () => {
    expect(ParamType.fromJsonSchema({ type: 'integer' }).kind).toBe('integer');
    expect(ParamType.fromJsonSchema({ type: 'boolean' }).kind).toBe('boolean');
    expect(ParamType.fromJsonSchema({ type: 'null' }).kind).toBe('unit');
  });

  it.each([TII, CORE])('maps every core $ref by trailing name (%s)', (prefix) => {
    const cases: Array<[string, ParamType['kind']]> = [
      ['Bytes', 'bytes'],
      ['Address', 'address'],
      ['UtxoRef', 'utxoRef'],
      ['Utxo', 'utxo'],
      ['AnyAsset', 'anyAsset'],
    ];
    for (const [name, kind] of cases) {
      expect(ParamType.fromJsonSchema({ $ref: prefix + name }).kind).toBe(kind);
    }
  });

  it('maps an array with `items` to a nested list', () => {
    const list: JsonSchema = {
      type: 'array',
      items: { type: 'array', items: { type: 'boolean' } },
    };
    expect(ParamType.fromJsonSchema(list)).toEqual({
      kind: 'list',
      inner: { kind: 'list', inner: { kind: 'boolean' } },
    });
  });

  it('maps an array with `prefixItems` (and `items: false`) to a tuple', () => {
    const tuple: JsonSchema = {
      type: 'array',
      prefixItems: [{ type: 'integer' }, { $ref: `${TII}Bytes` }],
      items: false,
    };
    expect(ParamType.fromJsonSchema(tuple)).toEqual({
      kind: 'tuple',
      elements: [{ kind: 'integer' }, { kind: 'bytes' }],
    });
  });

  it('maps an object with `additionalProperties` to a map', () => {
    const map: JsonSchema = {
      type: 'object',
      additionalProperties: { type: 'integer' },
    };
    expect(ParamType.fromJsonSchema(map)).toEqual({
      kind: 'map',
      value: { kind: 'integer' },
    });
  });

  it('maps an object with `properties` to a record', () => {
    const record: JsonSchema = {
      type: 'object',
      properties: { price: { type: 'integer' }, live: { type: 'boolean' } },
      required: ['price', 'live'],
    };
    expect(ParamType.fromJsonSchema(record)).toEqual({
      kind: 'record',
      fields: { price: { kind: 'integer' }, live: { kind: 'boolean' } },
    });
  });

  it('maps a oneOf to an externally-tagged variant', () => {
    const variant: JsonSchema = {
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['Buy'],
          properties: { Buy: { type: 'object', properties: {}, required: [] } },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['Sell'],
          properties: {
            Sell: {
              type: 'object',
              properties: { price: { type: 'integer' } },
              required: ['price'],
            },
          },
        },
      ],
    };
    const param = ParamType.fromJsonSchema(variant);
    expect(param.kind).toBe('variant');
    if (param.kind !== 'variant') throw new Error('unreachable');
    expect(param.cases.map((c) => c.tag)).toEqual(['Buy', 'Sell']);
    expect(param.cases[1].fields).toEqual({
      kind: 'record',
      fields: { price: { kind: 'integer' } },
    });
  });

  it('resolves a component ref into components.schemas and recurses', () => {
    const components = {
      AssetClass: {
        type: 'object',
        properties: { policy: { $ref: `${TII}Bytes` } },
        required: ['policy'],
      } as JsonSchema,
    };
    const ref: JsonSchema = { $ref: '#/components/schemas/AssetClass' };
    expect(ParamType.fromJsonSchema(ref, components)).toEqual({
      kind: 'record',
      fields: { policy: { kind: 'bytes' } },
    });
  });

  it('falls back to unknown rather than throwing', () => {
    // unresolved component ref
    expect(ParamType.fromJsonSchema({ $ref: '#/components/schemas/Nope' }).kind).toBe('unknown');
    // unknown builtin ref
    expect(ParamType.fromJsonSchema({ $ref: `${TII}Nope` }).kind).toBe('unknown');
    // bare string is genuinely untyped — must NOT become address
    expect(ParamType.fromJsonSchema({ type: 'string' }).kind).toBe('unknown');
    // array with neither items nor prefixItems
    expect(ParamType.fromJsonSchema({ type: 'array' }).kind).toBe('unknown');
    // empty / object without properties
    expect(ParamType.fromJsonSchema({}).kind).toBe('unknown');
  });
});

describe('paramsFromSchema', () => {
  it('threads components through to each property', () => {
    const components = {
      AssetClass: {
        type: 'object',
        properties: { policy: { $ref: `${TII}Bytes` } },
      } as JsonSchema,
    };
    const params: JsonSchema = {
      type: 'object',
      properties: {
        asset: { $ref: '#/components/schemas/AssetClass' },
        quantity: { type: 'integer' },
      },
    };

    const map = paramsFromSchema(params, components);
    expect(map.get('asset')).toEqual({
      kind: 'record',
      fields: { policy: { kind: 'bytes' } },
    });
    expect(map.get('quantity')?.kind).toBe('integer');
  });
});
