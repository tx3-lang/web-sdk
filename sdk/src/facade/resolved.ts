import type { Signer } from '../signer/signer.js';
import type { TrpClient } from '../trp/client.js';
import type { SubmitParams, TxWitness } from '../trp/spec.js';
import { SignedTx, type WitnessInfo } from './signed.js';

interface SignerEntry {
  name: string;
  address: string;
  signer: Signer;
}

export class ResolvedTx {
  readonly hash: string;
  readonly txHex: string;
  readonly #trp: TrpClient;
  readonly #signers: SignerEntry[];
  readonly #manualWitnesses: TxWitness[] = [];

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

  /**
   * Attaches a pre-computed witness produced outside any registered `Signer`.
   *
   * Canonical entry point for wallet-app integrations: hand `txHex` (or `hash`)
   * to an external wallet, get back a witness, attach it before calling `sign()`.
   * The witness is appended to the TRP `SubmitParams.witnesses` array after any
   * witnesses produced by registered signer parties, in attach order. May be
   * called any number of times.
   *
   * The SDK does not verify the witness against the tx hash; that binding is
   * enforced by TRP at submit time.
   */
  addWitness(witness: TxWitness): this {
    this.#manualWitnesses.push(witness);
    return this;
  }

  async sign(): Promise<SignedTx> {
    const witnesses: TxWitness[] = [];
    const witnessesInfo: WitnessInfo[] = [];

    const request = { txHashHex: this.hash, txCborHex: this.txHex };
    for (const entry of this.#signers) {
      const witness = await entry.signer.sign(request);
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

    for (const witness of this.#manualWitnesses) {
      witnessesInfo.push({
        party: '<external>',
        address: '',
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
