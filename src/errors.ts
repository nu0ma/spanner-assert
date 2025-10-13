export class SpannerAssertionError extends Error {
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SpannerAssertionError';
    this.details = details;
  }
}
