type ArgValue = string | number | boolean | null | Uint8Array;

type Args = {
  [key: string]: ArgValue;
};

export type BytesEnvelope = {
  content: string;
  encoding: "base64" | "hex" | string;
};

export type TirEnvelope = {
  version: string;
  bytecode: string;
  encoding: "base64" | "hex" | string;
};

export type ProtoTx = {
  tir: TirEnvelope;
  args: Args;
};

export type ResolveResponse = {
  tx: string;
  hash: string;
};

export type VKeyWitness = {
  type: "vkey";
  key: BytesEnvelope;
  signature: BytesEnvelope;
};

export type SubmitWitness = VKeyWitness;

export type SubmitParams = {
  tx: BytesEnvelope;
  witnesses: SubmitWitness[];
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

  private handleArgs(args: Args): Object {
    const trpValues = Object.fromEntries(
      Object.entries(args).map(([key, value]) => {
        const trpKey = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

        if (value instanceof Uint8Array) {
          return [trpKey, `0x${Buffer.from(value).toString("hex")}`];
        }

        return [trpKey, value];
      })
    );

    return trpValues;
  }

  async resolve(protoTx: ProtoTx): Promise<ResolveResponse> {
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
          args: this.handleArgs(protoTx.args),
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
      throw new Error(`JSON-RPC error: ${result.error.message}`, {
        cause: result.error.data,
      });
    }

    return result.result as ResolveResponse;
  }

  async submit(params: SubmitParams): Promise<void> {
    const response = await fetch(this.options.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.options.headers,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "trp.submit",
        params,
        id: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve transaction: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`JSON-RPC error: ${result.error.message}`, {
        cause: result.error.data,
      });
    }
  }
}
