export class PollConfig {
  readonly attempts: number;
  readonly delayMs: number;

  constructor(attempts: number, delayMs: number) {
    this.attempts = attempts;
    this.delayMs = delayMs;
  }

  static default(): PollConfig {
    return new PollConfig(20, 5000);
  }
}
