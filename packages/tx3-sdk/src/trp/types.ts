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

export type ArgValue = 
  | { type: 'Int'; value: bigint }
  | { type: 'Bool'; value: boolean }
  | { type: 'String'; value: string }
  | { type: 'Bytes'; value: Uint8Array }
  | { type: 'Address'; value: Uint8Array }
  | { type: 'UtxoSet'; value: UtxoSet }
  | { type: 'UtxoRef'; value: UtxoRef };

// Factory functions to create ArgValue
export const ArgValue = {
  fromString(value: string): ArgValue {
    return { type: 'String', value };
  },
  
  fromNumber(value: number | bigint): ArgValue {
    return { type: 'Int', value: typeof value === 'number' ? BigInt(value) : value };
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
  
  // Generic from function for convenience
  from(value: string | number | bigint | boolean | Uint8Array | UtxoSet | UtxoRef): ArgValue {
    if (typeof value === 'string') return this.fromString(value);
    if (typeof value === 'number' || typeof value === 'bigint') return this.fromNumber(value);
    if (typeof value === 'boolean') return this.fromBool(value);
    if (value instanceof Uint8Array) return this.fromBytes(value);
    if (value instanceof Set) return this.fromUtxoSet(value as UtxoSet);
    if (typeof value === 'object' && value !== null && 'txid' in value) return this.fromUtxoRef(value as UtxoRef);
    throw new Error(`Cannot convert value to ArgValue: ${value}`);
  }
};

export interface BytesEnvelope {
  content: string;
  encoding: 'base64' | 'hex';
}

export enum Type {
  Int = 'Int',
  Bool = 'Bool',
  Bytes = 'Bytes',
  Address = 'Address',
  UtxoRef = 'UtxoRef',
  Undefined = 'Undefined'
}

export interface TirInfo {
  version: string;
  bytecode: string;
  encoding: string;
}

export interface TxEnvelope {
  tx: string;
}

export interface ClientOptions {
  endpoint: string;
  headers?: Record<string, string>;
  envArgs?: Record<string, ArgValue>;
}

export interface ProtoTxRequest {
  tir: TirInfo;
  args: Record<string, ArgValue>;
}

export class ArgValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgValueError';
  }
}

export class TrpError extends Error {
  constructor(message: string, public override cause?: any) {
    super(message);
    this.name = 'TrpError';
  }
}

export class NetworkError extends TrpError {
  constructor(message: string, cause?: any) {
    super(`Network error: ${message}`, cause);
    this.name = 'NetworkError';
  }
}

export class StatusCodeError extends TrpError {
  constructor(public statusCode: number, message: string) {
    super(`HTTP error ${statusCode}: ${message}`);
    this.name = 'StatusCodeError';
  }
}

export class JsonRpcError extends TrpError {
  constructor(message: string, public data?: any) {
    super(`JSON-RPC error: ${message}`);
    this.name = 'JsonRpcError';
    this.cause = data;
  }
}
