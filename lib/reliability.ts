type RetryClassifier = (error: unknown, attempt: number) => boolean;

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  shouldRetry?: RetryClassifier;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, jitterRatio: number): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
  const jitter = exponential * jitterRatio * Math.random();
  return Math.round(exponential + jitter);
}

export function isLikelyTransientScrapeError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();

  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('ehostunreach') ||
    message.includes('enotfound') ||
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('err_internet_disconnected') ||
    message.includes('err_connection_refused') ||
    message.includes('err_connection_timed_out') ||
    message.includes('err_name_not_resolved') ||
    message.includes('scraper_browser_launch_failed') ||
    message.includes('scraper_browser_missing') ||
    message.includes('(429)') ||
    message.includes('(500)') ||
    message.includes('(502)') ||
    message.includes('(503)') ||
    message.includes('(504)')
  );
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 900;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const jitterRatio = options.jitterRatio ?? 0.25;
  const shouldRetry = options.shouldRetry ?? isLikelyTransientScrapeError;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await operation();
      return { value, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delayMs = computeBackoffDelay(attempt, baseDelayMs, maxDelayMs, jitterRatio);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry failed without a terminal error');
}

type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  timeoutAt: number;
};

export class AsyncRequestQueue {
  private readonly maxConcurrent: number;
  private readonly defaultWaitTimeoutMs: number;
  private active = 0;
  private pending: QueueTask<unknown>[] = [];

  constructor(maxConcurrent: number, defaultWaitTimeoutMs: number) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.defaultWaitTimeoutMs = Math.max(5000, defaultWaitTimeoutMs);
  }

  enqueue<T>(run: () => Promise<T>, waitTimeoutMs = this.defaultWaitTimeoutMs): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutAt = Date.now() + Math.max(2000, waitTimeoutMs);
      this.pending.push({ run, resolve, reject, timeoutAt } as QueueTask<unknown>);
      this.drain();
    });
  }

  getSnapshot() {
    return {
      active: this.active,
      pending: this.pending.length,
      maxConcurrent: this.maxConcurrent,
    };
  }

  private drain() {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const task = this.pending.shift() as QueueTask<unknown>;

      if (Date.now() > task.timeoutAt) {
        task.reject(new Error('SCRAPER_QUEUE_TIMEOUT: Scrape request waited too long in queue'));
        continue;
      }

      this.active += 1;
      Promise.resolve()
        .then(task.run)
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}

type CircuitState = {
  consecutiveFailures: number;
  openUntil: number;
  updatedAt: number;
  lastError?: string;
};

export class HostCircuitBreaker {
  private readonly failureThreshold: number;
  private readonly openDurationMs: number;
  private readonly stateTtlMs: number;
  private readonly states = new Map<string, CircuitState>();

  constructor(failureThreshold: number, openDurationMs: number, stateTtlMs = 30 * 60 * 1000) {
    this.failureThreshold = Math.max(2, failureThreshold);
    this.openDurationMs = Math.max(5000, openDurationMs);
    this.stateTtlMs = Math.max(this.openDurationMs, stateTtlMs);
  }

  beforeRequest(host: string): { allowed: true } | { allowed: false; retryAfterMs: number; lastError?: string } {
    this.gc();
    const key = host.toLowerCase();
    const state = this.states.get(key);
    if (!state) return { allowed: true };

    const now = Date.now();
    if (state.openUntil > now) {
      return {
        allowed: false,
        retryAfterMs: state.openUntil - now,
        lastError: state.lastError,
      };
    }

    if (state.openUntil !== 0) {
      state.openUntil = 0;
      state.consecutiveFailures = Math.max(0, state.consecutiveFailures - 1);
      state.updatedAt = now;
      this.states.set(key, state);
    }

    return { allowed: true };
  }

  recordSuccess(host: string) {
    const key = host.toLowerCase();
    this.states.delete(key);
  }

  recordFailure(host: string, error: unknown) {
    this.gc();
    const key = host.toLowerCase();
    const now = Date.now();
    const previous = this.states.get(key);

    const next: CircuitState = {
      consecutiveFailures: (previous?.consecutiveFailures || 0) + 1,
      openUntil: previous?.openUntil || 0,
      updatedAt: now,
      lastError: toErrorMessage(error).slice(0, 240),
    };

    if (next.consecutiveFailures >= this.failureThreshold) {
      next.openUntil = now + this.openDurationMs;
    }

    this.states.set(key, next);
  }

  private gc() {
    const now = Date.now();
    for (const [key, state] of this.states.entries()) {
      if (now - state.updatedAt > this.stateTtlMs) {
        this.states.delete(key);
      }
    }
  }
}

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const scrapeQueue = new AsyncRequestQueue(
  parseEnvInt('SCRAPER_QUEUE_CONCURRENCY', 2),
  parseEnvInt('SCRAPER_QUEUE_WAIT_TIMEOUT_MS', 45000)
);

export const scrapeCircuitBreaker = new HostCircuitBreaker(
  parseEnvInt('SCRAPER_CIRCUIT_FAILURE_THRESHOLD', 4),
  parseEnvInt('SCRAPER_CIRCUIT_OPEN_MS', 120000)
);
