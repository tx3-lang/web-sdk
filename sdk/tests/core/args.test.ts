import {
  ArgValue,
  ParamTypeTag,
  toJson,
  fromJson,
  type UtxoRef,
} from '../../src/core/args.js';
import { ArgValueError } from '../../src/core/errors.js';
import { hexToBytes, bytesToHex } from '../../src/core/bytes.js';

describe('ArgValue constructors', () => {
  test('fromString', () => {
    const v = ArgValue.fromString('hello');
    expect(v).toEqual({ type: 'String', value: 'hello' });
  });

  test('fromNumber with number', () => {
    const v = ArgValue.fromNumber(42);
    expect(v).toEqual({ type: 'Int', value: 42n });
  });

  test('fromNumber with bigint', () => {
    const v = ArgValue.fromNumber(100n);
    expect(v).toEqual({ type: 'Int', value: 100n });
  });

  test('fromBool', () => {
    expect(ArgValue.fromBool(true)).toEqual({ type: 'Bool', value: true });
    expect(ArgValue.fromBool(false)).toEqual({ type: 'Bool', value: false });
  });

  test('fromBytes', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const v = ArgValue.fromBytes(bytes);
    expect(v.type).toBe('Bytes');
    expect(v.value).toEqual(bytes);
  });

  test('fromAddress', () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const v = ArgValue.fromAddress(bytes);
    expect(v.type).toBe('Address');
  });

  test('fromUtxoRef', () => {
    const ref: UtxoRef = { txid: new Uint8Array(32), index: 0 };
    const v = ArgValue.fromUtxoRef(ref);
    expect(v.type).toBe('UtxoRef');
  });

  test('fromUtxoSet', () => {
    const v = ArgValue.fromUtxoSet(new Set());
    expect(v.type).toBe('UtxoSet');
  });

  test('from infers string', () => {
    expect(ArgValue.from('hi').type).toBe('String');
  });

  test('from infers number', () => {
    expect(ArgValue.from(5).type).toBe('Int');
  });

  test('from infers bigint', () => {
    expect(ArgValue.from(5n).type).toBe('Int');
  });

  test('from infers boolean', () => {
    expect(ArgValue.from(true).type).toBe('Bool');
  });

  test('from infers Uint8Array', () => {
    expect(ArgValue.from(new Uint8Array(4)).type).toBe('Bytes');
  });

  test('from infers UtxoRef', () => {
    expect(ArgValue.from({ txid: new Uint8Array(32), index: 0 }).type).toBe('UtxoRef');
  });

  test('from infers UtxoSet', () => {
    expect(ArgValue.from(new Set()).type).toBe('UtxoSet');
  });

  test('from rejects unsupported value', () => {
    expect(() => ArgValue.from(null as never)).toThrow(ArgValueError);
  });
});

describe('ArgValue.is', () => {
  test('recognizes Int', () => {
    expect(ArgValue.is({ type: 'Int', value: 1n })).toBe(true);
  });

  test('rejects wrong value for Int', () => {
    expect(ArgValue.is({ type: 'Int', value: 1 })).toBe(false);
  });

  test('rejects non-objects', () => {
    expect(ArgValue.is(42)).toBe(false);
    expect(ArgValue.is(null)).toBe(false);
  });
});

