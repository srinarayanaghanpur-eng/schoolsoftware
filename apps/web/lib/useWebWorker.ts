/**
 * Web Worker Utility
 * Wrapper for offloading heavy computations to background thread
 */

'use client';

let workerInstance: Worker | null = null;

/**
 * Get or create web worker instance
 */
function getWorker(): Worker {
  if (workerInstance) return workerInstance;

  if (typeof Worker !== 'undefined') {
    workerInstance = new Worker(new URL('/worker.js', import.meta.url));
  } else {
    throw new Error('Web Workers are not supported in this environment');
  }

  return workerInstance;
}

/**
 * Send message to worker and wait for response
 */
function sendToWorker<T>(type: string, payload?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const timeout = setTimeout(() => {
      reject(new Error(`Worker timeout for ${type}`));
    }, 30000); // 30 second timeout

    const handler = (event: MessageEvent) => {
      if (event.data.originalType === type) {
        clearTimeout(timeout);
        worker.removeEventListener('message', handler);

        if (event.data.type === 'ERROR') {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result as T);
        }
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ type, payload });
  });
}

/**
 * Calculate attendance statistics in background
 */
export async function calculateAttendanceStatsWorker(records: any[]): Promise<any> {
  return sendToWorker('CALCULATE_ATTENDANCE_STATS', records);
}

/**
 * Calculate salary statistics in background
 */
export async function calculateSalaryStatsWorker(records: any[]): Promise<any> {
  return sendToWorker('CALCULATE_SALARY_STATS', records);
}

/**
 * Calculate fee statistics in background
 */
export async function calculateFeeStatsWorker(records: any[]): Promise<any> {
  return sendToWorker('CALCULATE_FEE_STATS', records);
}

/**
 * Filter and sort records in background
 */
export async function filterAndSortWorker(
  records: any[],
  filters?: Record<string, any>,
  sortBy?: { field: string; order: 'asc' | 'desc' }
): Promise<any[]> {
  return sendToWorker('FILTER_AND_SORT', {
    records,
    filters,
    sortBy
  });
}

/**
 * React hook for web worker calculations
 */
export function useWebWorker<T>(
  type: 'attendance' | 'salary' | 'fee' | 'filter',
  data: any[],
  options?: Record<string, any>
) {
  const [result, setResult] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!data || data.length === 0) {
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    const calculate = async () => {
      try {
        let result: T;

        switch (type) {
          case 'attendance':
            result = (await calculateAttendanceStatsWorker(data)) as T;
            break;
          case 'salary':
            result = (await calculateSalaryStatsWorker(data)) as T;
            break;
          case 'fee':
            result = (await calculateFeeStatsWorker(data)) as T;
            break;
          case 'filter':
            result = (await filterAndSortWorker(
              data,
              options?.filters,
              options?.sortBy
            )) as T;
            break;
          default:
            throw new Error(`Unknown worker type: ${type}`);
        }

        setResult(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    calculate();
  }, [type, data, options]);

  return { result, loading, error };
}

// Import React for hooks
import React from 'react';
