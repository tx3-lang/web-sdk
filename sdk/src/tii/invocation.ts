import type { ArgMap, TirEnvelope } from '../core/index.js';
import type { ResolveParams } from '../trp/spec.js';
import type { ParamMap, ParamType } from './paramType.js';

export class Invocation {
  readonly tir: TirEnvelope;
  private readonly _params: ParamMap;
  private readonly _args: ArgMap;

  constructor(tir: TirEnvelope, params: ParamMap, args: ArgMap = {}) {
    this.tir = tir;
    this._params = params;
    this._args = { ...args };
  }

  params(): ReadonlyMap<string, ParamType> {
    return this._params;
  }

  *unspecifiedParams(): IterableIterator<[string, ParamType]> {
    for (const [name, type] of this._params) {
      if (!(name in this._args)) yield [name, type];
    }
  }

  setArg(name: string, value: unknown): this {
    this._args[name.toLowerCase()] = value;
    return this;
  }

  setArgs(args: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(args)) {
      this._args[key.toLowerCase()] = value;
    }
    return this;
  }

  withArg(name: string, value: unknown): Invocation {
    return new Invocation(this.tir, this._params, this._args).setArg(name, value);
  }

  withArgs(args: Record<string, unknown>): Invocation {
    return new Invocation(this.tir, this._params, this._args).setArgs(args);
  }

  intoResolveRequest(): ResolveParams {
    return {
      tir: this.tir,
      args: { ...this._args },
    };
  }
}
