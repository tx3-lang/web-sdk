import type { ArgMap, TirEnvelope } from '../core/index.js';
import type { TrpClient } from '../trp/client.js';
import type { ResolveParams } from '../trp/spec.js';
import { type Party, partyAddress } from './party.js';
import { ResolvedTx } from './resolved.js';

/**
 * Builder for transaction invocation.
 *
 * Holds the resolve inputs directly: the TIR envelope, the environment values
 * from the selected profile (with builder-supplied overrides already folded
 * in), the bound parties, and the typed args. Drives a single `resolve()` path
 * regardless of whether the upstream was a runtime-loaded `Protocol` or
 * codegen-embedded fragments.
 */
export class TxBuilder {
  readonly #tir: TirEnvelope;
  readonly #trp: TrpClient;
  #env: ArgMap = {};
  readonly #parties: Map<string, Party> = new Map();
  readonly #args: ArgMap = {};

  constructor(trp: TrpClient, tir: TirEnvelope) {
    this.#trp = trp;
    this.#tir = tir;
  }

  /** Sets the environment values applied to this transaction. */
  env(env: ArgMap): this {
    this.#env = { ...env };
    return this;
  }

  /**
   * Attaches party definitions (signers or read-only addresses). Names are
   * matched case-insensitively; later entries override earlier ones.
   */
  parties(parties: Iterable<readonly [string, Party]>): this {
    for (const [name, party] of parties) {
      this.#parties.set(name.toLowerCase(), party);
    }
    return this;
  }

  /** Adds a single argument (case-insensitive name). */
  arg(name: string, value: unknown): this {
    this.#args[name.toLowerCase()] = value;
    return this;
  }

  /** Adds multiple arguments (case-insensitive names). */
  args(map: Record<string, unknown>): this {
    for (const [k, v] of Object.entries(map)) {
      this.#args[k.toLowerCase()] = v;
    }
    return this;
  }

  /** Resolves the transaction through the TRP client. */
  async resolve(): Promise<ResolvedTx> {
    const merged: ArgMap = {};
    for (const [k, v] of Object.entries(this.#env)) merged[k] = v;
    for (const [name, party] of this.#parties) {
      merged[name] = partyAddress(party);
    }
    for (const [k, v] of Object.entries(this.#args)) merged[k] = v;

    const request: ResolveParams = {
      tir: this.#tir,
      args: merged,
    };

    const envelope = await this.#trp.resolve(request);

    const signers: {
      name: string;
      address: string;
      signer: import('../signer/signer.js').Signer;
    }[] = [];
    for (const [name, party] of this.#parties) {
      if (party.kind === 'signer') {
        signers.push({ name, address: party.address, signer: party.signer });
      }
    }

    return new ResolvedTx(this.#trp, envelope.hash, envelope.tx, signers);
  }
}
