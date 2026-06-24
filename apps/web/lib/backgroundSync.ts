/**
 * Background Sync Service
 * Syncs Firebase data in background without blocking UI
 */

interface SyncTask {
  id: string;
  name: string;
  priority: 'high' | 'normal' | 'low';
  lastSync?: number;
  interval?: number; // milliseconds
  fn: () => Promise<void>;
}

class BackgroundSyncManager {
  private tasks: Map<string, SyncTask> = new Map();
  private activeTask: string | null = null;
  private syncInProgress = false;
  private listeners: Set<(status: string) => void> = new Set();

  registerTask(task: SyncTask): void {
    this.tasks.set(task.id, task);
  }

  unregisterTask(id: string): void {
    this.tasks.delete(id);
  }

  /**
   * Start background sync - runs high priority tasks first, then normal, then low
   */
  async startSync(): Promise<void> {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    this.notify('sync-start');

    try {
      const sortedTasks = Array.from(this.tasks.values()).sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      for (const task of sortedTasks) {
        // Skip if interval hasn't passed
        if (task.lastSync && task.interval) {
          if (Date.now() - task.lastSync < task.interval) {
            continue;
          }
        }

        this.activeTask = task.id;
        this.notify(`syncing-${task.name}`);

        try {
          await task.fn();
          task.lastSync = Date.now();
        } catch (error) {
          console.error(`Sync failed for task ${task.id}:`, error);
        }
      }

      this.notify('sync-complete');
    } finally {
      this.syncInProgress = false;
      this.activeTask = null;
    }
  }

  /**
   * Stop all background sync
   */
  stopSync(): void {
    this.syncInProgress = false;
    this.activeTask = null;
  }

  /**
   * Subscribe to sync status updates
   */
  onSync(listener: (status: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(status: string): void {
    this.listeners.forEach((listener) => listener(status));
  }

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  getActiveTask(): string | null {
    return this.activeTask;
  }
}

export const backgroundSync = new BackgroundSyncManager();

/**
 * Initialize background sync with throttling
 * Syncs every interval but not more frequently
 */
export function initializeBackgroundSync(interval: number = 30000): () => void {
  let syncTimer: NodeJS.Timeout | null = null;
  let isScheduled = false;

  const scheduledSync = () => {
    if (isScheduled) return;
    isScheduled = true;

    // Use requestIdleCallback if available for better performance
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(
        async () => {
          await backgroundSync.startSync();
          isScheduled = false;
        },
        { timeout: 5000 }
      );
    } else {
      // Fallback to setTimeout
      syncTimer = setTimeout(async () => {
        await backgroundSync.startSync();
        isScheduled = false;
      }, 100);
    }
  };

  // Start periodic sync
  const periodicSync = setInterval(scheduledSync, interval);

  // Trigger sync on visibility change
  const handleVisibilityChange = () => {
    if (document.hidden) {
      backgroundSync.stopSync();
    } else {
      scheduledSync();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Cleanup function
  return () => {
    clearInterval(periodicSync);
    if (syncTimer) clearTimeout(syncTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
