import { ed25519 } from '@noble/curves/ed25519';

import { bytesToHex, hexToBytes } from '../core/bytes.js';
import type { TxWitness } from '../trp/spec.js';
import { InvalidHashError, InvalidPrivateKeyError } from './errors.js';
import type { SignRequest, Signer } from './signer.js';

/**
 * Generic raw-key ed25519 signer (RFC 8032): a 32-byte private key plus the
 * address it answers for.
 *
 * There is intentionally no mnemonic constructor here: a Cardano address
 * derived per CIP-1852 binds to a BIP32-Ed25519 extended key, which a raw
 * ed25519 signer cannot reproduce — use `CardanoSigner.fromMnemonic` for
 * mnemonic-based signing.
 */
export class Ed25519Signer implements Signer {
  readonly #address: string;
  readonly #privateKey: Uint8Array;

  constructor(address: string, privateKey: Uint8Array) {
    if (privateKey.length !== 32) {
      throw InvalidPrivateKeyError.badLength(privateKey.length);
    }
    this.#address = address;
    this.#privateKey = privateKey;
  }

  static fromHex(address: string, privateKeyHex: string): Ed25519Signer {
    let keyBytes: Uint8Array;
    try {
      keyBytes = hexToBytes(privateKeyHex);
    } catch (err) {
      throw InvalidPrivateKeyError.hexDecode(err);
    }
    return new Ed25519Signer(address, keyBytes);
  }

  address(): string {
    return this.#address;
  }

  async sign(request: SignRequest): Promise<TxWitness> {
    let hashBytes: Uint8Array;
    try {
      hashBytes = hexToBytes(request.txHashHex);
    } catch (err) {
      throw InvalidHashError.hexDecode(err);
    }

    if (hashBytes.length !== 32) {
      throw InvalidHashError.badLength(hashBytes.length);
    }

    const publicKey = ed25519.getPublicKey(this.#privateKey);
    const signature = ed25519.sign(hashBytes, this.#privateKey);

    return {
      key: { content: bytesToHex(publicKey), contentType: 'hex' },
      signature: { content: bytesToHex(signature), contentType: 'hex' },
      type: 'vkey',
    };
  }
}
