import { ed25519 } from '@noble/curves/ed25519';
import { mnemonicToSeedSync } from '@scure/bip39';

import { bytesToHex, hexToBytes } from '../core/bytes.js';
import type { TxWitness } from '../trp/spec.js';
import {
  InvalidHashError,
  InvalidMnemonicError,
  InvalidPrivateKeyError,
} from './errors.js';
import type { Signer } from './signer.js';

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

  static fromMnemonic(address: string, phrase: string): Ed25519Signer {
    let seed: Uint8Array;
    try {
      seed = mnemonicToSeedSync(phrase);
    } catch (err) {
      throw new InvalidMnemonicError(err);
    }
    return new Ed25519Signer(address, seed.slice(0, 32));
  }

  address(): string {
    return this.#address;
  }

  async sign(txHashHex: string): Promise<TxWitness> {
    let hashBytes: Uint8Array;
    try {
      hashBytes = hexToBytes(txHashHex);
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
