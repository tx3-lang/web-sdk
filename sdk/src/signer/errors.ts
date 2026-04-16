import { Tx3Error } from '../core/errors.js';

export abstract class SignerError extends Tx3Error {}

export class InvalidMnemonicError extends SignerError {
  constructor(cause?: unknown) {
    super('invalid mnemonic phrase', { cause });
  }
}

export class InvalidPrivateKeyError extends SignerError {
  readonly length: number | undefined;

  constructor(message: string, options?: { cause?: unknown; length?: number }) {
    super(`invalid private key: ${message}`, { cause: options?.cause });
    this.length = options?.length ?? undefined;
  }

  static hexDecode(cause: unknown): InvalidPrivateKeyError {
    return new InvalidPrivateKeyError('hex decode failed', { cause });
  }

  static badLength(got: number): InvalidPrivateKeyError {
    return new InvalidPrivateKeyError(
      `must be 32 bytes, got ${got}`,
      { length: got },
    );
  }
}

export class InvalidHashError extends SignerError {
  readonly length: number | undefined;

  constructor(message: string, options?: { cause?: unknown; length?: number }) {
    super(`invalid tx hash: ${message}`, { cause: options?.cause });
    this.length = options?.length ?? undefined;
  }

  static hexDecode(cause: unknown): InvalidHashError {
    return new InvalidHashError('hex decode failed', { cause });
  }

  static badLength(got: number): InvalidHashError {
    return new InvalidHashError(
      `must be 32 bytes, got ${got}`,
      { length: got },
    );
  }
}

export class InvalidAddressError extends SignerError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`invalid address: ${message}`, options);
  }
}

export class UnsupportedPaymentCredentialError extends SignerError {
  constructor() {
    super('address does not contain a payment key hash');
  }
}

export class AddressMismatchError extends SignerError {
  constructor() {
    super("signer key doesn't match address payment key");
  }
}
