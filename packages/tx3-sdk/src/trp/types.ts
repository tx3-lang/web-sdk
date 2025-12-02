export interface UtxoRef {
  txid: Uint8Array;
  index: number;
}

export interface Utxo {
  ref: UtxoRef;
  address: Uint8Array;
  datum?: any; // ir::Expression equivalent
  assets: AssetExpr[];
  script?: any; // ir::Expression equivalent
}

export interface AssetExpr {
  policy: any; // ir::Expression equivalent
  asset_name: any; // ir::Expression equivalent
  amount: any; // ir::Expression equivalent
}

export type UtxoSet = Set<Utxo>;

export type ArgValueInt = { type: "Int"; value: bigint };
export type ArgValueBool = { type: "Bool"; value: boolean };
export type ArgValueString = { type: "String"; value: string };
export type ArgValueBytes = { type: "Bytes"; value: Uint8Array };
export type ArgValueAddress = { type: "Address"; value: Uint8Array };
export type ArgValueUtxoSet = { type: "UtxoSet"; value: UtxoSet };
export type ArgValueUtxoRef = { type: "UtxoRef"; value: UtxoRef };

export type PrimitiveArgValue =
  | ArgValueInt
  | ArgValueBool
  | ArgValueString
  | ArgValueBytes
  | ArgValueAddress
  | ArgValueUtxoSet
  | ArgValueUtxoRef;

// Factory functions to create ArgValue
export const ArgValue = {
  fromString(value: string): ArgValueString {
    return { type: "String", value };
  },

  fromNumber(value: number | bigint): ArgValueInt {
    return {
      type: "Int",
      value: typeof value === "number" ? BigInt(value) : value,
    };
  },

  fromBool(value: boolean): ArgValueBool {
    return { type: "Bool", value };
  },

  fromBytes(value: Uint8Array): ArgValueBytes {
    return { type: "Bytes", value };
  },

  fromAddress(value: Uint8Array): ArgValueAddress {
    return { type: "Address", value };
  },

  fromUtxoSet(value: UtxoSet): ArgValueUtxoSet {
    return { type: "UtxoSet", value };
  },

  fromUtxoRef(value: UtxoRef): ArgValueUtxoRef {
    return { type: "UtxoRef", value };
  },

  from(
    value: string | number | bigint | boolean | Uint8Array | UtxoSet | UtxoRef,
  ): PrimitiveArgValue {
    if (typeof value === "string") return this.fromString(value);
    if (typeof value === "number" || typeof value === "bigint")
      return this.fromNumber(value);
    if (typeof value === "boolean") return this.fromBool(value);
    if (value instanceof Uint8Array) return this.fromBytes(value);
    if (value instanceof Set) return this.fromUtxoSet(value);
    if (typeof value === "object" && value !== null && "txid" in value)
      return this.fromUtxoRef(value);
    throw new Error(`Cannot convert value to PrimitiveArgValue: ${value}`);
  },

  is(value: unknown): value is PrimitiveArgValue {
    if (!value || typeof value !== "object" || !("type" in value)) {
      return false;
    }

    const obj = value as PrimitiveArgValue;

    switch (obj.type) {
      case "Int":
        return typeof obj.value === "bigint";
      case "Bool":
        return typeof obj.value === "boolean";
      case "String":
        return typeof obj.value === "string";
      case "Bytes":
        return obj.value instanceof Uint8Array;
      case "Address":
        return obj.value instanceof Uint8Array;
      case "UtxoSet":
        return obj.value instanceof Set;
      case "UtxoRef":
        return (
          typeof obj.value === "object" &&
          obj.value !== null &&
          "txid" in obj.value
        );
      default:
        return false;
    }
  },

  /**
   * Type guard to check if a value is any kind of ArgValue (Primitive or Custom)
   */
  isAny(value: unknown): value is ArgValue {
    return this.is(value) || isCustomArgValue(value);
  },
};

/**
 * Custom argument value - a plain object representing a sum type variant
 * with a constructor index and ordered fields.
 */
export interface CustomArgValue {
  constructor: number;
  fields: ArgValue[];
}

/**
 * Type guard to check if a value is a CustomArgValue
 */
export function isCustomArgValue(value: unknown): value is CustomArgValue {
  return (
    value !== null &&
    typeof value === "object" &&
    "constructor" in value &&
    typeof (value as any).constructor === "number" &&
    "fields" in value &&
    Array.isArray((value as any).fields)
  );
}

// Union of all ArgValue types
export type ArgValue = PrimitiveArgValue | CustomArgValue;

export interface BytesEnvelope {
  content: string;
  encoding: "base64" | "hex";
}

export enum Type {
  Int = "Int",
  Bool = "Bool",
  Bytes = "Bytes",
  Address = "Address",
  UtxoRef = "UtxoRef",
  Undefined = "Undefined",
}

export interface TirInfo {
  version: string;
  bytecode: string;
  encoding: string;
}

export interface ResolveResponse {
  tx: string;
  hash: string;
}

export interface VKeyWitness {
  type: "vkey";
  key: BytesEnvelope;
  signature: BytesEnvelope;
}

export type SubmitWitness = VKeyWitness;

export interface SubmitParams {
  tx: BytesEnvelope;
  witnesses: SubmitWitness[];
}

export interface ClientOptions {
  endpoint: string;
  headers?: Record<string, string>;
  envArgs?: Record<string, ArgValue>;
}

export interface ProtoTxRequest {
  tir: TirInfo;
  args: Record<string, ArgValue | unknown>;
}

export class ArgValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgValueError";
  }
}

export class TrpError extends Error {
  constructor(message: string, public override cause?: any) {
    super(message);
    this.name = "TrpError";
  }
}

export class NetworkError extends TrpError {
  constructor(message: string, cause?: any) {
    super(`Network error: ${message}`, cause);
    this.name = "NetworkError";
  }
}

export class StatusCodeError extends TrpError {
  constructor(public statusCode: number, message: string) {
    super(`HTTP error ${statusCode}: ${message}`);
    this.name = "StatusCodeError";
  }
}

export class JsonRpcError extends TrpError {
  constructor(message: string, public data?: any) {
    super(`JSON-RPC error: ${message}`);
    this.name = "JsonRpcError";
    this.cause = data;
  }
}
