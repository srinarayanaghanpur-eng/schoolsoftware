/**
 * Background Task Manager for React Native
 * Handles data sync and periodic tasks without blocking UI
 */

import { AppState, AppStateStatus } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

export type TaskPriority = 'high' | 'normal' | 'low';

export interface MobileBackgroundTask {
  id: string;
  name: string;
  priority: TaskPriority;
  fn: () => Promise<void>;
  interval?: number; // milliseconds
  lastSync?: number;
}

const TASK_PREFIX = 'attendance-task-';

class MobileBackgroundSyncManager {
  private tasks: Map<string, MobileBackgroundTask> = new Map();
  private syncing = false;
  private syncListeners: ((status: string) => void)[] = [];
  private appState: AppStateStatus = 'active';

  constructor() {
    // Listen for app state changes
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (state: AppStateStatus) => {
    this.appState = state;

    if (state === 'active') {
      console.log('[MobileSync] App resumed - starting sync');
      this.startSync();
    } else if (state === 'background') {
      console.log('[MobileSync] App backgrounded - registering background task');
      this.registerBackgroundTask();
    }
  };

  /**
   * Register a background sync task
   */
  registerTask(task: MobileBackgroundTask): void {
    this.tasks.set(task.id, task);
    console.log(`[MobileSync] Task registered: ${task.id}`);
  }

  /**
   * Unregister a task
   */
  unregisterTask(id: string): void {
    this.tasks.delete(id);
    console.log(`[MobileSync] Task unregistered: ${id}`);
  }

  /**
   * Start syncing all tasks
   */
  async startSync(): Promise<void> {
    if (this.syncing || this.appState !== 'active') {
      return;
    }

    this.syncing = true;
    this.notifyListeners('syncing');

    try {
      // Sort tasks by priority
      const sortedTasks = Array.from(this.tasks.values()).sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Execute tasks sequentially
      for (const task of sortedTasks) {
        try {
          // Check if enough time has passed since last sync
          if (task.lastSync && task.interval) {
            const timeSinceLastSync = Date.now() - task.lastSync;
            if (timeSinceLastSync < task.interval) {
              continue;
            }
          }

          console.log(`[MobileSync] Executing: ${task.name}`);
          await task.fn();
          task.lastSync = Date.now();
        } catch (error) {
          console.error(`[MobileSync] Task failed (${task.name}):`, error);
        }
      }

      this.notifyListeners('idle');
    } catch (error) {
      console.error('[MobileSync] Sync failed:', error);
      this.notifyListeners('error');
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Stop syncing
   */
  stopSync(): void {
    this.syncing = false;
    this.notifyListeners('idle');
  }

  /**
   * Register background task handler
   */
  private async registerBackgroundTask(): Promise<void> {
    try {
      // Define background task
      TaskManager.defineTask(TASK_PREFIX + 'sync', async () => {
        console.log('[MobileSync] Background task executing');
        await this.startSync();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      });

      // Register with system
      await BackgroundFetch.registerTaskAsync(TASK_PREFIX + 'sync', {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true
      });

      console.log('[MobileSync] Background task registered');
    } catch (error) {
      console.error('[MobileSync] Failed to register background task:', error);
    }
  }

  /**
   * Check if currently syncing
   */
  isSyncing(): boolean {
    return this.syncing;
  }

  /**
   * Get active task
   */
  getActiveTask(): MobileBackgroundTask | null {
    const syncingTask = Array.from(this.tasks.values()).find(
      (task) => task.lastSync === undefined || Date.now() - task.lastSync < 10000
    );
    return syncingTask || null;
  }

  /**
   * Subscribe to sync status changes
   */
  onSync(listener: (status: string) => void): () => void {
    this.syncListeners.push(listener);

    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(status: string): void {
    this.syncListeners.forEach((listener) => listener(status));
  }

  /**
   * Get all tasks
   */
  getTasks(): MobileBackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Clear all tasks
   */
  clearTasks(): void {
    this.tasks.clear();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    AppState.removeEventListener('change', this.handleAppStateChange);
  }
}

// Export singleton
export const mobileBackgroundSync = new MobileBackgroundSyncManager();

/**
 * Initialize background sync with auto-start
 */
export async function initializeMobileBackgroundSync(): Promise<() => void> {
  console.log('[MobileSync] Initializing...');

  // Start sync on init
  mobileBackgroundSync.startSync();

  // Cleanup function
  return () => {
    mobileBackgroundSync.destroy();
  };
}
