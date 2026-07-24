/**
 * Performance Monitoring for React Native
 * Tracks app performance metrics and identifies bottlenecks
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  tags?: Record<string, any>;
}

interface MetricStats {
  count: number;
  total: number;
  min: number;
  max: number;
  average: number;
}

const PERFORMANCE_THRESHOLDS = {
  'api-call': 1000, // 1 second
  'data-fetch': 2000, // 2 seconds
  'screen-render': 500, // 500ms
  'navigation': 1000 // 1 second
};

class MobilePerformanceMonitor {
  private measurements: Map<string, PerformanceMetric[]> = new Map();
  private startTimes: Map<string, number> = new Map();
  private observers: ((metric: PerformanceMetric) => void)[] = [];

  constructor() {}

  /**
   * Start measuring performance
   */
  startMeasure(name: string): void {
    this.startTimes.set(name, Date.now());
  }

  /**
   * End measuring performance
   */
  endMeasure(name: string, tags?: Record<string, any>): number | undefined {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      console.warn(`[Perf] No start time found for ${name}`);
      return undefined;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(name);

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      tags
    };

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }

    this.measurements.get(name)!.push(metric);

    // Check threshold
    const threshold = PERFORMANCE_THRESHOLDS[name as keyof typeof PERFORMANCE_THRESHOLDS];
    if (threshold && duration > threshold) {
      console.warn(
        `[Perf] ⚠️ Slow operation: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`
      );
    }

    // Notify observers
    this.observers.forEach((observer) => observer(metric));

    return duration;
  }

  /**
   * Wrap async function with performance measurement
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, any>
  ): Promise<T> {
    this.startMeasure(name);
    try {
      const result = await fn();
      this.endMeasure(name, tags);
      return result;
    } catch (error) {
      this.endMeasure(name, { ...tags, error: true });
      throw error;
    }
  }

  /**
   * Get average duration for metric
   */
  getAverageDuration(name: string): number | undefined {
    const metrics = this.measurements.get(name);
    if (!metrics || metrics.length === 0) return undefined;

    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / metrics.length;
  }

  /**
   * Get summary stats for metric
   */
  getSummary(name: string): MetricStats | undefined {
    const metrics = this.measurements.get(name);
    if (!metrics || metrics.length === 0) return undefined;

    const durations = metrics.map((m) => m.duration);
    const total = durations.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      total,
      min: Math.min(...durations),
      max: Math.max(...durations),
      average: total / metrics.length
    };
  }

  /**
   * Get all summaries
   */
  getAllSummaries(): Record<string, MetricStats> {
    const result: Record<string, MetricStats> = {};

    this.measurements.forEach((_, name) => {
      const summary = this.getSummary(name);
      if (summary) {
        result[name] = summary;
      }
    });

    return result;
  }

  /**
   * Calculate health score (0-100)
   */
  getHealthScore(): number {
    const summaries = this.getAllSummaries();
    if (Object.keys(summaries).length === 0) return 100;

    let totalScore = 0;
    let count = 0;

    Object.entries(summaries).forEach(([name, stats]) => {
      const threshold =
        PERFORMANCE_THRESHOLDS[name as keyof typeof PERFORMANCE_THRESHOLDS] || 1000;

      // Score: 100 if average <= threshold, decreases as it goes over
      const score = Math.max(0, 100 - (stats.average / threshold) * 100);
      totalScore += score;
      count++;
    });

    return Math.round(totalScore / count);
  }

  /**
   * Print performance report
   */
  printReport(): void {
    const summaries = this.getAllSummaries();
    const health = this.getHealthScore();

    console.log('\n[Perf] ═══════════════════════════════════════');
    console.log(`[Perf] Performance Report (Health Score: ${health}/100)`);
    console.log('[Perf] ───────────────────────────────────────');

    Object.entries(summaries).forEach(([name, stats]) => {
      console.log(
        `[Perf] ${name.padEnd(25)} | Count: ${stats.count} | Avg: ${stats.average.toFixed(2)}ms | Min/Max: ${stats.min.toFixed(2)}/${stats.max.toFixed(2)}ms`
      );
    });

    console.log('[Perf] ═══════════════════════════════════════\n');
  }

  /**
   * Reset measurements
   */
  reset(): void {
    this.measurements.clear();
    this.startTimes.clear();
  }

  /**
   * Subscribe to performance metrics
   */
  onMetric(observer: (metric: PerformanceMetric) => void): () => void {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter((o) => o !== observer);
    };
  }

  /**
   * Get memory usage (if available)
   */
  getMemoryUsage(): { heapUsed: number; heapTotal: number } | null {
    try {
      // React Native doesn't expose detailed memory stats like Node.js
      // This is a placeholder for future enhancement
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Log metrics to analytics service
   */
  async reportMetrics(endpoint: string): Promise<void> {
    try {
      const summaries = this.getAllSummaries();
      const health = this.getHealthScore();

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: Date.now(),
          health,
          metrics: summaries
        })
      });

      console.log('[Perf] Metrics reported');
    } catch (error) {
      console.error('[Perf] Failed to report metrics:', error);
    }
  }
}

// Export singleton
export const mobilePerformanceMonitor = new MobilePerformanceMonitor();
