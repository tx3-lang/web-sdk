export abstract class Tx3Error extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = this.constructor.name;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class ArgValueError extends Tx3Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`invalid arg value: ${message}`, options);
  }
}
