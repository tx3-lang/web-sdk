import type { ArgMap, TirEnvelope } from '../core/index.js';
import { UnknownTxError } from '../tii/errors.js';
import type { TrpClient } from '../trp/client.js';
import { TxBuilder } from './builder.js';
import { UnknownPartyError } from './errors.js';
import { type Party, partyAddress } from './party.js';
import type { Profile } from './profile.js';

/**
 * High-level client over a Tx3 protocol.
 *
 * Holds the deconstructed protocol parts — per-transaction TIR envelopes, the
 * set of declared party names, the selected profile — plus the runtime state
 * (TRP client, bound parties, env overrides). Built through `Tx3ClientBuilder`
 * (obtained via `Protocol.client()` or `Tx3ClientBuilder.fromParts(...)`).
 * Profile selection is locked in at build time: there is no profile-switching
 * method on the built client.
 */
export class Tx3Client {
  readonly #transactions: ReadonlyMap<string, TirEnvelope>;
  readonly #knownParties: ReadonlySet<string>;
  readonly #trp: TrpClient;
  readonly #boundParties: Map<string, Party>;
  readonly #selectedProfile: Profile | undefined;
  readonly #envOverrides: ArgMap;

  private constructor(
    transactions: ReadonlyMap<string, TirEnvelope>,
    knownParties: ReadonlySet<string>,
    trp: TrpClient,
    boundParties: Map<string, Party>,
    selectedProfile: Profile | undefined,
    envOverrides: ArgMap,
  ) {
    this.#transactions = transactions;
    this.#knownParties = knownParties;
    this.#trp = trp;
    this.#boundParties = boundParties;
    this.#selectedProfile = selectedProfile;
    this.#envOverrides = envOverrides;
  }

  /** @internal — call site is `Tx3ClientBuilder.build()`. */
  static _fromBuilder(
    transactions: Map<string, TirEnvelope>,
    knownParties: Set<string>,
    trp: TrpClient,
    boundParties: Map<string, Party>,
    selectedProfile: Profile | undefined,
    envOverrides: ArgMap,
  ): Tx3Client {
    return new Tx3Client(
      transactions,
      knownParties,
      trp,
      boundParties,
      selectedProfile,
      envOverrides,
    );
  }

  /**
   * Late-binding party setter. Returns a new client with the party bound (the
   * caller is the source of truth for replacement semantics — later wins).
   *
   * @throws {UnknownPartyError} if `name` is not a party declared by the
   *   protocol.
   */
  withParty(name: string, party: Party): Tx3Client {
    const lower = name.toLowerCase();
    if (!this.#knownParties.has(lower)) {
      throw new UnknownPartyError(lower);
    }
    const next = new Map(this.#boundParties);
    next.set(lower, party);
    return this.#withParties(next);
  }

  /**
   * Late-binding party setter that skips the declared-party lookup. Intended
   * for codegen-generated wrappers; hand-written code SHOULD prefer
   * `withParty`.
   */
  withPartyUnchecked(name: string, party: Party): Tx3Client {
    const next = new Map(this.#boundParties);
    next.set(name.toLowerCase(), party);
    return this.#withParties(next);
  }

  /** Late-binds multiple parties at once. See `withParty`. */
  withParties(
    entries: Record<string, Party> | Iterable<readonly [string, Party]>,
  ): Tx3Client {
    const next = new Map(this.#boundParties);
    const iter =
      Symbol.iterator in entries
        ? (entries as Iterable<readonly [string, Party]>)
        : Object.entries(entries as Record<string, Party>);
    for (const [name, party] of iter) {
      const lower = name.toLowerCase();
      if (!this.#knownParties.has(lower)) throw new UnknownPartyError(lower);
      next.set(lower, party);
    }
    return this.#withParties(next);
  }

  /**
   * Starts building a transaction invocation.
   *
   * @throws {UnknownTxError} if `name` is not a transaction declared by the
   *   protocol.
   */
  tx(name: string): TxBuilder {
    const tir = this.#transactions.get(name);
    if (!tir) throw new UnknownTxError(name);

    const env = this.#mergedEnv();
    const parties = this.#mergedParties();
    return new TxBuilder(this.#trp, tir).env(env).parties(parties);
  }

  #withParties(next: Map<string, Party>): Tx3Client {
    return new Tx3Client(
      this.#transactions,
      this.#knownParties,
      this.#trp,
      next,
      this.#selectedProfile,
      this.#envOverrides,
    );
  }

  #mergedEnv(): ArgMap {
    const env: ArgMap = { ...(this.#selectedProfile?.environment ?? {}) };
    for (const [k, v] of Object.entries(this.#envOverrides)) env[k] = v;
    return env;
  }

  #mergedParties(): Map<string, Party> {
    const merged = new Map<string, Party>();
    if (this.#selectedProfile) {
      for (const [name, address] of Object.entries(
        this.#selectedProfile.parties,
      )) {
        merged.set(name.toLowerCase(), {
          kind: 'address',
          address,
        });
      }
    }
    for (const [name, party] of this.#boundParties) merged.set(name, party);
    return merged;
  }
}

/** Re-exported for the `clientBuilder.ts` resolver chain. */
export { partyAddress };
