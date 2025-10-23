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

  // Generic from function for convenience
  from(
    value: string | number | bigint | boolean | Uint8Array | UtxoSet | UtxoRef,
  ): PrimitiveArgValue {
    if (typeof value === "string") return this.fromString(value);
    if (typeof value === "number" || typeof value === "bigint")
      return this.fromNumber(value);
    if (typeof value === "boolean") return this.fromBool(value);
    if (value instanceof Uint8Array) return this.fromBytes(value);
    if (value instanceof Set) return this.fromUtxoSet(value as UtxoSet);
    if (typeof value === "object" && value !== null && "txid" in value)
      return this.fromUtxoRef(value as UtxoRef);
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
    return this.is(value) || CustomArgValue.is(value);
  },
};

// Custom argument value that can represent complex nested structures
export type ArgValue = PrimitiveArgValue | CustomArgValue;

// Type helper to convert plain types to ArgValue types recursively
export type ToArgValue<T> = T extends string
  ? ArgValueString
  : T extends number | bigint
    ? ArgValueInt
    : T extends boolean
      ? ArgValueBool
      : T extends Uint8Array
        ? ArgValueBytes | ArgValueAddress
        : T extends Set<infer U>
          ? U extends Utxo
            ? ArgValueUtxoSet
            : never
          : T extends UtxoRef
            ? ArgValueUtxoRef
            : T extends Record<string, any>
              ? CustomArgValue<T>
              : never;

// Type helper to map object properties to ArgValue types
export type ToArgValueRecord<T extends Record<string, any>> = {
  [K in keyof T]: ToArgValue<T[K]>;
};

// Type helper to convert ArgValue types back to plain types
export type FromArgValue<T> = T extends ArgValueString
  ? string
  : T extends ArgValueInt
    ? bigint
    : T extends ArgValueBool
      ? boolean
      : T extends ArgValueBytes | ArgValueAddress
        ? Uint8Array
        : T extends ArgValueUtxoSet
          ? UtxoSet
          : T extends ArgValueUtxoRef
            ? UtxoRef
            : T extends CustomArgValue<infer U>
              ? U
              : never;

/**
 * Type-safe CustomArgValue that represents complex nested structures with compile-time type checking.
 * The generic parameter T defines the shape of the data structure, providing full type safety.
 *
 * Features:
 * - Type safety: Full compile-time type checking based on the shape parameter T
 * - Recursive nesting: Can contain other typed CustomArgValue instances
 * - Mixed types: Can contain both primitive and custom values
 * - Serialization: Can be converted to/from plain JavaScript objects
 * - Immutability helpers: Clone, equality checking
 *
 * @template T The shape of the data structure (plain object type)
 *
 * @example
 * ```typescript
 * // Define the shape
 * interface UserConfig {
 *   name: string;
 *   age: number;
 *   settings: {
 *     theme: string;
 *     notifications: boolean;
 *   };
 * }
 *
 * // Create with type safety
 * const config = CustomArgValue.from<UserConfig>({
 *   name: "Alice",
 *   age: 30,
 *   settings: {
 *     theme: "dark",
 *     notifications: true
 *   }
 * });
 *
 * // Type-safe access
 * const name = config.get("name");        // Type: ArgValueString
 * const settings = config.get("settings"); // Type: CustomArgValue<{theme: string, notifications: boolean}>
 * const theme = settings.get("theme");     // Type: ArgValueString
 * ```
 */
export class CustomArgValue<
  T extends Record<string, any> = Record<string, any>,
> {
  public readonly type = "Custom";
  private readonly _value: Record<string, ArgValue>;

  constructor(value: Record<string, ArgValue>) {
    this._value = value;
  }

  /**
   * Get the internal value (for compatibility)
   */
  get value(): Record<string, ArgValue> {
    return this._value;
  }

  /**
   * Create a CustomArgValue from a plain object.
   * Automatically converts primitive values to PrimitiveArgValue instances.
   *
   * @param obj - Plain JavaScript object to convert
   * @returns New CustomArgValue instance
   *
   * @example
   * ```typescript
   * interface Config {
   *   name: string;
   *   age: number;
   *   settings: { theme: string };
   * }
   *
   * const custom = CustomArgValue.from<Config>({
   *   name: "Alice",           // Becomes ArgValueString
   *   age: 30,                // Becomes ArgValueInt
   *   settings: {             // Becomes nested CustomArgValue
   *     theme: "dark"
   *   }
   * });
   * ```
   */
  static from<TShape extends Record<string, any>>(
    obj: TShape,
  ): CustomArgValue<TShape> {
    const convertedValue: Record<string, ArgValue> = {};

    for (const [key, val] of Object.entries(obj)) {
      if (ArgValue.is(val)) {
        // Already a PrimitiveArgValue
        convertedValue[key] = val;
      } else if (val instanceof CustomArgValue) {
        // Already a CustomArgValue
        convertedValue[key] = val;
      } else if (
        val &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        !(val instanceof Uint8Array) &&
        !(val instanceof Set)
      ) {
        // Plain object - convert to CustomArgValue recursively
        convertedValue[key] = CustomArgValue.from(val);
      } else {
        // Primitive value - convert using ArgValue.from
        convertedValue[key] = ArgValue.from(val);
      }
    }

    return new CustomArgValue<TShape>(convertedValue);
  }

  /**
   * Type guard to check if a value is a CustomArgValue
   */
  static is(value: unknown): value is CustomArgValue {
    return value instanceof CustomArgValue;
  }
}

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
  constructor(
    message: string,
    public override cause?: any,
  ) {
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
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(`HTTP error ${statusCode}: ${message}`);
    this.name = "StatusCodeError";
  }
}

export class JsonRpcError extends TrpError {
  constructor(
    message: string,
    public data?: any,
  ) {
    super(`JSON-RPC error: ${message}`);
    this.name = "JsonRpcError";
    this.cause = data;
  }
}
