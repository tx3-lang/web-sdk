import { bech32 } from "bech32";

import {
  PrimitiveArgValue,
  BytesEnvelope,
  Type,
  UtxoRef,
  ArgValueError,
  CustomArgValue,
  ArgValue,
  isCustomArgValue,
} from "./types.js";

const MIN_I128 = -(BigInt(2) ** BigInt(127));
const MAX_I128 = BigInt(2) ** BigInt(127) - BigInt(1);

// Helper functions for encoding/decoding
function hexToBytes(s: string): Uint8Array {
  const cleanHex = s.startsWith("0x") ? s.slice(2) : s;
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
    const byteValue = Number.parseInt(hexByte, 16);
    if (Number.isNaN(byteValue)) {
      throw new ArgValueError(`Invalid hex string: ${s}`);
    }
    bytes[i / 2] = byteValue;
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(s: string): Uint8Array {
  try {
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new ArgValueError(`Invalid base64: ${s}`);
  }
}

function bigintToValue(i: bigint): any {
  if (
    i >= BigInt(Number.MIN_SAFE_INTEGER) &&
    i <= BigInt(Number.MAX_SAFE_INTEGER)
  ) {
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

function checkBigintInRange(x: bigint) {
  if (x < MIN_I128 || x > MAX_I128) {
    throw new ArgValueError(`Number is outside i128 range: ${x}`);
  }

  return true;
}

function numberToBigint(x: number): bigint {
  if (!Number.isInteger(x)) {
    throw new ArgValueError(`Number is not an integer: ${x}`);
  }

  const bigintValue = BigInt(x);

  checkBigintInRange(bigintValue);

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
  console.log(value, typeof value);
  if (typeof value === "number") {
    return numberToBigint(value);
  } else if (typeof value === "bigint") {
    checkBigintInRange(value);
    return value;
  } else if (typeof value === "string") {
    return stringToBigint(value);
  } else if (value === null) {
    throw new ArgValueError("Value is null");
  } else {
    throw new ArgValueError(`Value is not a number: ${value}`);
  }
}

function valueToBool(value: any): boolean {
  if (typeof value === "boolean") {
    return value;
  } else if (typeof value === "number") {
    if (value === 0) return false;
    if (value === 1) return true;
    throw new ArgValueError(`Invalid number for boolean: ${value}`);
  } else if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new ArgValueError(`Invalid string for boolean: ${value}`);
  } else {
    throw new ArgValueError(`Value is not a bool: ${value}`);
  }
}

function valueToBytes(value: any): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  } else if (typeof value === "string") {
    return hexToBytes(value);
  } else if (
    value &&
    typeof value === "object" &&
    "content" in value &&
    "encoding" in value
  ) {
    const envelope = value as BytesEnvelope;
    switch (envelope.encoding) {
      case "base64":
        return base64ToBytes(envelope.content);
      case "hex":
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
  if (typeof value === "string") {
    try {
      return bech32ToBytes(value);
    } catch {
      return hexToBytes(value);
    }
  } else {
    throw new ArgValueError(`Value is not an address: ${value}`);
  }
}

function valueToUndefined(value: any): PrimitiveArgValue {
  if (typeof value === "boolean") {
    return { type: "Bool", value };
  } else if (typeof value === "number") {
    return { type: "Int", value: numberToBigint(value) };
  } else if (typeof value === "string") {
    return { type: "String", value };
  } else {
    throw new ArgValueError(`Can't infer type for value: ${value}`);
  }
}

function stringToUtxoRef(s: string): UtxoRef {
  const parts = s.split("#");
  if (parts.length !== 2) {
    throw new ArgValueError(`Invalid utxo ref: ${s}`);
  }

  const [txidHex, indexStr] = parts;
  const txid = hexToBytes(txidHex);
  const index = Number.parseInt(indexStr, 10);

  if (Number.isNaN(index)) {
    throw new ArgValueError(`Invalid utxo ref: ${s}`);
  }

  return { txid, index };
}

function valueToUtxoRef(value: any): UtxoRef {
  if (typeof value === "string") {
    return stringToUtxoRef(value);
  } else {
    throw new ArgValueError(`Value is not utxo ref: ${value}`);
  }
}

function utxoRefToValue(x: UtxoRef): string {
  return `${bytesToHex(x.txid)}#${x.index}`;
}

export function toJson(value: PrimitiveArgValue | CustomArgValue): any {
  // Handle CustomArgValue (plain object with constructor and fields)
  if (isCustomArgValue(value)) {
    return {
      constructor: value.constructor,
      fields: value.fields.map((field) => toJson(field)),
    };
  }

  // Handle PrimitiveArgValue
  switch (value.type) {
    case "Int":
      return bigintToValue(value.value);
    case "Bool":
      return value.value;
    case "String":
      return value.value;
    case "Bytes":
      return `0x${bytesToHex(value.value)}`;
    case "Address":
      return bytesToHex(value.value);
    case "UtxoSet":
      return Array.from(value.value).map((utxo) => ({
        ref: utxoRefToValue(utxo.ref),
        address: bytesToHex(utxo.address),
        datum: utxo.datum,
        assets: utxo.assets,
        script: utxo.script,
      }));
    case "UtxoRef":
      return utxoRefToValue(value.value);
    default:
      throw new ArgValueError(`Unknown ArgValue type: ${(value as any).type}`);
  }
}

export function fromJson(value: any, target: Type): PrimitiveArgValue {
  switch (target) {
    case Type.Int:
      return { type: "Int", value: valueToBigint(value) };
    case Type.Bool:
      return { type: "Bool", value: valueToBool(value) };
    case Type.Bytes:
      return { type: "Bytes", value: valueToBytes(value) };
    case Type.Address:
      return { type: "Address", value: valueToAddress(value) };
    case Type.UtxoRef:
      return { type: "UtxoRef", value: valueToUtxoRef(value) };
    case Type.Undefined:
      return valueToUndefined(value);
    default:
      throw new ArgValueError(`Target type not supported: ${target}`);
  }
}

export function createIntArg(value: number | bigint): PrimitiveArgValue {
  return ArgValue.fromNumber(value);
}

export function createBoolArg(value: boolean): PrimitiveArgValue {
  return ArgValue.fromBool(value);
}

export function createStringArg(value: string): PrimitiveArgValue {
  return ArgValue.fromString(value);
}

export function createBytesArg(value: Uint8Array): PrimitiveArgValue {
  return ArgValue.fromBytes(value);
}

export function createAddressArg(value: Uint8Array): PrimitiveArgValue {
  return ArgValue.fromAddress(value);
}

export function createUtxoRefArg(
  txid: Uint8Array,
  index: number,
): PrimitiveArgValue {
  return ArgValue.fromUtxoRef({ txid, index });
}

/**
 * Create a CustomArgValue with a constructor index and ordered fields
 * @param constructorIndex - The constructor index (non-negative integer)
 * @param fields - Ordered array of ArgValue fields
 */
export function createCustomArg(
  constructorIndex: number,
  fields: ArgValue[],
): CustomArgValue {
  if (!Number.isInteger(constructorIndex) || constructorIndex < 0) {
    throw new ArgValueError("Constructor index must be a non-negative integer");
  }
  return { constructor: constructorIndex, fields };
}

/**
 * Parse a custom type from JSON
 * This expects the JSON to have the format: {constructor: number, fields: array}
 */
function valueToCustom(value: any): CustomArgValue {
  if (!value || typeof value !== "object") {
    throw new ArgValueError(`Value is not a custom type object: ${value}`);
  }

  if (!("constructor" in value)) {
    throw new ArgValueError("Custom type missing constructor field");
  }

  const constructorIndex = value.constructor;
  if (!Number.isInteger(constructorIndex) || constructorIndex < 0) {
    throw new ArgValueError(
      "Custom type constructor must be a non-negative integer",
    );
  }

  if (!("fields" in value)) {
    throw new ArgValueError("Custom type missing fields array");
  }

  if (!Array.isArray(value.fields)) {
    throw new ArgValueError("Custom type fields must be an array");
  }

  const fields: ArgValue[] = value.fields.map((fieldValue: any) => {
    if (
      fieldValue &&
      typeof fieldValue === "object" &&
      "constructor" in fieldValue &&
      "fields" in fieldValue
    ) {
      return valueToCustom(fieldValue);
    }

    return fromJson(fieldValue, Type.Undefined);
  });

  return { constructor: constructorIndex, fields };
}

export { hexToBytes, bytesToHex, valueToCustom };
