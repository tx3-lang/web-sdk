import { bech32 } from 'bech32';

import { ArgValue, BytesEnvelope, Type, UtxoRef, ArgValueError } from './types.js';

const MIN_I128 = -(BigInt(2) ** BigInt(127));
const MAX_I128 = BigInt(2) ** BigInt(127) - BigInt(1);

// Helper functions for encoding/decoding
function hexToBytes(s: string): Uint8Array {
  const cleanHex = s.startsWith('0x') ? s.slice(2) : s;
  if (cleanHex.length % 2 !== 0) {
    throw new ArgValueError(`Invalid hex string: ${s}`);
  }
  
  // Validate hex characters
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new ArgValueError(`Invalid hex string: ${s}`);
  }
  
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    const hexByte = cleanHex.substring(i, i + 2);
    const byteValue = parseInt(hexByte, 16);
    if (isNaN(byteValue)) {
      throw new ArgValueError(`Invalid hex string: ${s}`);
    }
    bytes[i / 2] = byteValue;
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64ToBytes(s: string): Uint8Array {
  try {
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new ArgValueError(`Invalid base64: ${s}`);
  }
}

function bigintToValue(i: bigint): any {
  if (i >= BigInt(Number.MIN_SAFE_INTEGER) && i <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(i);
  } else {
    const bytes = new Uint8Array(16);
    let value = i < 0 ? -i : i;
    const isNegative = i < 0;
    
    for (let j = 15; j >= 0; j--) {
      bytes[j] = Number(value & BigInt(0xff));
      value = value >> BigInt(8);
    }
    
    if (isNegative) {
      // Two's complement for negative numbers
      for (let j = 0; j < 16; j++) {
        bytes[j] = ~bytes[j] & 0xff;
      }
      let carry = 1;
      for (let j = 15; j >= 0 && carry; j--) {
        const sum = bytes[j] + carry;
        bytes[j] = sum & 0xff;
        carry = sum >> 8;
      }
    }
    
    return `0x${bytesToHex(bytes)}`;
  }
}

function numberToBigint(x: number): bigint {
  if (!Number.isInteger(x)) {
    throw new ArgValueError(`Number is not an integer: ${x}`);
  }

  const bigintValue = BigInt(x);
  
  if (bigintValue < MIN_I128 || bigintValue > MAX_I128) {
    throw new ArgValueError(`Number is outside i128 range: ${x}`);
  }
  
  return bigintValue;
}

function stringToBigint(s: string): bigint {
  const bytes = hexToBytes(s);
  if (bytes.length !== 16) {
    throw new ArgValueError(`Invalid bytes for number: ${s}`);
  }
  
  let result = BigInt(0);
  for (let i = 0; i < 16; i++) {
    result = (result << BigInt(8)) | BigInt(bytes[i]);
  }
  
  // Check if it's a negative number (two's complement)
  if (bytes[0] & 0x80) {
    // Convert from two's complement
    result = result - (BigInt(1) << BigInt(128));
  }
  
  return result;
}

function valueToBigint(value: any): bigint {
  if (typeof value === 'number') {
    return numberToBigint(value);
  } else if (typeof value === 'string') {
    return stringToBigint(value);
  } else if (value === null) {
    throw new ArgValueError('Value is null');
  } else {
    throw new ArgValueError(`Value is not a number: ${value}`);
  }
}

function valueToBool(value: any): boolean {
  if (typeof value === 'boolean') {
    return value;
  } else if (typeof value === 'number') {
    if (value === 0) return false;
    if (value === 1) return true;
    throw new ArgValueError(`Invalid number for boolean: ${value}`);
  } else if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new ArgValueError(`Invalid string for boolean: ${value}`);
  } else {
    throw new ArgValueError(`Value is not a bool: ${value}`);
  }
}

function valueToBytes(value: any): Uint8Array {
  if (typeof value === 'string') {
    return hexToBytes(value);
  } else if (value && typeof value === 'object' && 'content' in value && 'encoding' in value) {
    const envelope = value as BytesEnvelope;
    switch (envelope.encoding) {
      case 'base64':
        return base64ToBytes(envelope.content);
      case 'hex':
        return hexToBytes(envelope.content);
      default:
        throw new ArgValueError(`Unknown encoding: ${envelope.encoding}`);
    }
  } else {
    throw new ArgValueError(`Value is not bytes: ${value}`);
  }
}

