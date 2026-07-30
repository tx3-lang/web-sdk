//! Type-directed argument encoding into the TRP `TaggedArg` wire form.
//!
//! A TRP resolve request carries an **untyped** TIR, so the resolver cannot
//! recover the structure of an aggregate argument (record, list, tuple, map) on
//! its own. The full type lives in the `.tii`, a client-side artifact — so the
//! SDK is authoritative: it walks the resolved `ParamType` alongside the user
//! value and emits the self-describing `TaggedArg` (single-key tagged,
//! recursive — see the `TaggedArg` schema in `core/trp/v1beta0/trp.json` and the
//! SDK spec's `api-surface/args.md`). The resolver then decodes it structurally,
//! without a schema.
//!
//! This is **one** recursive walk over `(type, value)`; scalars are just the leaf
//! cases. A scalar leaf at the top level renders **bare** (the resolver coerces
//! it via the flat TIR type); the same scalar nested inside an aggregate renders
//! **tagged**, because the resolver has no element/field type there.

import { bytesToHex } from '../core/bytes.js';
import { EncodeError } from './errors.js';
import type { ParamType, VariantCase } from './paramType.js';

/** The JSON shape name of a value, for {@link EncodeError} messages. */
function shapeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function wrongShape(kind: string, expected: string, got: unknown): EncodeError {
  return new EncodeError(
    `expected ${expected} for a \`${kind}\` argument, got \`${shapeOf(got)}\``,
  );
}

/**
 * Marshals an argument `value` to its TRP wire form, directed by `param`.
 *
 * One recursive walk over `(type, value)`. A scalar leaf renders bare at the top
 * level — the resolver coerces it via the param's flat type — and tagged when it
 * sits inside an aggregate, where the resolver has no element type. Aggregates
 * always render to their tagged structural form.
 *
 * Throws an {@link EncodeError} if `value`'s shape cannot match `param`.
 */
export function encode(param: ParamType, value: unknown): unknown {
  return marshal(param, value, false);
}

/**
 * `nested` is true when `value` sits inside an aggregate, where scalar leaves
 * must be tagged for the schema-less resolver.
 */
function marshal(param: ParamType, value: unknown, nested: boolean): unknown {
  switch (param.kind) {
    // Scalar leaves: bare at the top level, tagged when nested. Shape checks here
    // are the "reject before sending" pass; the resolver still performs the
    // authoritative coercion.
    case 'integer':
      // number or decimal/hex string.
      if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') {
        return leaf('int', value, nested);
      }
      throw wrongShape('integer', 'number or decimal/hex string', value);
    case 'boolean':
      // Accept the lenient forms the resolver coerces (bool, 0/1, "true"/"false").
      if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        return leaf('bool', value, nested);
      }
      throw wrongShape('boolean', 'bool', value);
    case 'bytes': {
      // A native byte array (`Uint8Array`, or an integer array — the JSON shape
      // other SDKs' native byte arrays serialize to) canonicalizes to
      // 0x-prefixed hex, the wire form the resolver coerces (SDK spec §3.9).
      const raw = asByteArray(value);
      if (raw !== undefined) {
        return leaf('bytes', `0x${bytesToHex(raw)}`, nested);
      }
      // Hex string or a BytesEnvelope object.
      if (typeof value === 'string' || isObject(value)) {
        return leaf('bytes', value, nested);
      }
      throw wrongShape('bytes', 'hex string, bytes envelope, or byte array', value);
    }
    case 'address':
      if (typeof value === 'string') return leaf('address', value, nested);
      throw wrongShape('address', 'bech32 or hex string', value);
    case 'utxoRef':
      if (typeof value === 'string') return leaf('utxoRef', value, nested);
      throw wrongShape('utxoRef', 'txid#index string', value);

    // A unit field has no payload; it lowers to a nullary struct.
    case 'unit':
      return { struct: { constructor: 0, fields: [] } };

    case 'list': {
      if (!Array.isArray(value)) throw wrongShape('list', 'array', value);
      return { list: value.map((v) => marshal(param.inner, v, true)) };
    }

    case 'tuple': {
      if (!Array.isArray(value)) throw wrongShape('tuple', 'array', value);
      if (value.length !== param.elements.length) {
        throw new EncodeError(
          `tuple arity mismatch: expected ${param.elements.length} element(s), got ${value.length}`,
        );
      }
      return { tuple: param.elements.map((t, i) => marshal(t, value[i], true)) };
    }

    case 'map': {
      if (!isObject(value)) throw wrongShape('map', 'object', value);
      // The `.tii` erases the Tx3 key type (JSON object keys are strings), so keys
      // are carried as `string` leaves. Sort by key for a deterministic,
      // language-neutral pair order.
      const keys = Object.keys(value).sort();
      const pairs = keys.map((k) => [{ string: k }, marshal(param.value, value[k], true)]);
      return { map: pairs };
    }

    // A record is constructor 0; a variant resolves its case index. Both emit the
    // same positional `struct` form.
    case 'record':
      return {
        struct: { constructor: 0, fields: encodeRecordFields(param.fields, value) },
      };

    case 'variant':
      return encodeVariant(param.cases, value);

    // No wire-leaf form and no element types to drive encoding: pass the value
    // through and let the resolver coerce it via the flat type.
    case 'utxo':
    case 'anyAsset':
    case 'unknown':
      return value;
  }
}

