type StringArg = { type: 'string'; value: string };
type NumberArg = { type: 'number'; value: number };
type BooleanArg = { type: 'boolean'; value: boolean };
type NullArg = { type: 'null'; value: null };
type BytesArg = { type: 'bytes'; value: { content: string, encoding: 'hex' | 'base64' } };

type EncodedArgValue = StringArg | NumberArg | BooleanArg | NullArg | BytesArg;

type EncodedArgs = {
  [key: string]: EncodedArgValue;
};
type ArgValue = string | number | boolean | null | Uint8Array;

type Args = {
  [key: string]: ArgValue
}
function encodeArgValue(val: ArgValue, encoding: BytesArg['value']['encoding'] = 'hex'): EncodedArgValue {
  if (val === null) return { type: 'null', value: null };
  if (typeof val === 'string') return { type: 'string', value: val };
  if (typeof val === 'number') return { type: 'number', value: val };
  if (typeof val === 'boolean') return { type: 'boolean', value: val };
  if (val instanceof Uint8Array) {
    return {
      type: 'bytes',
      value: {
        content:Buffer.from(val).toString(encoding),
        encoding
    }
    };
  }
  throw new Error('Unsupported value type');
}

export type TirEnvelope = {
  version: string;
  bytecode: string;
  encoding: "base64" | "hex" | string;
};

export type ProtoTx = {
  tir: TirEnvelope;
  args: Args;
};

export type TxEnvelope = {
  tx: string;
  bytes: string;
  encoding: "base64" | "hex" | string;
};

export type ClientOptions = {
  endpoint: string;
  headers?: Record<string, string>;
  envArgs?: Args;
};

export class Client {
  private readonly options: ClientOptions;

  constructor(options: ClientOptions) {
    this.options = options;
  }

  async resolve(protoTx: ProtoTx): Promise<TxEnvelope> {
    const encodedArgs = Object.entries(protoTx.args).reduce((acc, [k, v]) => {
      acc[k] = encodeArgValue(v);
      return acc;
    }, {} as EncodedArgs);
    const response = await fetch(this.options.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.options.headers,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "trp.resolve",
        params: {
          tir: protoTx.tir,
          args: encodedArgs,
          env: this.options.envArgs,
        },
        id: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve transaction: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`JSON-RPC error: ${result.error.message}`, { cause: result.error.data });
    }

    return result.result as TxEnvelope;
  }
}
