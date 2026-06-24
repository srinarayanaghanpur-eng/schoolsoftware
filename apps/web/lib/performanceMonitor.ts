/**
 * Performance Monitoring Utility
 * Tracks load times, API response times, and identifies bottlenecks
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  tags?: Record<string, string>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private marks: Map<string, number> = new Map();
  private thresholds: Map<string, number> = new Map();

  constructor() {
    // Set default performance thresholds
    this.thresholds.set('api-call', 1000); // 1 second
    this.thresholds.set('page-load', 3000); // 3 seconds
    this.thresholds.set('data-fetch', 2000); // 2 seconds
    this.thresholds.set('render', 500); // 500ms
  }

  /**
   * Start timing a metric
   */
  startMeasure(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * End timing and record metric
   */
  endMeasure(
    name: string,
    tags?: Record<string, string>
  ): number | null {
    const startTime = this.marks.get(name);
    if (!startTime) {
      console.warn(`No start mark found for ${name}`);
      return null;
    }

    const duration = performance.now() - startTime;
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      tags
    };

    this.metrics.push(metric);
    this.marks.delete(name);

    // Check if exceeded threshold
    const threshold = this.thresholds.get(name);
    if (threshold && duration > threshold) {
      console.warn(
        `⚠️ Performance warning: ${name} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
        tags
      );
    }

    return duration;
  }

  /**
   * Measure async function
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    this.startMeasure(name);
    try {
      const result = await fn();
      this.endMeasure(name, tags);
      return result;
    } catch (error) {
      this.endMeasure(`${name}-error`, { ...tags, error: 'true' });
      throw error;
    }
  }

  /**
   * Get average duration for a metric
   */
  getAverageDuration(name: string): number {
    const relevant = this.metrics.filter((m) => m.name === name);
    if (relevant.length === 0) return 0;

    const sum = relevant.reduce((acc, m) => acc + m.duration, 0);
    return sum / relevant.length;
  }

  /**
   * Get all metrics summary
   */
  getSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    this.metrics.forEach((metric) => {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          total: 0,
          min: Infinity,
          max: -Infinity,
          average: 0
        };
      }

      summary[metric.name].count++;
      summary[metric.name].total += metric.duration;
      summary[metric.name].min = Math.min(summary[metric.name].min, metric.duration);
      summary[metric.name].max = Math.max(summary[metric.name].max, metric.duration);
      summary[metric.name].average = summary[metric.name].total / summary[metric.name].count;
    });

    return summary;
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
    this.marks.clear();
  }

  /**
   * Print performance report
   */
  printReport(): void {
    const summary = this.getSummary();
    console.group('📊 Performance Report');
    console.table(summary);
    console.groupEnd();
  }

  /**
   * Check overall performance
   */
  getHealthScore(): number {
    if (this.metrics.length === 0) return 100;

    const summary = this.getSummary();
    let score = 100;

    Object.entries(summary).forEach(([name, stats]: [string, any]) => {
      const threshold = this.thresholds.get(name) || Infinity;
      if (stats.average > threshold) {
        score -= 10; // Deduct 10 points per slow metric
      }
    });

    return Math.max(0, score);
  }
}

export const perfMonitor = new PerformanceMonitor();

/**
 * Web Vitals tracking
 */
export function trackWebVitals(): void {
  // Track Cumulative Layout Shift
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log('Performance entry:', entry.name, (entry as any).duration);
        }
      });

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    } catch (e) {
      console.debug('PerformanceObserver not fully supported');
    }
  }
}

/**
 * Log memory usage
 */
export function logMemoryUsage(): void {
  if ((performance as any).memory) {
    const memory = (performance as any).memory;
    console.log('Memory Usage:', {
      usedJSHeapSize: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
      totalJSHeapSize: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
      jsHeapSizeLimit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`
    });
  }
}
