import { bech32 } from 'bech32';
import { ArgValueError } from './errors.js';
import { BytesEnvelope, bytesToHex, hexToBytes, readBytesEnvelope } from './bytes.js';

const MIN_I128 = -(1n << 127n);
const MAX_I128 = (1n << 127n) - 1n;

export interface UtxoRef {
  txid: Uint8Array;
  index: number;
}

export interface AssetExpr {
  policy: unknown;
  asset_name: unknown;
  amount: unknown;
}

export interface Utxo {
  ref: UtxoRef;
  address: Uint8Array;
  datum?: unknown;
  assets: AssetExpr[];
  script?: unknown;
}

export type UtxoSet = Set<Utxo>;

export type ArgValue =
  | { type: 'Int'; value: bigint }
  | { type: 'Bool'; value: boolean }
  | { type: 'String'; value: string }
  | { type: 'Bytes'; value: Uint8Array }
  | { type: 'Address'; value: Uint8Array }
  | { type: 'UtxoSet'; value: UtxoSet }
  | { type: 'UtxoRef'; value: UtxoRef };

export const ArgValue = {
  fromString(value: string): ArgValue {
    return { type: 'String', value };
  },
  fromNumber(value: number | bigint): ArgValue {
    const asBig = typeof value === 'number' ? BigInt(value) : value;
    assertI128Range(asBig);
    return { type: 'Int', value: asBig };
  },
  fromBool(value: boolean): ArgValue {
    return { type: 'Bool', value };
  },
  fromBytes(value: Uint8Array): ArgValue {
    return { type: 'Bytes', value };
  },
  fromAddress(value: Uint8Array): ArgValue {
    return { type: 'Address', value };
  },
  fromUtxoSet(value: UtxoSet): ArgValue {
    return { type: 'UtxoSet', value };
  },
  fromUtxoRef(value: UtxoRef): ArgValue {
    return { type: 'UtxoRef', value };
  },
  from(
    value: string | number | bigint | boolean | Uint8Array | UtxoSet | UtxoRef,
  ): ArgValue {
    if (typeof value === 'string') return ArgValue.fromString(value);
    if (typeof value === 'number' || typeof value === 'bigint') return ArgValue.fromNumber(value);
    if (typeof value === 'boolean') return ArgValue.fromBool(value);
    if (value instanceof Uint8Array) return ArgValue.fromBytes(value);
    if (value instanceof Set) return ArgValue.fromUtxoSet(value as UtxoSet);
    if (value && typeof value === 'object' && 'txid' in value) {
      return ArgValue.fromUtxoRef(value as UtxoRef);
    }
    throw new ArgValueError(`cannot convert value to ArgValue: ${String(value)}`);
  },
  is(value: unknown): value is ArgValue {
    if (!value || typeof value !== 'object' || !('type' in value)) return false;
    const v = value as ArgValue;
    switch (v.type) {
      case 'Int':
        return typeof v.value === 'bigint';
      case 'Bool':
        return typeof v.value === 'boolean';
      case 'String':
        return typeof v.value === 'string';
      case 'Bytes':
      case 'Address':
        return v.value instanceof Uint8Array;
      case 'UtxoSet':
        return v.value instanceof Set;
      case 'UtxoRef':
        return typeof v.value === 'object' && v.value !== null && 'txid' in v.value;
      default:
        return false;
    }
  },
};

export enum ParamTypeTag {
  Int = 'Int',
  Bool = 'Bool',
  Bytes = 'Bytes',
  Address = 'Address',
  UtxoRef = 'UtxoRef',
  UtxoSet = 'UtxoSet',
  Undefined = 'Undefined',
}

function assertI128Range(value: bigint): void {
  if (value < MIN_I128 || value > MAX_I128) {
    throw new ArgValueError(`integer outside i128 range: ${value}`);
  }
}

function bigintToWire(i: bigint): number | string {
  assertI128Range(i);
  if (i >= BigInt(Number.MIN_SAFE_INTEGER) && i <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(i);
  }
  const bytes = new Uint8Array(16);
  let value = i < 0n ? -i : i;
  for (let j = 15; j >= 0; j--) {
    bytes[j] = Number(value & 0xffn);
    value >>= 8n;
  }
  if (i < 0n) {
    for (let j = 0; j < 16; j++) bytes[j] = ~bytes[j] & 0xff;
    let carry = 1;
    for (let j = 15; j >= 0 && carry; j--) {
      const sum = bytes[j] + carry;
      bytes[j] = sum & 0xff;
      carry = sum >> 8;
    }
  }
  return `0x${bytesToHex(bytes)}`;
}

function wireToBigint(value: unknown): bigint {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new ArgValueError(`not an integer: ${value}`);
    const asBig = BigInt(value);
    assertI128Range(asBig);
    return asBig;
  }
  if (typeof value === 'bigint') {
    assertI128Range(value);
    return value;
  }
  if (typeof value === 'string') {
    const bytes = hexToBytes(value);
    if (bytes.length !== 16) throw new ArgValueError(`invalid bytes for integer: ${value}`);
    let result = 0n;
    for (let i = 0; i < 16; i++) result = (result << 8n) | BigInt(bytes[i]);
    if ((bytes[0] & 0x80) !== 0) result -= 1n << 128n;
    return result;
  }
  if (value === null || value === undefined) throw new ArgValueError('integer value is null');
  throw new ArgValueError(`cannot coerce to integer: ${String(value)}`);
}

function wireToBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return value === 1;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ArgValueError(`cannot coerce to bool: ${String(value)}`);
}

function wireToBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return hexToBytes(value);
  if (value && typeof value === 'object' && 'content' in value) {
    return readBytesEnvelope(value as BytesEnvelope);
  }
  throw new ArgValueError(`cannot coerce to bytes: ${String(value)}`);
}

function bech32ToBytes(value: string): Uint8Array {
  const decoded = bech32.decode(value, 1023);
  const bytes = bech32.fromWords(decoded.words);
  return Uint8Array.from(bytes);
}

function wireToAddress(value: unknown): Uint8Array {
  if (typeof value !== 'string') {
    throw new ArgValueError(`cannot coerce to address: ${String(value)}`);
  }
  try {
    return bech32ToBytes(value);
  } catch {
    return hexToBytes(value);
  }
}

function stringToUtxoRef(s: string): UtxoRef {
  const parts = s.split('#');
  if (parts.length !== 2) throw new ArgValueError(`invalid utxo ref: ${s}`);
  const [txidHex, indexStr] = parts;
  const txid = hexToBytes(txidHex);
  const index = Number.parseInt(indexStr, 10);
  if (!Number.isInteger(index) || index < 0) {
    throw new ArgValueError(`invalid utxo ref index: ${s}`);
  }
  return { txid, index };
}

function wireToUtxoRef(value: unknown): UtxoRef {
  if (typeof value === 'string') return stringToUtxoRef(value);
  if (value && typeof value === 'object' && 'txid' in value && 'index' in value) {
    const raw = value as { txid: unknown; index: unknown };
    const txid = raw.txid instanceof Uint8Array ? raw.txid : hexToBytes(String(raw.txid));
    const index = typeof raw.index === 'number' ? raw.index : Number.parseInt(String(raw.index), 10);
    if (!Number.isInteger(index) || index < 0) {
      throw new ArgValueError(`invalid utxo ref index: ${String(raw.index)}`);
    }
    return { txid, index };
  }
  throw new ArgValueError(`cannot coerce to utxo ref: ${String(value)}`);
}

function wireToUtxoSet(value: unknown): UtxoSet {
  if (!Array.isArray(value)) {
    throw new ArgValueError(`cannot coerce to utxo set: ${String(value)}`);
  }
  const out: UtxoSet = new Set();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      throw new ArgValueError(`invalid utxo in set: ${String(entry)}`);
    }
    const raw = entry as {
      ref?: unknown;
      address?: unknown;
      datum?: unknown;
      assets?: unknown;
      script?: unknown;
    };
    const ref = wireToUtxoRef(raw.ref);
    const address = wireToBytes(raw.address);
    const assets = Array.isArray(raw.assets) ? (raw.assets as AssetExpr[]) : [];
    out.add({
      ref,
      address,
      datum: raw.datum,
      assets,
      script: raw.script,
    });
  }
  return out;
}

function utxoRefToWire(ref: UtxoRef): string {
  return `${bytesToHex(ref.txid)}#${ref.index}`;
}

function inferArgValue(value: unknown): ArgValue {
  if (typeof value === 'boolean') return { type: 'Bool', value };
  if (typeof value === 'number') return { type: 'Int', value: wireToBigint(value) };
  if (typeof value === 'bigint') return { type: 'Int', value: wireToBigint(value) };
  if (typeof value === 'string') return { type: 'String', value };
  throw new ArgValueError(`cannot infer type for value: ${String(value)}`);
}

export function toJson(value: ArgValue): unknown {
  switch (value.type) {
    case 'Int':
      return bigintToWire(value.value);
    case 'Bool':
      return value.value;
    case 'String':
      return value.value;
    case 'Bytes':
      return `0x${bytesToHex(value.value)}`;
    case 'Address':
      return bytesToHex(value.value);
    case 'UtxoRef':
      return utxoRefToWire(value.value);
    case 'UtxoSet':
      return Array.from(value.value).map((utxo) => ({
        ref: utxoRefToWire(utxo.ref),
        address: bytesToHex(utxo.address),
        datum: utxo.datum,
        assets: utxo.assets,
        script: utxo.script,
      }));
  }
}

export function fromJson(value: unknown, target: ParamTypeTag): ArgValue {
  switch (target) {
    case ParamTypeTag.Int:
      return { type: 'Int', value: wireToBigint(value) };
    case ParamTypeTag.Bool:
      return { type: 'Bool', value: wireToBool(value) };
    case ParamTypeTag.Bytes:
      return { type: 'Bytes', value: wireToBytes(value) };
    case ParamTypeTag.Address:
      return { type: 'Address', value: wireToAddress(value) };
    case ParamTypeTag.UtxoRef:
      return { type: 'UtxoRef', value: wireToUtxoRef(value) };
    case ParamTypeTag.UtxoSet:
      return { type: 'UtxoSet', value: wireToUtxoSet(value) };
    case ParamTypeTag.Undefined:
      return inferArgValue(value);
  }
}