describe('toJson / fromJson round-trips', () => {
  test('Int small', () => {
    const v = ArgValue.fromNumber(42);
    const wire = toJson(v);
    expect(wire).toBe(42);
    const back = fromJson(wire, ParamTypeTag.Int);
    expect(back).toEqual(v);
  });

  test('Int large positive', () => {
    const big = (1n << 100n);
    const v = ArgValue.fromNumber(big);
    const wire = toJson(v);
    expect(typeof wire).toBe('string');
    const back = fromJson(wire, ParamTypeTag.Int);
    expect(back.value).toBe(big);
  });

  test('Int large negative', () => {
    const neg = -(1n << 100n);
    const v = ArgValue.fromNumber(neg);
    const wire = toJson(v);
    const back = fromJson(wire, ParamTypeTag.Int);
    expect(back.value).toBe(neg);
  });

  test('Int i128 max boundary', () => {
    const max = (1n << 127n) - 1n;
    const v = ArgValue.fromNumber(max);
    const wire = toJson(v);
    const back = fromJson(wire, ParamTypeTag.Int);
    expect(back.value).toBe(max);
  });

  test('Int i128 min boundary', () => {
    const min = -(1n << 127n);
    const v = ArgValue.fromNumber(min);
    const wire = toJson(v);
    const back = fromJson(wire, ParamTypeTag.Int);
    expect(back.value).toBe(min);
  });

  test('Int outside i128 range throws', () => {
    expect(() => ArgValue.fromNumber((1n << 127n))).toThrow(ArgValueError);
    expect(() => ArgValue.fromNumber(-(1n << 127n) - 1n)).toThrow(ArgValueError);
  });

  test('Bool', () => {
    const v = ArgValue.fromBool(true);
    expect(toJson(v)).toBe(true);
    expect(fromJson(true, ParamTypeTag.Bool)).toEqual(v);
  });

  test('Bool coercion from 0/1', () => {
    expect(fromJson(0, ParamTypeTag.Bool).value).toBe(false);
    expect(fromJson(1, ParamTypeTag.Bool).value).toBe(true);
  });

  test('Bool coercion from strings', () => {
    expect(fromJson('true', ParamTypeTag.Bool).value).toBe(true);
    expect(fromJson('false', ParamTypeTag.Bool).value).toBe(false);
  });

  test('String', () => {
    const v = ArgValue.fromString('addr_test1...');
    expect(toJson(v)).toBe('addr_test1...');
    const back = fromJson('addr_test1...', ParamTypeTag.Undefined);
    expect(back).toEqual(v);
  });

  test('Bytes', () => {
    const v = ArgValue.fromBytes(hexToBytes('deadbeef'));
    const wire = toJson(v);
    expect(wire).toBe('0xdeadbeef');
    const back = fromJson(wire, ParamTypeTag.Bytes);
    expect(bytesToHex((back.value as Uint8Array))).toBe('deadbeef');
  });

  test('Address from bech32', () => {
    const addr = 'addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp';
    const v = fromJson(addr, ParamTypeTag.Address);
    expect(v.type).toBe('Address');
    expect(v.value).toBeInstanceOf(Uint8Array);
  });

  test('UtxoRef from string', () => {
    const txid = 'aa'.repeat(32);
    const wire = `${txid}#0`;
    const v = fromJson(wire, ParamTypeTag.UtxoRef);
    expect(v.type).toBe('UtxoRef');
    const ref = v.value as UtxoRef;
    expect(ref.index).toBe(0);
    expect(bytesToHex(ref.txid)).toBe(txid);
  });

  test('UtxoRef round-trip', () => {
    const txid = hexToBytes('bb'.repeat(32));
    const ref: UtxoRef = { txid, index: 5 };
    const v = ArgValue.fromUtxoRef(ref);
    const wire = toJson(v);
    expect(wire).toBe(`${'bb'.repeat(32)}#5`);
    const back = fromJson(wire, ParamTypeTag.UtxoRef);
    expect((back.value as UtxoRef).index).toBe(5);
  });

  test('UtxoSet round-trip', () => {
    const txid = hexToBytes('cc'.repeat(32));
    const address = hexToBytes('dd'.repeat(16));
    const utxoSet: Set<{
      ref: UtxoRef;
      address: Uint8Array;
      assets: { policy: unknown; asset_name: unknown; amount: unknown }[];
    }> = new Set([
      { ref: { txid, index: 0 }, address, assets: [], datum: undefined, script: undefined } as never,
    ]);
    const v = ArgValue.fromUtxoSet(utxoSet as never);
    const wire = toJson(v);
    expect(Array.isArray(wire)).toBe(true);
    const arr = wire as unknown[];
    expect(arr.length).toBe(1);
    const back = fromJson(arr, ParamTypeTag.UtxoSet);
    expect(back.type).toBe('UtxoSet');
    const backSet = back.value as Set<unknown>;
    expect(backSet.size).toBe(1);
  });

  test('Undefined infers number', () => {
    const v = fromJson(42, ParamTypeTag.Undefined);
    expect(v.type).toBe('Int');
    expect(v.value).toBe(42n);
  });

  test('Undefined infers boolean', () => {
    const v = fromJson(true, ParamTypeTag.Undefined);
    expect(v.type).toBe('Bool');
  });

  test('Bytes from BytesEnvelope object', () => {
    const v = fromJson(
      { content: 'deadbeef', contentType: 'hex' },
      ParamTypeTag.Bytes,
    );
    expect(v.type).toBe('Bytes');
    expect(bytesToHex(v.value as Uint8Array)).toBe('deadbeef');
  });
});

describe('error cases', () => {
  test('Int from non-integer number throws', () => {
    expect(() => fromJson(1.5, ParamTypeTag.Int)).toThrow(ArgValueError);
  });

  test('Int from null throws', () => {
    expect(() => fromJson(null, ParamTypeTag.Int)).toThrow(ArgValueError);
  });

  test('Bool from invalid value throws', () => {
    expect(() => fromJson('yes', ParamTypeTag.Bool)).toThrow(ArgValueError);
  });

  test('UtxoRef from invalid string throws', () => {
    expect(() => fromJson('notsplit', ParamTypeTag.UtxoRef)).toThrow(ArgValueError);
  });

  test('UtxoSet from non-array throws', () => {
    expect(() => fromJson('not-an-array', ParamTypeTag.UtxoSet)).toThrow(ArgValueError);
  });
});
