import { v4 as uuidv4} from 'uuid';

import { 
  ClientOptions, 
  ProtoTxRequest, 
  TxEnvelope, 
  TrpError, 
  NetworkError, 
  StatusCodeError, 
  JsonRpcError 
} from './types.js';
import { toJson } from './args.js';

interface JsonRpcResponse {
  result?: TxEnvelope;
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
   * Resolve a proto transaction to a concrete transaction
   */
  async resolve(protoTx: ProtoTxRequest): Promise<TxEnvelope> {
    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.options.headers,
      };

      // Convert args to JSON format
      const args: Record<string, any> = {};
      for (const [key, value] of Object.entries(protoTx.args)) {
        args[key] = toJson(value);
      }

      // Convert envArgs to JSON format if they exist
      let envArgs: Record<string, any> | undefined;
      if (this.options.envArgs) {
        envArgs = {};
        for (const [key, value] of Object.entries(this.options.envArgs)) {
          envArgs[key] = toJson(value);
        }
      }

      // Prepare request body
      const body = {
        jsonrpc: '2.0',
        method: 'trp.resolve',
        params: {
          tir: protoTx.tir,
          args,
          env: envArgs,
        },
        id: uuidv4(),
      };

      // Send request
      const response = await fetch(this.options.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // Check if response is successful
      if (!response.ok) {
        throw new StatusCodeError(response.status, response.statusText);
      }

      // Parse response
      const result: JsonRpcResponse = await response.json();

      // Handle possible error
      if (result.error) {
        throw new JsonRpcError(result.error.message, result.error.data);
      }

      // Return result
      if (!result.result) {
        throw new TrpError('No result in response');
      }

      return result.result;
    } catch (error) {
      if (error instanceof TrpError) {
        throw error;
      }
      
      // Handle fetch errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
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
}
