import { ParamType, paramsFromSchema } from './paramType.js';
import { InvalidParamTypeError } from './errors.js';
import type { JsonSchema } from './spec.js';

describe('ParamType.fromJsonSchema', () => {
  it('maps builtin refs in the tii#/$defs form', () => {
    const bytes: JsonSchema = { $ref: 'https://tx3.land/specs/v1beta0/tii#/$defs/Bytes' };
    const addr: JsonSchema = { $ref: 'https://tx3.land/specs/v1beta0/tii#/$defs/Address' };
    const utxo: JsonSchema = { $ref: 'https://tx3.land/specs/v1beta0/tii#/$defs/UtxoRef' };

    expect(ParamType.fromJsonSchema(bytes).kind).toBe('bytes');
    expect(ParamType.fromJsonSchema(addr).kind).toBe('address');
    expect(ParamType.fromJsonSchema(utxo).kind).toBe('utxoRef');
  });

  it('still maps the legacy core# ref form', () => {
    const bytes: JsonSchema = { $ref: 'https://tx3.land/specs/v1beta0/core#Bytes' };
    expect(ParamType.fromJsonSchema(bytes).kind).toBe('bytes');
  });

  it('resolves a component ref to its schema as a custom param', () => {
    const record: JsonSchema = {
      type: 'object',
      properties: { policy_id: { type: 'string' } },
    };
    const ref: JsonSchema = { $ref: '#/components/schemas/AssetClass' };

    const param = ParamType.fromJsonSchema(ref, { AssetClass: record });
    expect(param.kind).toBe('custom');
    expect(param).toEqual({ kind: 'custom', schema: record });
  });

  it('falls back to the ref schema when components are absent', () => {
    const ref: JsonSchema = { $ref: '#/components/schemas/AssetClass' };
    const param = ParamType.fromJsonSchema(ref);
    expect(param).toEqual({ kind: 'custom', schema: ref });
  });

  it('maps an inline object (record) to a custom param', () => {
    const record: JsonSchema = { type: 'object', properties: { x: { type: 'integer' } } };
    expect(ParamType.fromJsonSchema(record)).toEqual({ kind: 'custom', schema: record });
  });

  it('maps a oneOf (variant) to a custom param', () => {
    const variant: JsonSchema = { oneOf: [{ type: 'object' }] };
    expect(ParamType.fromJsonSchema(variant)).toEqual({ kind: 'custom', schema: variant });
  });

  it('throws on an unknown builtin ref', () => {
    const ref: JsonSchema = { $ref: 'https://tx3.land/specs/v1beta0/tii#/$defs/Nope' };
    expect(() => ParamType.fromJsonSchema(ref)).toThrow(InvalidParamTypeError);
  });
});

describe('paramsFromSchema', () => {
  it('threads components through to each property', () => {
    const components = { AssetClass: { type: 'object' } as JsonSchema };
    const params: JsonSchema = {
      type: 'object',
      properties: {
        asset: { $ref: '#/components/schemas/AssetClass' },
        quantity: { type: 'integer' },
      },
    };

    const map = paramsFromSchema(params, components);
    expect(map.get('asset')).toEqual({ kind: 'custom', schema: components.AssetClass });
    expect(map.get('quantity')?.kind).toBe('integer');
  });
});
