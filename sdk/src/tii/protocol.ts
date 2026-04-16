import { Invocation } from './invocation.js';
import { ParamType, paramsFromSchema, type ParamMap } from './paramType.js';
import type { PartySpec, TiiFile, Transaction } from './spec.js';
import {
  InvalidJsonError,
  UnknownProfileError,
  UnknownTxError,
} from './errors.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export class Protocol {
  private readonly spec: TiiFile;

  private constructor(spec: TiiFile) {
    this.spec = spec;
  }

  static fromJson(value: unknown): Protocol {
    if (!isPlainObject(value)) {
      throw new InvalidJsonError('root value must be an object');
    }
    return new Protocol(value as unknown as TiiFile);
  }

  static fromString(json: string): Protocol {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      throw new InvalidJsonError((err as Error).message, { cause: err });
    }
    return Protocol.fromJson(parsed);
  }

  static async fromFile(path: string): Promise<Protocol> {
    const { readFile } = await import('node:fs/promises');
    const contents = await readFile(path, 'utf8');
    return Protocol.fromString(contents);
  }

  txs(): Record<string, Transaction> {
    return this.spec.transactions;
  }

  parties(): Record<string, PartySpec> {
    return this.spec.parties ?? {};
  }

  private ensureTx(name: string): Transaction {
    const tx = this.spec.transactions[name];
    if (!tx) throw new UnknownTxError(name);
    return tx;
  }

  private ensureProfile(name: string) {
    const profile = this.spec.profiles?.[name];
    if (!profile) throw new UnknownProfileError(name);
    return profile;
  }

  invoke(name: string, profile?: string): Invocation {
    const tx = this.ensureTx(name);
    const profileEntry = profile !== undefined ? this.ensureProfile(profile) : undefined;

    const params: ParamMap = new Map();

    for (const party of Object.keys(this.parties())) {
      params.set(party.toLowerCase(), ParamType.address());
    }

    if (this.spec.environment) {
      for (const [k, v] of paramsFromSchema(this.spec.environment)) {
        params.set(k, v);
      }
    }

    for (const [k, v] of paramsFromSchema(tx.params)) {
      params.set(k, v);
    }

    const invocation = new Invocation(tx.tir, params);

    if (profileEntry) {
      if (isPlainObject(profileEntry.environment)) {
        invocation.setArgs(profileEntry.environment);
      }
      if (profileEntry.parties) {
        for (const [key, value] of Object.entries(profileEntry.parties)) {
          invocation.setArg(key, value);
        }
      }
    }

    return invocation;
  }
}