/**
 * Interprets a value as a raw byte array: a `Uint8Array`, or an array whose
 * every element is an integer in `0..=255`. `undefined` if it is neither.
 */
function asByteArray(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) return value;
  if (
    Array.isArray(value) &&
    value.every((b) => typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= 255)
  ) {
    return Uint8Array.from(value as number[]);
  }
  return undefined;
}

/**
 * Renders a scalar leaf: bare at the top level (the resolver knows the param's
 * type), tagged when nested inside an aggregate (it doesn't).
 */
function leaf(tag: string, value: unknown, nested: boolean): unknown {
  return nested ? { [tag]: value } : value;
}

/**
 * Encodes a record's fields **positionally** in declared order, mapping the
 * user's by-name object. Rejects missing or extra fields up front.
 */
function encodeRecordFields(
  fields: ReadonlyArray<readonly [string, ParamType]>,
  value: unknown,
): unknown[] {
  if (!isObject(value)) throw wrongShape('record', 'object', value);

  // Reject any field the record does not declare.
  for (const key of Object.keys(value)) {
    if (!fields.some(([name]) => name === key)) {
      throw new EncodeError(`unknown record field \`${key}\``);
    }
  }

  return fields.map(([name, ty]) => {
    if (!(name in value)) throw new EncodeError(`missing record field \`${name}\``);
    return marshal(ty, value[name], true);
  });
}

/**
 * Encodes an externally-tagged variant value `{ "<Case>": <payload> }` into a
 * `struct` whose `constructor` is the case index from the `.tii` `oneOf` order.
 */
function encodeVariant(cases: VariantCase[], value: unknown): unknown {
  if (!isObject(value)) throw badVariant();
  const tags = Object.keys(value);
  if (tags.length !== 1) throw badVariant();
  const tag = tags[0];
  const payload = value[tag];

  const index = cases.findIndex((c) => c.tag === tag);
  if (index < 0) throw new EncodeError(`unknown variant case \`${tag}\``);

  // A case payload is a record (possibly empty). Encode its fields positionally
  // and stamp the case index as the constructor.
  const caseFields = cases[index].fields;
  const fields =
    caseFields.kind === 'record'
      ? encodeRecordFields(caseFields.fields, payload)
      : // Defensive: a non-record payload encodes as the single field.
        [marshal(caseFields, payload, true)];

  return { struct: { constructor: index, fields } };
}

function badVariant(): EncodeError {
  return new EncodeError('variant value must be a single-key object naming the case');
}
