/**
 * Request Optimization for React Native
 * Debounce, throttle, rate-limiting, and batching utilities
 */

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Rate limiter with queue
 */
export class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private requestsPerSecond: number;

  constructor(requestsPerSecond: number = 10) {
    this.requestsPerSecond = requestsPerSecond;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    const delayBetweenRequests = 1000 / this.requestsPerSecond;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
        await new Promise((resolve) => setTimeout(resolve, delayBetweenRequests));
      }
    }

    this.processing = false;
  }
}

/**
 * Batch processor
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private processing = false;
  private batchSize: number;
  private processor: (batch: T[]) => Promise<R[]>;
  private timeout: number;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 50,
    timeout: number = 1000
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.timeout = timeout;
  }

  add(item: T): void {
    this.queue.push(item);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.timeout);
  }

  private itemRetryCount = new Map<T, number>();
  private maxRetries = 3;

  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.processor(batch);
      for (const item of batch) {
        this.itemRetryCount.delete(item);
      }
    } catch (error) {
      console.error('[BatchProcessor] Batch processing failed:', error);
      const retryBatch: T[] = [];
      for (const item of batch) {
        const retries = this.itemRetryCount.get(item) ?? 0;
        if (retries < this.maxRetries) {
          this.itemRetryCount.set(item, retries + 1);
          retryBatch.push(item);
        } else {
          console.error(`[BatchProcessor] Item failed after ${this.maxRetries} retries, dropping:`, item);
          this.itemRetryCount.delete(item);
        }
      }
      if (retryBatch.length > 0) {
        this.queue.unshift(...retryBatch);
      }
    } finally {
      this.processing = false;

      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }
  }
}

/**
 * Exponential backoff retry
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        console.log(
          `[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

// Export singleton rate limiter
export const rateLimiter = new RateLimiter(20); // 20 requests per second
