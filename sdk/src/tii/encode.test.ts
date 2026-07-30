import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode } from './encode.js';
import { EncodeError } from './errors.js';
import { ParamType } from './paramType.js';
import type { JsonSchema } from './spec.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface AcceptVector {
  name: string;
  schema: JsonSchema;
  value: unknown;
  tagged: unknown;
}

interface RejectVector {
  name: string;
  schema: JsonSchema;
  value: unknown;
  reason: string;
}

interface WireVectors {
  components: Record<string, JsonSchema>;
  accept: AcceptVector[];
  reject: RejectVector[];
}

// The shared cross-language oracle for the `TaggedArg` wire form, copied from
// the umbrella's sdk-spec into this SDK's fixtures.
const vectors: WireVectors = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../tests/fixtures/wire-vectors.json'), 'utf8'),
);

const paramType = (schema: JsonSchema): ParamType =>
  ParamType.fromJsonSchema(schema, vectors.components);

describe('encode — accept vectors', () => {
  it.each(vectors.accept.map((v) => [v.name, v] as const))(
    'encodes %s to its wire form',
    (_name, vector) => {
      expect(encode(paramType(vector.schema), vector.value)).toEqual(vector.tagged);
    },
  );
});

describe('encode — reject vectors', () => {
  it.each(vectors.reject.map((v) => [v.name, v] as const))(
    'rejects %s',
    (_name, vector) => {
      expect(() => encode(paramType(vector.schema), vector.value)).toThrow(EncodeError);
    },
  );
});

describe('encode — record field order', () => {
  it('follows `required` (declared order), not alphabetical `properties`', () => {
    // Meta { tags: List<Int>, level: Int } — required = [tags, level], while
    // `properties` alphabetizes to [level, tags]. The struct fields must be
    // [list, int], not [int, list].
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        level: { type: 'integer' },
        tags: { type: 'array', items: { type: 'integer' } },
      },
      required: ['tags', 'level'],
    };
    expect(encode(paramType(schema), { level: 7, tags: [1, 2, 3] })).toEqual({
      struct: {
        constructor: 0,
        fields: [{ list: [{ int: 1 }, { int: 2 }, { int: 3 }] }, { int: 7 }],
      },
    });
  });
});

describe('encode — leaf position', () => {
  it('renders a top-level scalar bare', () => {
    // A scalar at the top level is sent bare; the resolver coerces it.
    expect(encode(paramType({ type: 'integer' }), 5)).toEqual(5);
    expect(
      encode(paramType({ $ref: 'https://tx3.land/specs/v1beta0/tii#/$defs/Bytes' }), 'cafe'),
    ).toEqual('cafe');
  });

  it('renders a nested scalar tagged', () => {
    // The same scalar nested inside a list is tagged.
    expect(encode(paramType({ type: 'array', items: { type: 'integer' } }), [5])).toEqual({
      list: [{ int: 5 }],
    });
  });
});

const BYTES_SCHEMA: JsonSchema = {
  $ref: 'https://tx3.land/specs/v1beta0/tii#/$defs/Bytes',
};
const LIST_OF_BYTES_SCHEMA: JsonSchema = {
  type: 'array',
  items: BYTES_SCHEMA,
};

describe('encode — native byte arrays', () => {
  it('canonicalizes a Uint8Array to 0x-prefixed hex', () => {
    expect(encode(paramType(BYTES_SCHEMA), Uint8Array.from([1, 1]))).toEqual('0x0101');
    expect(encode(paramType(LIST_OF_BYTES_SCHEMA), [Uint8Array.from([1, 2])])).toEqual({
      list: [{ bytes: '0x0102' }],
    });
  });

  it('canonicalizes an integer array (0..=255) to 0x-prefixed hex', () => {
    // The JSON shape other SDKs' native byte arrays serialize to — regression
    // for TRP `(-32005) value is not bytes: [1,1]`.
    expect(encode(paramType(BYTES_SCHEMA), [1, 1])).toEqual('0x0101');
    expect(encode(paramType(LIST_OF_BYTES_SCHEMA), [[1, 2]])).toEqual({
      list: [{ bytes: '0x0102' }],
    });
  });

  it('rejects arrays that are not byte arrays', () => {
    expect(() => encode(paramType(BYTES_SCHEMA), [1, 256])).toThrow(EncodeError);
    expect(() => encode(paramType(BYTES_SCHEMA), [1, -1])).toThrow(EncodeError);
    expect(() => encode(paramType(BYTES_SCHEMA), ['aa', 1])).toThrow(EncodeError);
    expect(() => encode(paramType(BYTES_SCHEMA), true)).toThrow(EncodeError);
  });
});

describe('encode — Hydra init argument shapes', () => {
  // `participants` / `parties` are `List<Bytes>`, `head_id` is `Bytes`
  // (regression: `(-32005) target type not supported: List` /
  // `value is not bytes: [1,2]`).
  it('encodes participants given as hex strings', () => {
    expect(encode(paramType(LIST_OF_BYTES_SCHEMA), ['0102', '0304'])).toEqual({
      list: [{ bytes: '0102' }, { bytes: '0304' }],
    });
  });

  it('encodes participants given as native byte arrays', () => {
    expect(encode(paramType(LIST_OF_BYTES_SCHEMA), [Uint8Array.from([1, 2])])).toEqual({
      list: [{ bytes: '0x0102' }],
    });
  });

  it('keeps a top-level head_id hex string bare', () => {
    expect(encode(paramType(BYTES_SCHEMA), 'abcd0123')).toEqual('abcd0123');
  });
});

describe('encode — Asteria name argument shapes', () => {
  // `ship_name` / `pilot_name` are `Bytes` params (regression:
  // `(-32005) value is not bytes: [1,1]`).
  it('passes hex-string names through bare at the top level', () => {
    expect(encode(paramType(BYTES_SCHEMA), '53484950313233')).toEqual('53484950313233');
  });

  it('canonicalizes byte-array names', () => {
    expect(encode(paramType(BYTES_SCHEMA), Uint8Array.from([83, 72, 73, 80]))).toEqual(
      '0x53484950',
    );
  });
});
