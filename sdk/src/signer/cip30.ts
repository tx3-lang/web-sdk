import { decode as decodeCbor } from 'cborg';
import { bech32 } from 'bech32';

import { Tx3Error } from '../core/errors.js';
import { bytesToHex, hexToBytes } from '../core/bytes.js';
import { Party } from '../facade/party.js';
import type { TxWitness } from '../trp/spec.js';
import type { SignRequest, Signer } from './signer.js';

/**
 * Minimal subset of the CIP-30 wallet API used by this signer. Any object
 * conforming to this shape — including the full
 * [`@cardano-foundation/cardano-connect-with-wallet-core`](https://www.npmjs.com/package/@cardano-foundation/cardano-connect-with-wallet-core)
 * API instance — can be passed to `Cip30Signer`.
 *
 * @see https://cips.cardano.org/cip/CIP-0030
 */
export interface Cip30Api {
  /**
   * Signs a transaction. Returns the hex-encoded CBOR `transaction_witness_set`.
   * `partialSign: true` is the right default for our flow because TRP/registered
   * signers may also contribute witnesses to the same submission.
   */
  signTx(txCborHex: string, partialSign?: boolean): Promise<string>;
  /** Returns a hex-encoded change address to bind to this signer. */
  getChangeAddress(): Promise<string>;
  /** Returns the wallet's network id. 0 for testnet/preprod, 1 for mainnet. */
  getNetworkId(): Promise<number>;
}

/** Errors raised by the CIP-30 signer. */
export class Cip30AdapterError extends Tx3Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`CIP-30: ${message}`, options);
  }
}

/**
 * `Signer` backed by a CIP-30 browser wallet (Eternl, Lace, Nami, …).
 *
 * Bound at construction to a single bech32 address (typically the wallet's
 * change address). At sign time it calls {@link Cip30Api.signTx} with the full
 * tx CBOR (read from the {@link SignRequest}'s `txCborHex` field, ignoring
 * `txHashHex`), decodes the returned witness set, and emits the **first** vkey
 * witness it finds.
 *
 * **Single-key wallets only.** A wallet that signs with multiple keys in one
 * prompt returns a witness set with multiple vkey witnesses; this signer logs a
 * `console.warn` and emits only the first. Consumers needing every witness
 * should call {@link decodeWitnessSet} directly and attach each via
 * `ResolvedTx.addWitness`.
 *
 * @example
 *   import { Cip30Signer, cip30Party } from 'tx3-sdk/signer';
 *   const sender = await cip30Party(window.cardano.eternl.enable());
 *   const tx3 = new Tx3Client(protocol, trp).withParty('sender', sender);
 */
export class Cip30Signer implements Signer {
  readonly #api: Cip30Api;
  readonly #address: string;
  readonly #partialSign: boolean;

  constructor(api: Cip30Api, address: string, opts?: { partialSign?: boolean }) {
    this.#api = api;
    this.#address = address;
    this.#partialSign = opts?.partialSign ?? true;
  }

  address(): string {
    return this.#address;
  }

  async sign(request: SignRequest): Promise<TxWitness> {
    let witnessSetHex: string;
    try {
      witnessSetHex = await this.#api.signTx(request.txCborHex, this.#partialSign);
    } catch (cause) {
      throw new Cip30AdapterError('wallet rejected signTx', { cause });
    }

    const witnesses = decodeWitnessSet(witnessSetHex);
    if (witnesses.length === 0) {
      throw new Cip30AdapterError('wallet returned no vkey witnesses');
    }
    if (witnesses.length > 1) {
      console.warn(
        `Cip30Signer: wallet returned ${witnesses.length} vkey witnesses; ` +
          'using only the first. Multi-key wallets should call decodeWitnessSet ' +
          'directly and attach each witness via ResolvedTx.addWitness.',
      );
    }
    return witnesses[0];
  }
}

/**
 * Decodes a hex-encoded CBOR `transaction_witness_set` into one `TxWitness`
 * per vkey witness. Use this to support multi-key wallets where every
 * witness must be attached.
 */
export function decodeWitnessSet(witnessSetHex: string): TxWitness[] {
  let bytes: Uint8Array;
  try {
    bytes = hexToBytes(witnessSetHex);
  } catch (cause) {
    throw new Cip30AdapterError('witness set is not valid hex', { cause });
  }

  let decoded: unknown;
  try {
    decoded = decodeCbor(bytes, { useMaps: true });
  } catch (cause) {
    throw new Cip30AdapterError('witness set is not valid CBOR', { cause });
  }

  if (!(decoded instanceof Map)) {
    throw new Cip30AdapterError('witness set is not a CBOR map');
  }

  const vkeyArray = decoded.get(0);
  if (vkeyArray === undefined) {
    return [];
  }
  if (!Array.isArray(vkeyArray)) {
    throw new Cip30AdapterError('witness set key 0 is not an array');
  }

  return vkeyArray.map((entry, idx) => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Cip30AdapterError(`vkey witness ${idx} is not a [key, sig] pair`);
    }
    const [key, sig] = entry;
    if (!(key instanceof Uint8Array) || !(sig instanceof Uint8Array)) {
      throw new Cip30AdapterError(`vkey witness ${idx} fields are not bytestrings`);
    }
    const witness: TxWitness = {
      key: { content: bytesToHex(key), contentType: 'hex' },
      signature: { content: bytesToHex(sig), contentType: 'hex' },
      type: 'vkey',
    };
    return witness;
  });
}

/**
 * Async factory: queries the wallet for its change address and returns a
 * {@link Party} backed by a {@link Cip30Signer}.
 *
 * ```ts
 * import { cip30Party } from 'tx3-sdk/signer';
 *
 * const sender = await cip30Party(await window.cardano.eternl.enable());
 * const tx3 = new Tx3Client(protocol, trp).withParty('sender', sender);
 * ```
 */
export async function cip30Party(
  api: Cip30Api,
  opts?: { partialSign?: boolean },
): Promise<Party> {
  let addressHex: string;
  try {
    addressHex = await api.getChangeAddress();
  } catch (cause) {
    throw new Cip30AdapterError('wallet rejected getChangeAddress', { cause });
  }

  let networkId = 0;
  try {
    networkId = await api.getNetworkId();
  } catch {
    // best-effort; default to testnet
  }

  const address = encodeBech32(addressHex, networkId);
  return Party.signer(new Cip30Signer(api, address, opts));
}

function encodeBech32(addressHex: string, networkId: number): string {
  const bytes = hexToBytes(addressHex);
  const header = bytes[0] ?? 0;
  const isReward = (header & 0xf0) === 0xe0 || (header & 0xf0) === 0xf0;
  const base = isReward ? 'stake' : 'addr';
  const hrp = networkId === 1 ? base : `${base}_test`;
  return bech32.encode(hrp, bech32.toWords(bytes), 1023);
}
