/**
 * Offline Status Indicator for React Native
 * Shows user when app is offline or syncing
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  NetInfo,
  useWindowDimensions
} from 'react-native';
import { useBackgroundSyncStatus } from '../hooks/usePerformance';

export function OfflineStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const { syncStatus } = useBackgroundSyncStatus();
  const [fadeAnim] = useState(new Animated.Value(0));
  const { width } = useWindowDimensions();

  useEffect(() => {
    const subscription = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? true;
      setIsOnline(online);

      if (online) {
        console.log('[OfflineIndicator] Back online');
      } else {
        console.log('[OfflineIndicator] Went offline');
      }
    });

    return () => {
      subscription();
    };
  }, []);

  useEffect(() => {
    if (isOnline && syncStatus === 'idle') {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [isOnline, syncStatus, fadeAnim]);

  const showIndicator = !isOnline || syncStatus === 'syncing';

  if (!showIndicator) {
    return null;
  }

  const isSyncing = syncStatus === 'syncing';

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, width },
        isSyncing ? styles.syncingContainer : styles.offlineContainer
      ]}
    >
      <View style={styles.content}>
        {isSyncing ? (
          <>
            <Animated.View
              style={[
                styles.spinner,
                {
                  transform: [
                    {
                      rotate: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg']
                      })
                    }
                  ]
                }
              ]}
            />
            <Text style={styles.text}>Syncing data...</Text>
          </>
        ) : (
          <>
            <Text style={styles.wifiIcon}>📵</Text>
            <View>
              <Text style={styles.boldText}>Offline Mode</Text>
              <Text style={styles.subText}>Changes will sync when online</Text>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  offlineContainer: {
    backgroundColor: '#ef4444'
  },
  syncingContainer: {
    backgroundColor: '#3b82f6'
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500'
  },
  boldText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  },
  subText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2
  },
  wifiIcon: {
    fontSize: 20
  },
  spinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: '#ffffff'
  }
});

/**
 * Monitor cache size
 */
export function CacheMonitor() {
  const [cacheSize, setCacheSize] = useState({ itemCount: 0, sizeKB: 0 });

  useEffect(() => {
    const checkCacheSize = async () => {
      const stats = await mobileCache.getStats();
      setCacheSize(stats);
    };

    checkCacheSize();
    const interval = setInterval(checkCacheSize, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  if (cacheSize.sizeKB === 0) return null;

  return (
    <View style={styles.cacheMonitor}>
      <Text style={styles.cacheText}>
        Cache: {cacheSize.itemCount} items, {cacheSize.sizeKB}KB
      </Text>
    </View>
  );
}

const cacheStyles = StyleSheet.create({
  cacheMonitor: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    margin: 8
  },
  cacheText: {
    fontSize: 12,
    color: '#6b7280'
  }
});

// Import mobile cache
import { mobileCache } from '../cache/mobileCache';

Object.assign(cacheStyles, cacheStyles);
