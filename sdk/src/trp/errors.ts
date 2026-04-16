import { Tx3Error } from '../core/index.js';
import type {
  InputNotResolvedDiagnostic,
  MissingTxArgDiagnostic,
  TxScriptFailureDiagnostic,
  UnsupportedTirDiagnostic,
} from './spec.js';

export abstract class TrpError extends Tx3Error {}

export class NetworkError extends TrpError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`network error: ${message}`, options);
  }
}

export class HttpError extends TrpError {
  constructor(
    readonly status: number,
    readonly statusText: string,
  ) {
    super(`HTTP error ${status}: ${statusText}`);
  }
}

export class DeserializationError extends TrpError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`failed to deserialize response: ${message}`, options);
  }
}

export class MalformedResponseError extends TrpError {
  constructor(message: string) {
    super(`malformed JSON-RPC response: ${message}`);
  }
}

export class GenericRpcError extends TrpError {
  constructor(
    readonly code: number,
    readonly rpcMessage: string,
    readonly data: unknown,
  ) {
    super(`(${code}) ${rpcMessage}`);
  }
}

export class UnsupportedTirError extends TrpError {
  constructor(readonly diagnostic: UnsupportedTirDiagnostic) {
    super(
      `TIR version ${diagnostic.provided} is not supported, expected ${diagnostic.expected}`,
    );
  }
}

export class MissingTxArgError extends TrpError {
  constructor(readonly diagnostic: MissingTxArgDiagnostic) {
    super(`missing argument \`${diagnostic.key}\` of type ${diagnostic.type}`);
  }
}

export class InputNotResolvedError extends TrpError {
  constructor(readonly diagnostic: InputNotResolvedDiagnostic) {
    super(`input \`${diagnostic.name}\` not resolved`);
  }
}

export class TxScriptFailureError extends TrpError {
  constructor(readonly diagnostic: TxScriptFailureDiagnostic) {
    super('tx script returned failure');
  }
}

export class InvalidTirEnvelopeError extends TrpError {
  constructor() {
    super('invalid TIR envelope');
  }
}

export class InvalidTirBytesError extends TrpError {
  constructor() {
    super('failed to decode IR bytes');
  }
}

export class UnsupportedTxEraError extends TrpError {
  constructor() {
    super('only txs from Conway era are supported');
  }
}

export class UnsupportedEraError extends TrpError {
  constructor(readonly era: string) {
    super(`node can't resolve txs while running at era ${era}`);
  }
}
