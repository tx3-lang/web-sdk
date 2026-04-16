import type { BytesEnvelope } from '../core/bytes.js';
import type { TrpClient } from '../trp/client.js';
import type { SubmitParams, WitnessType } from '../trp/spec.js';
import { SubmitHashMismatchError } from './errors.js';
import { SubmittedTx } from './submitted.js';

export interface WitnessInfo {
  party: string;
  address: string;
  key: BytesEnvelope;
  signature: BytesEnvelope;
  witnessType: WitnessType;
  signedHash: string;
}

export class SignedTx {
  readonly hash: string;
  readonly submitParams: SubmitParams;
  readonly #trp: TrpClient;
  readonly #witnessesInfo: WitnessInfo[];

  constructor(
    trp: TrpClient,
    hash: string,
    submitParams: SubmitParams,
    witnessesInfo: WitnessInfo[],
  ) {
    this.#trp = trp;
    this.hash = hash;
    this.submitParams = submitParams;
    this.#witnessesInfo = witnessesInfo;
  }

  witnesses(): readonly WitnessInfo[] {
    return this.#witnessesInfo;
  }

  async submit(): Promise<SubmittedTx> {
    const response = await this.#trp.submit(this.submitParams);

    if (response.hash !== this.hash) {
      throw new SubmitHashMismatchError(this.hash, response.hash);
    }

    return new SubmittedTx(this.#trp, response.hash);
  }
}
