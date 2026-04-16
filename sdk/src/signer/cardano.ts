import bip32ed25519 from '@stricahq/bip32ed25519';
type PrivateKey = ReturnType<InstanceType<typeof bip32ed25519.Bip32PrivateKey>['toPrivateKey']>;
type PublicKey = ReturnType<PrivateKey['toPublicKey']>;
import { bech32 } from 'bech32';

import { bytesToHex, hexToBytes } from '../core/bytes.js';
import type { TxWitness } from '../trp/spec.js';
import {
  AddressMismatchError,
  InvalidAddressError,
  InvalidHashError,
  InvalidMnemonicError,
  InvalidPrivateKeyError,
  UnsupportedPaymentCredentialError,
} from './errors.js';
import type { Signer } from './signer.js';

export class CardanoSigner implements Signer {
  readonly #address: string;
  readonly #privateKey: PrivateKey;
  readonly #publicKey: PublicKey;
  private constructor(
    address: string,
    privateKey: PrivateKey,
    publicKey: PublicKey,
  ) {
    this.#address = address;
    this.#privateKey = privateKey;
    this.#publicKey = publicKey;
  }

  static async fromHex(
    address: string,
    privateKeyHex: string,
  ): Promise<CardanoSigner> {
    let keyBytes: Uint8Array;
    try {
      keyBytes = hexToBytes(privateKeyHex);
    } catch (err) {
      throw InvalidPrivateKeyError.hexDecode(err);
    }

    if (keyBytes.length !== 32) {
      throw InvalidPrivateKeyError.badLength(keyBytes.length);
    }

    const privKey = bip32ed25519.PrivateKey.fromSecretKey(Buffer.from(keyBytes));
    const pubKey = privKey.toPublicKey();
    const paymentKeyHash = extractPaymentKeyHash(address);

    verifyAddressBinding(pubKey, paymentKeyHash);

    return new CardanoSigner(address, privKey, pubKey);
  }

  static async fromMnemonic(
    address: string,
    phrase: string,
  ): Promise<CardanoSigner> {
    let entropy: Uint8Array;
    try {
      const { mnemonicToEntropy } = await import('@scure/bip39');
      const { wordlist } = await import('@scure/bip39/wordlists/english');
      entropy = mnemonicToEntropy(phrase, wordlist);
    } catch (err) {
      throw new InvalidMnemonicError(err);
    }

    const root = await bip32ed25519.Bip32PrivateKey.fromEntropy(Buffer.from(entropy));

    const paymentXprv = root
      .deriveHardened(1852)
      .deriveHardened(1815)
      .deriveHardened(0)
      .derive(0)
      .derive(0);

    const privKey = paymentXprv.toPrivateKey();
    const pubKey = privKey.toPublicKey();
    const paymentKeyHash = extractPaymentKeyHash(address);

    verifyAddressBinding(pubKey, paymentKeyHash);

    return new CardanoSigner(address, privKey, pubKey);
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

    const signature = this.#privateKey.sign(Buffer.from(hashBytes));
    const publicKeyBytes = this.#publicKey.toBytes();

    return {
      key: { content: bytesToHex(publicKeyBytes), contentType: 'hex' },
      signature: { content: bytesToHex(signature), contentType: 'hex' },
      type: 'vkey',
    };
  }
}

function extractPaymentKeyHash(address: string): Uint8Array {
  let decoded: { prefix: string; words: number[] };
  try {
    decoded = bech32.decode(address, 1023);
  } catch (err) {
    throw new InvalidAddressError(`bech32 decode failed: ${address}`, {
      cause: err,
    });
  }

  const data = bech32.fromWords(decoded.words);

  if (data.length < 29) {
    throw new UnsupportedPaymentCredentialError();
  }

  const headerByte = data[0];
  const addressType = (headerByte >> 4) & 0x0f;

  // Shelley base addresses: types 0x00..0x03
  // Shelley enterprise addresses: types 0x06..0x07
  if (
    addressType > 0x03 &&
    addressType !== 0x06 &&
    addressType !== 0x07
  ) {
    throw new UnsupportedPaymentCredentialError();
  }

  // Bit 0 of header = 0 means key hash, 1 means script hash
  if (headerByte & 0x10) {
    throw new UnsupportedPaymentCredentialError();
  }

  return new Uint8Array(data.slice(1, 29));
}

function verifyAddressBinding(
  pubKey: PublicKey,
  paymentKeyHash: Uint8Array,
): void {
  const derivedHash = pubKey.hash();

  if (derivedHash.length !== paymentKeyHash.length) {
    throw new AddressMismatchError();
  }

  for (let i = 0; i < paymentKeyHash.length; i++) {
    if (derivedHash[i] !== paymentKeyHash[i]) {
      throw new AddressMismatchError();
    }
  }
}
