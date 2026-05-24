import type { ArgMap, TirEnvelope } from '../core/index.js';
import type { Protocol } from '../tii/protocol.js';
import { UnknownProfileError } from '../tii/errors.js';
import { TrpClient, type ClientOptions } from '../trp/client.js';
import { Tx3Client } from './client.js';
import {
  MissingTrpEndpointError,
  UnknownPartyError,
} from './errors.js';
import type { Party } from './party.js';
import type { Profile } from './profile.js';

/**
 * Builder for `Tx3Client`.
 *
 * Obtained via `Protocol.client()` for the dynamic flow, or
 * `Tx3ClientBuilder.fromParts(...)` for the codegen flow. All fallible
 * validation — TRP endpoint present, selected profile declared, every bound
 * party declared — happens in `build()`. Optional setters never throw, so
 * chains stay fluent.
 *
 * @example
 * ```ts
 * const protocol = await Protocol.fromFile('protocol.tii');
 * const client = protocol
 *   .client()
 *   .trpEndpoint('https://trp.example')
 *   .withProfile('preprod')
 *   .withParty('sender', Party.signer(signer))
 *   .build();
 * ```
 */
export class Tx3ClientBuilder {
  readonly #transactions: Map<string, TirEnvelope>;
  readonly #profiles: Map<string, Profile>;
  readonly #knownParties: Set<string>;

  #trpOptions: ClientOptions | undefined;
  #profile: string | undefined;
  readonly #parties: Map<string, Party> = new Map();
  readonly #uncheckedParties: Map<string, Party> = new Map();
  readonly #envOverrides: ArgMap = {};

  private constructor(
    transactions: Map<string, TirEnvelope>,
    profiles: Map<string, Profile>,
    knownParties: Set<string>,
  ) {
    this.#transactions = transactions;
    this.#profiles = profiles;
    this.#knownParties = knownParties;
  }

  /**
   * Seeds a builder with already-deconstructed protocol fragments. Codegen-
   * generated bindings call this with embedded per-transaction TIR envelopes,
   * per-profile environment + party-address maps, and (typically) an empty
   * known-parties set — the typed `withPartyUnchecked` setters bake party
   * names into the wrapper methods so runtime name validation is unnecessary.
   */
  static fromParts(
    transactions: Record<string, TirEnvelope> | Map<string, TirEnvelope>,
    profiles: Record<string, Profile> | Map<string, Profile>,
    knownParties: Iterable<string>,
  ): Tx3ClientBuilder {
    const txMap =
      transactions instanceof Map
        ? new Map(transactions)
        : new Map(Object.entries(transactions));
    const profileMap =
      profiles instanceof Map
        ? new Map(profiles)
        : new Map(Object.entries(profiles));
    const partySet = new Set<string>();
    for (const name of knownParties) partySet.add(name.toLowerCase());
    return new Tx3ClientBuilder(txMap, profileMap, partySet);
  }

  /** @internal entry point used by `Protocol.client()`. */
  static fromProtocol(protocol: Protocol): Tx3ClientBuilder {
    const txs = protocol.txs();
    const transactions = new Map<string, TirEnvelope>();
    for (const [name, tx] of Object.entries(txs)) {
      transactions.set(name, tx.tir);
    }

    const profiles = new Map<string, Profile>();
    const declaredProfiles = protocol.profiles();
    for (const [name, profile] of Object.entries(declaredProfiles)) {
      const environment =
        profile.environment &&
        typeof profile.environment === 'object' &&
        !Array.isArray(profile.environment)
          ? { ...(profile.environment as ArgMap) }
          : {};
      profiles.set(name, {
        environment,
        parties: profile.parties ? { ...profile.parties } : {},
      });
    }

    const knownParties = new Set<string>();
    for (const partyName of Object.keys(protocol.parties())) {
      knownParties.add(partyName.toLowerCase());
    }

    return new Tx3ClientBuilder(transactions, profiles, knownParties);
  }

  /** Sets the full TRP client options. */
  trp(options: ClientOptions): this {
    this.#trpOptions = { ...options };
    return this;
  }

  /** Shorthand for `trp({ endpoint })`. */
  trpEndpoint(url: string): this {
    this.#trpOptions = { endpoint: url };
    return this;
  }

  /**
   * Adds a single TRP request header. Initializes the TRP options to an empty
   * endpoint if not yet set — callers must still supply the endpoint via
   * `trp()` or `trpEndpoint()`.
   */
  withHeader(key: string, value: string): this {
    const opts = this.#trpOptions ?? { endpoint: '' };
    const headers = { ...(opts.headers ?? {}) };
    headers[key] = value;
    this.#trpOptions = { ...opts, headers };
    return this;
  }

  /** Selects a profile by name. Validated in `build()`. */
  withProfile(name: string): this {
    this.#profile = name;
    return this;
  }

  /**
   * Binds a party (signer or read-only address) by name. The name is validated
   * against the protocol's declared parties in `build()`.
   */
  withParty(name: string, party: Party): this {
    this.#parties.set(name.toLowerCase(), party);
    return this;
  }

  /**
   * Binds a party without validating the name against the protocol's declared
   * parties. Intended for codegen-generated wrappers — the name is baked into
   * the typed setter at codegen time, so runtime validation would always pass.
   * Hand-written code SHOULD prefer `withParty`.
   */
  withPartyUnchecked(name: string, party: Party): this {
    this.#uncheckedParties.set(name.toLowerCase(), party);
    return this;
  }

  /** Binds multiple parties at once. See `withParty`. */
  withParties(
    entries: Record<string, Party> | Iterable<readonly [string, Party]>,
  ): this {
    const iter =
      Symbol.iterator in entries
        ? (entries as Iterable<readonly [string, Party]>)
        : Object.entries(entries as Record<string, Party>);
    for (const [name, party] of iter) this.withParty(name, party);
    return this;
  }

  /**
   * Sets a single environment value. Merged on top of the selected profile's
   * environment at resolve time (override wins).
   */
  withEnvValue(key: string, value: unknown): this {
    this.#envOverrides[key] = value;
    return this;
  }

  /**
   * Validates the builder state and materializes the `Tx3Client`.
   *
   * @throws {MissingTrpEndpointError} if no TRP endpoint was supplied.
   * @throws {UnknownProfileError} if the selected profile is not declared.
   * @throws {UnknownPartyError} if any bound party is not declared.
   */
  build(): Tx3Client {
    if (!this.#trpOptions || this.#trpOptions.endpoint.length === 0) {
      throw new MissingTrpEndpointError();
    }

    let selectedProfile: Profile | undefined;
    if (this.#profile !== undefined) {
      const found = this.#profiles.get(this.#profile);
      if (!found) throw new UnknownProfileError(this.#profile);
      selectedProfile = found;
    }

    for (const name of this.#parties.keys()) {
      if (!this.#knownParties.has(name)) {
        throw new UnknownPartyError(name);
      }
    }

    const trp = new TrpClient(this.#trpOptions);

    const boundParties = new Map<string, Party>();
    for (const [name, party] of this.#parties) boundParties.set(name, party);
    for (const [name, party] of this.#uncheckedParties)
      boundParties.set(name, party);

    return Tx3Client._fromBuilder(
      this.#transactions,
      this.#knownParties,
      trp,
      boundParties,
      selectedProfile,
      { ...this.#envOverrides },
    );
  }
}
