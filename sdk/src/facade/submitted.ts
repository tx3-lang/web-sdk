import type { TrpClient } from '../trp/client.js';
import type { TxStatus } from '../trp/spec.js';
import {
  FinalizedFailedError,
  FinalizedTimeoutError,
} from './errors.js';
import type { PollConfig } from './poll.js';

export class SubmittedTx {
  readonly hash: string;
  readonly #trp: TrpClient;

  constructor(trp: TrpClient, hash: string) {
    this.#trp = trp;
    this.hash = hash;
  }

  async waitForConfirmed(config: PollConfig): Promise<TxStatus> {
    return this.#waitForStage(config, 'confirmed');
  }

  async waitForFinalized(config: PollConfig): Promise<TxStatus> {
    return this.#waitForStage(config, 'finalized');
  }

  async #waitForStage(
    config: PollConfig,
    target: 'confirmed' | 'finalized',
  ): Promise<TxStatus> {
    for (let attempt = 1; attempt <= config.attempts; attempt++) {
      const response = await this.#trp.checkStatus([this.hash]);
      const status = response.statuses[this.hash];

      if (status) {
        switch (status.stage) {
          case 'finalized':
            return status;
          case 'confirmed':
            if (target === 'confirmed') return status;
            break;
          case 'dropped':
          case 'rolled_back':
            throw new FinalizedFailedError(this.hash, status.stage);
        }
      }

      if (attempt < config.attempts) {
        await new Promise((r) => setTimeout(r, config.delayMs));
      }
    }

    throw new FinalizedTimeoutError(this.hash, config.attempts, config.delayMs);
  }
}
