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
