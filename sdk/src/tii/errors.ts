import { Tx3Error } from '../core/errors.js';

export abstract class TiiError extends Tx3Error {}

export class InvalidJsonError extends TiiError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`invalid TII JSON: ${message}`, options);
  }
}

export class UnknownTxError extends TiiError {
  readonly tx: string;
  constructor(tx: string) {
    super(`unknown tx: ${tx}`);
    this.tx = tx;
  }
}

export class UnknownProfileError extends TiiError {
  readonly profile: string;
  constructor(profile: string) {
    super(`unknown profile: ${profile}`);
    this.profile = profile;
  }
}
