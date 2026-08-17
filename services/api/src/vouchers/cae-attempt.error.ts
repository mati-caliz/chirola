export class CaeAttemptError extends Error {
  constructor(
    readonly cause: unknown,
    readonly salesPoint: number,
    readonly attemptedNumber: number | null,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'CaeAttemptError';
  }
}
