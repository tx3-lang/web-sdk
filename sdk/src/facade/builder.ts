import type { ArgMap } from '../core/index.js';
import type { Protocol } from '../tii/protocol.js';
import type { TrpClient } from '../trp/client.js';
import { MissingParamsError, UnknownPartyError } from './errors.js';
import type { Party } from './party.js';
import { partyAddress } from './party.js';
import { ResolvedTx } from './resolved.js';

export class TxBuilder {
  readonly #protocol: Protocol;
  readonly #trp: TrpClient;
  readonly #txName: string;
  readonly #args: ArgMap;
  readonly #parties: Map<string, Party>;
  readonly #profile: string | undefined;

  constructor(
    protocol: Protocol,
    trp: TrpClient,
    txName: string,
    parties: Map<string, Party>,
    profile: string | undefined,
  ) {
    this.#protocol = protocol;
    this.#trp = trp;
    this.#txName = txName;
    this.#args = {};
    this.#parties = parties;
    this.#profile = profile;
  }

  arg(name: string, value: unknown): TxBuilder {
    this.#args[name.toLowerCase()] = value;
    return this;
  }

  args(map: Record<string, unknown>): TxBuilder {
    for (const [key, value] of Object.entries(map)) {
      this.#args[key.toLowerCase()] = value;
    }
    return this;
  }

  async resolve(): Promise<ResolvedTx> {
    const invocation = this.#protocol.invoke(
      this.#txName,
      this.#profile,
    );

    const knownParties = new Set(
      Object.keys(this.#protocol.parties()).map((k) => k.toLowerCase()),
    );

    for (const [name, party] of this.#parties) {
      if (!knownParties.has(name)) {
        throw new UnknownPartyError(name);
      }
      invocation.setArg(name, partyAddress(party));
    }

    invocation.setArgs(this.#args);

    const missing = [...invocation.unspecifiedParams()]
      .map(([k]) => k)
      .sort();

    if (missing.length > 0) {
      throw new MissingParamsError(missing);
    }

    const resolveReq = invocation.intoResolveRequest();
    const envelope = await this.#trp.resolve(resolveReq);

    const signers: { name: string; address: string; signer: { sign(txHashHex: string): Promise<import('../trp/spec.js').TxWitness> } }[] = [];
    for (const [name, party] of this.#parties) {
      if (party.kind === 'signer') {
        signers.push({
          name,
          address: party.address,
          signer: party.signer,
        });
      }
    }

    return new ResolvedTx(this.#trp, envelope.hash, envelope.tx, signers);
  }
}
