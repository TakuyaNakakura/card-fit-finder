interface AttemptBucket {
  blockedUntil: number;
  failures: number[];
}

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function toRetryAfterSeconds(blockedUntil: number, now: number): number {
  return Math.max(1, Math.ceil((blockedUntil - now) / 1000));
}

export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, AttemptBucket>();

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly blockDurationMs = 15 * 60 * 1000
  ) {}

  check(key: string, now = Date.now()): LoginRateLimitResult {
    this.prune(now);
    const bucket = this.attempts.get(key);

    if (!bucket || bucket.blockedUntil <= now) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    return {
      allowed: false,
      retryAfterSeconds: toRetryAfterSeconds(bucket.blockedUntil, now)
    };
  }

  recordFailure(key: string, now = Date.now()): LoginRateLimitResult {
    this.prune(now);
    const bucket = this.attempts.get(key) ?? {
      blockedUntil: 0,
      failures: []
    };

    bucket.failures = bucket.failures.filter((timestamp) => now - timestamp < this.windowMs);
    bucket.failures.push(now);

    if (bucket.failures.length >= this.maxAttempts) {
      bucket.blockedUntil = now + this.blockDurationMs;
    }

    this.attempts.set(key, bucket);

    if (bucket.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: toRetryAfterSeconds(bucket.blockedUntil, now)
      };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.attempts.entries()) {
      const failures = bucket.failures.filter((timestamp) => now - timestamp < this.windowMs);

      if (bucket.blockedUntil <= now && failures.length === 0) {
        this.attempts.delete(key);
        continue;
      }

      bucket.failures = failures;

      if (bucket.blockedUntil <= now) {
        bucket.blockedUntil = 0;
      }
    }
  }
}