function bech32ToBytes(value: string): Uint8Array {
  const decoded = bech32.decode(value);
  const bytes = bech32.fromWords(decoded.words);
  return Uint8Array.from(bytes);
}

function valueToAddress(value: any): Uint8Array {
  if (typeof value === 'string') {
    try {
      return bech32ToBytes(value);
    } catch {
      return hexToBytes(value);
    }
  } else {
    throw new ArgValueError(`Value is not an address: ${value}`);
  }
}

function valueToUndefined(value: any): ArgValue {
  if (typeof value === 'boolean') {
    return { type: 'Bool', value };
  } else if (typeof value === 'number') {
    return { type: 'Int', value: numberToBigint(value) };
  } else if (typeof value === 'string') {
    return { type: 'String', value };
  } else {
    throw new ArgValueError(`Can't infer type for value: ${value}`);
  }
}

function stringToUtxoRef(s: string): UtxoRef {
  const parts = s.split('#');
  if (parts.length !== 2) {
    throw new ArgValueError(`Invalid utxo ref: ${s}`);
  }
  
  const [txidHex, indexStr] = parts;
  const txid = hexToBytes(txidHex);
  const index = parseInt(indexStr, 10);
  
  if (isNaN(index)) {
    throw new ArgValueError(`Invalid utxo ref: ${s}`);
  }
  
  return { txid, index };
}

function valueToUtxoRef(value: any): UtxoRef {
  if (typeof value === 'string') {
    return stringToUtxoRef(value);
  } else {
    throw new ArgValueError(`Value is not utxo ref: ${value}`);
  }
}

function utxoRefToValue(x: UtxoRef): string {
  return `${bytesToHex(x.txid)}#${x.index}`;
}

export function toJson(value: ArgValue): any {
  switch (value.type) {
    case 'Int':
      return bigintToValue(value.value);
    case 'Bool':
      return value.value;
    case 'String':
      return value.value;
    case 'Bytes':
      return `0x${bytesToHex(value.value)}`;
    case 'Address':
      return bytesToHex(value.value);
    case 'UtxoSet':
      return Array.from(value.value).map(utxo => ({
        ref: utxoRefToValue(utxo.ref),
        address: bytesToHex(utxo.address),
        datum: utxo.datum,
        assets: utxo.assets,
        script: utxo.script
      }));
    case 'UtxoRef':
      return utxoRefToValue(value.value);
    default:
      throw new ArgValueError(`Unknown ArgValue type: ${(value as any).type}`);
  }
}

export function fromJson(value: any, target: Type): ArgValue {
  switch (target) {
    case Type.Int:
      return { type: 'Int', value: valueToBigint(value) };
    case Type.Bool:
      return { type: 'Bool', value: valueToBool(value) };
    case Type.Bytes:
      return { type: 'Bytes', value: valueToBytes(value) };
    case Type.Address:
      return { type: 'Address', value: valueToAddress(value) };
    case Type.UtxoRef:
      return { type: 'UtxoRef', value: valueToUtxoRef(value) };
    case Type.Undefined:
      return valueToUndefined(value);
    default:
      throw new ArgValueError(`Target type not supported: ${target}`);
  }
}

// Helper functions to create ArgValue instances
export function createIntArg(value: number | bigint): ArgValue {
  return { type: 'Int', value: typeof value === 'number' ? BigInt(value) : value };
}

export function createBoolArg(value: boolean): ArgValue {
  return { type: 'Bool', value };
}

export function createStringArg(value: string): ArgValue {
  return { type: 'String', value };
}

export function createBytesArg(value: Uint8Array): ArgValue {
  return { type: 'Bytes', value };
}

export function createAddressArg(value: Uint8Array): ArgValue {
  return { type: 'Address', value };
}

export function createUtxoRefArg(txid: Uint8Array, index: number): ArgValue {
  return { type: 'UtxoRef', value: { txid, index } };
}

// Export utility functions
export { hexToBytes, bytesToHex };
