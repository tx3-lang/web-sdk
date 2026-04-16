import {
  DeserializationError,
  GenericRpcError,
  HttpError,
  InputNotResolvedError,
  MalformedResponseError,
  MissingTxArgError,
  NetworkError,
  TxScriptFailureError,
  UnsupportedTirError,
} from './errors.js';
import type {
  CheckStatusResponse,
  DumpLogsResponse,
  InputNotResolvedDiagnostic,
  MissingTxArgDiagnostic,
  PeekInflightResponse,
  PeekPendingResponse,
  ResolveParams,
  SubmitParams,
  SubmitResponse,
  TxEnvelope,
  TxScriptFailureDiagnostic,
  UnsupportedTirDiagnostic,
} from './spec.js';

export interface ClientOptions {
  endpoint: string;
  headers?: Record<string, string>;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: unknown;
  id: string;
}

interface JsonRpcResponse {
  result?: unknown;
  error?: JsonRpcErrorPayload;
}

interface JsonRpcErrorPayload {
  code: number;
  message: string;
  data?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function mapRpcError(payload: JsonRpcErrorPayload): Error {
  switch (payload.code) {
    case -32000: {
      if (isPlainObject(payload.data)) {
        return new UnsupportedTirError(payload.data as unknown as UnsupportedTirDiagnostic);
      }
      return new GenericRpcError(payload.code, payload.message, payload.data);
    }
    case -32001: {
      if (isPlainObject(payload.data)) {
        return new MissingTxArgError(payload.data as unknown as MissingTxArgDiagnostic);
      }
      return new GenericRpcError(payload.code, payload.message, payload.data);
    }
    case -32002: {
      if (isPlainObject(payload.data)) {
        return new InputNotResolvedError(payload.data as unknown as InputNotResolvedDiagnostic);
      }
      return new GenericRpcError(payload.code, payload.message, payload.data);
    }
    case -32003: {
      if (isPlainObject(payload.data)) {
        return new TxScriptFailureError(payload.data as unknown as TxScriptFailureDiagnostic);
      }
      return new GenericRpcError(payload.code, payload.message, payload.data);
    }
    default:
      return new GenericRpcError(payload.code, payload.message, payload.data);
  }
}

export class TrpClient {
  constructor(private readonly options: ClientOptions) {}

  async call(method: string, params: unknown): Promise<unknown> {
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: randomId(),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.options.headers ?? {}),
    };

    let response: Response;
    try {
      response = await fetch(this.options.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new NetworkError(err instanceof Error ? err.message : String(err), { cause: err });
    }

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText);
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (err) {
      throw new DeserializationError(err instanceof Error ? err.message : String(err), {
        cause: err,
      });
    }

    if (!isPlainObject(parsed)) {
      throw new MalformedResponseError('response body is not an object');
    }

    const rpc = parsed as JsonRpcResponse;

    if (rpc.error !== undefined) {
      if (!isPlainObject(rpc.error) || typeof (rpc.error as JsonRpcErrorPayload).code !== 'number') {
        throw new MalformedResponseError('malformed error payload');
      }
      throw mapRpcError(rpc.error);
    }

    if (rpc.result === undefined) {
      throw new MalformedResponseError('missing `result` field');
    }

    return rpc.result;
  }

  async resolve(request: ResolveParams): Promise<TxEnvelope> {
    const result = await this.call('trp.resolve', request);
    if (!isPlainObject(result) || typeof result.hash !== 'string' || typeof result.tx !== 'string') {
      throw new DeserializationError('invalid TxEnvelope shape');
    }
    return result as unknown as TxEnvelope;
  }

  async submit(request: SubmitParams): Promise<SubmitResponse> {
    const result = await this.call('trp.submit', request);
    if (!isPlainObject(result) || typeof result.hash !== 'string') {
      throw new DeserializationError('invalid SubmitResponse shape');
    }
    return result as unknown as SubmitResponse;
  }

  async checkStatus(hashes: string[]): Promise<CheckStatusResponse> {
    const result = await this.call('trp.checkStatus', { hashes });
    if (!isPlainObject(result) || !isPlainObject(result.statuses)) {
      throw new DeserializationError('invalid CheckStatusResponse shape');
    }
    return result as unknown as CheckStatusResponse;
  }

  async dumpLogs(
    cursor?: number,
    limit?: number,
    includePayload?: boolean,
  ): Promise<DumpLogsResponse> {
    const params: Record<string, unknown> = {};
    if (cursor !== undefined) params.cursor = cursor;
    if (limit !== undefined) params.limit = limit;
    if (includePayload !== undefined) params.includePayload = includePayload;
    const result = await this.call('trp.dumpLogs', params);
    if (!isPlainObject(result) || !Array.isArray(result.entries)) {
      throw new DeserializationError('invalid DumpLogsResponse shape');
    }
    return result as unknown as DumpLogsResponse;
  }

  async peekPending(limit?: number, includePayload?: boolean): Promise<PeekPendingResponse> {
    const params: Record<string, unknown> = {};
    if (limit !== undefined) params.limit = limit;
    if (includePayload !== undefined) params.includePayload = includePayload;
    const result = await this.call('trp.peekPending', params);
    if (!isPlainObject(result) || !Array.isArray(result.entries) || typeof result.hasMore !== 'boolean') {
      throw new DeserializationError('invalid PeekPendingResponse shape');
    }
    return result as unknown as PeekPendingResponse;
  }

  async peekInflight(limit?: number, includePayload?: boolean): Promise<PeekInflightResponse> {
    const params: Record<string, unknown> = {};
    if (limit !== undefined) params.limit = limit;
    if (includePayload !== undefined) params.includePayload = includePayload;
    const result = await this.call('trp.peekInflight', params);
    if (!isPlainObject(result) || !Array.isArray(result.entries) || typeof result.hasMore !== 'boolean') {
      throw new DeserializationError('invalid PeekInflightResponse shape');
    }
    return result as unknown as PeekInflightResponse;
  }
}
