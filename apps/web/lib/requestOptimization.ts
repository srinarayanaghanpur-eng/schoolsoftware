/**
 * Debounce and Throttle utilities for request optimization
 */

/**
 * Debounce function - waits for silence before executing
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
 * Throttle function - executes at most once per interval
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
 * Rate limit with queue
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
 * Batch operations to reduce API calls
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
      // Clear retry counts for successfully processed items
      for (const item of batch) {
        this.itemRetryCount.delete(item);
      }
    } catch (error) {
      console.error('Batch processing failed:', error);
      // Re-add failed items with retry limit
      const retryBatch: T[] = [];
      for (const item of batch) {
        const retries = this.itemRetryCount.get(item) ?? 0;
        if (retries < this.maxRetries) {
          this.itemRetryCount.set(item, retries + 1);
          retryBatch.push(item);
        } else {
          console.error(`Item failed after ${this.maxRetries} retries, dropping:`, item);
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

// Export singleton instances
export const rateLimiter = new RateLimiter(20); // 20 requests per second
