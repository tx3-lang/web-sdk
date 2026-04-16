import type { TxWitness } from '../trp/spec.js';

export interface Signer {
  address(): string;
  sign(txHashHex: string): Promise<TxWitness>;
}
