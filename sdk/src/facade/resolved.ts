import type { TrpClient } from '../trp/client.js';
import type { SubmitParams, TxWitness } from '../trp/spec.js';
import { SignedTx, type WitnessInfo } from './signed.js';

interface SignerEntry {
  name: string;
  address: string;
  signer: { sign(txHashHex: string): Promise<TxWitness> };
}

export class ResolvedTx {
  readonly hash: string;
  readonly txHex: string;
  readonly #trp: TrpClient;
  readonly #signers: SignerEntry[];

  constructor(
    trp: TrpClient,
    hash: string,
    txHex: string,
    signers: SignerEntry[],
  ) {
    this.#trp = trp;
    this.hash = hash;
    this.txHex = txHex;
    this.#signers = signers;
  }

  signingHash(): string {
    return this.hash;
  }

  async sign(): Promise<SignedTx> {
    const witnesses: TxWitness[] = [];
    const witnessesInfo: WitnessInfo[] = [];

    for (const entry of this.#signers) {
      const witness = await entry.signer.sign(this.hash);
      witnessesInfo.push({
        party: entry.name,
        address: entry.address,
        key: witness.key,
        signature: witness.signature,
        witnessType: witness.type,
        signedHash: this.hash,
      });
      witnesses.push(witness);
    }

    const submitParams: SubmitParams = {
      tx: { content: this.txHex, contentType: 'hex' },
      witnesses,
    };

    return new SignedTx(this.#trp, this.hash, submitParams, witnessesInfo);
  }
}
