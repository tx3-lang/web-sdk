import { toJson } from "./args.js";
import {
  ArgValue,
  ClientOptions,
  isCustomArgValue,
  JsonRpcError,
  NetworkError,
  ProtoTxRequest,
  ResolveResponse,
  StatusCodeError,
  SubmitParams,
  TrpError,
} from "./types.js";

interface JsonRpcResponse<T = any> {
  result?: T;
  error?: {
    message: string;
    data?: any;
  };
}

/**
 * Client for the Transaction Resolve Protocol (TRP)
 */
export class Client {
  private readonly options: ClientOptions;

  constructor(options: ClientOptions) {
    this.options = options;
  }

  /**
   * Prepare headers for JSON-RPC requests
   */
  private prepareHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...this.options.headers,
    };
  }

  /**
   * Handle JSON-RPC request/response cycle
   */
  private async makeJsonRpcRequest<T>(method: string, params: any): Promise<T> {
    try {
      // Prepare request body
      const body = {
        jsonrpc: "2.0",
        method,
        params,
        id: crypto.randomUUID(),
      };

      // Send request
      const response = await fetch(this.options.endpoint, {
        method: "POST",
        headers: this.prepareHeaders(),
        body: JSON.stringify(body),
      });

      // Check if response is successful
      if (!response.ok) {
        throw new StatusCodeError(response.status, response.statusText);
      }

      // Parse response
      const result: JsonRpcResponse<T> = await response.json();

      // Handle possible error
      if (result.error) {
        throw new JsonRpcError(result.error.message, result.error.data);
      }

      // Return result
      if (result.result === undefined && method !== "trp.submit") {
        throw new TrpError("No result in response");
      }

      return result.result!;
    } catch (error) {
      if (error instanceof TrpError) {
        throw error;
      }

      // Handle fetch errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new NetworkError(error.message, error);
      }

      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        throw new TrpError(`Failed to parse response: ${error.message}`, error);
      }

      // Re-throw other errors
      throw new TrpError(`Unknown error: ${error}`, error);
    }
  }

  /**
   * Convert arguments to JSON format
   */
  private convertArgsToJson(
    args: Record<string, any>,
    force_snake_case: boolean,
  ): Record<string, any> {
    const convertValue = (value: any): any => {
      // Already a PrimitiveArgValue
      if (
        value &&
        typeof value === "object" &&
        "type" in value &&
        "value" in value
      ) {
        return toJson(value);
      }

      if (isCustomArgValue(value)) {
        return toJson(value);
      }

      if (Array.isArray(value)) {
        return value.map((el) => {
          if (el && typeof el === "object" && "type" in el && "value" in el) {
            return toJson(el);
          }

          if (isCustomArgValue(el)) {
            return toJson(el);
          }

          try {
            return toJson(ArgValue.from(el));
          } catch {
            return convertValue(el);
          }
        });
      }

      // Try converting primitives
      try {
        return toJson(ArgValue.from(value));
      } catch {
        // If plain object, convert each field recursively
        if (value && typeof value === "object") {
          const objResult: Record<string, any> = {};
          for (const [k, v] of Object.entries(value)) {
            objResult[k] = convertValue(v);
          }
          return objResult;
        }

        return value;
      }
    };

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      const newKey = force_snake_case
        ? key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
        : key;

      result[newKey] = convertValue(value);
    }
    return result;
  }

  /**
   * Resolve a proto transaction to a concrete transaction
   */
  async resolve(protoTx: ProtoTxRequest): Promise<ResolveResponse> {
    // Convert args to JSON format
    const args = this.convertArgsToJson(protoTx.args, true);

    // Convert envArgs to JSON format if they exist
    let envArgs: Record<string, any> | undefined;
    if (this.options.envArgs) {
      envArgs = this.convertArgsToJson(this.options.envArgs, false);
    }

    // Prepare parameters
    const params = {
      tir: protoTx.tir,
      args,
      env: envArgs,
    };

    return this.makeJsonRpcRequest<ResolveResponse>("trp.resolve", params);
  }

  /**
   * Submit a signed transaction to the network
   */
  async submit(params: SubmitParams): Promise<void> {
    await this.makeJsonRpcRequest<void>("trp.submit", params);
  }
}
