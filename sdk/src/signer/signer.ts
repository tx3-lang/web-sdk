import type { TxWitness } from '../trp/spec.js';

/**
 * Inputs passed to a `Signer` for each sign call. Carries both the bound
 * tx hash and the full hex-encoded tx CBOR. Hash-based signers (Cardano
 * Ed25519) read `txHashHex`; tx-based signers (CIP-30 wallets) read
 * `txCborHex`. The SDK always populates both fields.
 */
export interface SignRequest {
  readonly txHashHex: string;
  readonly txCborHex: string;
}

export interface Signer {
  address(): string;
  sign(request: SignRequest): Promise<TxWitness>;
}
