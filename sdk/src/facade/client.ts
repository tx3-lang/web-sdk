import type { Protocol } from '../tii/protocol.js';
import type { TrpClient } from '../trp/client.js';
import { TxBuilder } from './builder.js';
import type { Party } from './party.js';

export class Tx3Client {
  readonly #protocol: Protocol;
  readonly #trp: TrpClient;
  readonly #parties: Map<string, Party>;
  readonly #profile: string | undefined;

  constructor(
    protocol: Protocol,
    trp: TrpClient,
    parties?: Map<string, Party>,
    profile?: string,
  ) {
    this.#protocol = protocol;
    this.#trp = trp;
    this.#parties = parties ?? new Map();
    this.#profile = profile;
  }

  withProfile(name: string): Tx3Client {
    return new Tx3Client(
      this.#protocol,
      this.#trp,
      new Map(this.#parties),
      name,
    );
  }

  withParty(name: string, party: Party): Tx3Client {
    const parties = new Map(this.#parties);
    parties.set(name.toLowerCase(), party);
    return new Tx3Client(this.#protocol, this.#trp, parties, this.#profile);
  }

  withParties(
    entries: Record<string, Party> | Iterable<[string, Party]>,
  ): Tx3Client {
    const parties = new Map(this.#parties);
    const iterable =
      Symbol.iterator in entries
        ? (entries as Iterable<[string, Party]>)
        : Object.entries(entries as Record<string, Party>);
    for (const [name, party] of iterable) {
      parties.set(name.toLowerCase(), party);
    }
    return new Tx3Client(this.#protocol, this.#trp, parties, this.#profile);
  }

  tx(name: string): TxBuilder {
    return new TxBuilder(
      this.#protocol,
      this.#trp,
      name,
      new Map(this.#parties),
      this.#profile,
    );
  }
}
