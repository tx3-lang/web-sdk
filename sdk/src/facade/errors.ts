import { Tx3Error } from '../core/errors.js';
import type { TxStage } from '../trp/spec.js';

export abstract class ResolutionError extends Tx3Error {}

export class UnknownPartyError extends ResolutionError {
  readonly party: string;

  constructor(party: string) {
    super(`unknown party: ${party}`);
    this.party = party;
  }
}

export class MissingParamsError extends ResolutionError {
  readonly params: string[];

  constructor(params: string[]) {
    super(`missing required params: ${JSON.stringify(params)}`);
    this.params = params;
  }
}

export abstract class SubmissionError extends Tx3Error {}

export class SubmitHashMismatchError extends SubmissionError {
  readonly expected: string;
  readonly received: string;

  constructor(expected: string, received: string) {
    super(`submit hash mismatch: expected ${expected}, got ${received}`);
    this.expected = expected;
    this.received = received;
  }
}

export abstract class PollingError extends Tx3Error {}

export class FinalizedFailedError extends PollingError {
  readonly hash: string;
  readonly stage: TxStage;

  constructor(hash: string, stage: TxStage) {
    super(`tx ${hash} failed with stage ${stage}`);
    this.hash = hash;
    this.stage = stage;
  }
}

export class FinalizedTimeoutError extends PollingError {
  readonly hash: string;
  readonly attempts: number;
  readonly delayMs: number;

  constructor(hash: string, attempts: number, delayMs: number) {
    super(
      `tx ${hash} not confirmed after ${attempts} attempts (delay ${delayMs}ms)`,
    );
    this.hash = hash;
    this.attempts = attempts;
    this.delayMs = delayMs;
  }
}
