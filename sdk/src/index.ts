// Facade (§3.3–§3.7)
export { Tx3Client } from './facade/client.js';
export { Party } from './facade/party.js';
export { PollConfig } from './facade/poll.js';
export { TxBuilder } from './facade/builder.js';
export { ResolvedTx } from './facade/resolved.js';
export { SignedTx, type WitnessInfo } from './facade/signed.js';
export { SubmittedTx } from './facade/submitted.js';

// Signers (§3.5)
export { CardanoSigner } from './signer/cardano.js';
export { Ed25519Signer } from './signer/ed25519.js';
export type { Signer } from './signer/signer.js';

// TII (§3.1)
export { Protocol } from './tii/protocol.js';
export { Invocation } from './tii/invocation.js';

// TRP (§3.2)
export { TrpClient } from './trp/client.js';
export type {
  TxStage,
  TxStatus,
  TxEnvelope,
  SubmitParams,
  SubmitResponse,
  CheckStatusResponse,
  TxWitness,
} from './trp/spec.js';

// Core (§3.8–§3.9)
export type { ArgValue } from './core/args.js';
export { toJson, fromJson } from './core/args.js';
export type { BytesEnvelope } from './core/bytes.js';

// Error roots + key subclasses
export { Tx3Error, ArgValueError } from './core/errors.js';
export { TrpError } from './trp/errors.js';
export {
  TiiError,
  UnknownTxError,
  UnknownProfileError,
} from './tii/errors.js';
export { SignerError } from './signer/errors.js';
export {
  ResolutionError,
  UnknownPartyError,
  MissingParamsError,
  SubmissionError,
  SubmitHashMismatchError,
  PollingError,
  FinalizedFailedError,
  FinalizedTimeoutError,
} from './facade/errors.js';

// Namespace re-exports for drill-down
export * as trp from './trp/index.js';
export * as tii from './tii/index.js';
export * as signer from './signer/index.js';
