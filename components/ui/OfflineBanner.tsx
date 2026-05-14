// Finexa Orderbooker
import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '@/constants/theme';

interface OfflineBannerProps {
  isOnline: boolean;
  queueCount: number;
  isSyncing?: boolean;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime?: string | null;
  onSync?: () => void;
}

export const OfflineBanner = memo(function OfflineBanner({
  isOnline,
  queueCount,
  isSyncing = false,
  syncStatus = 'idle',
  lastSyncTime,
  onSync,
}: OfflineBannerProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Spin animation for sync icon
  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [isSyncing]);

  // Fade in/out
  useEffect(() => {
    const shouldShow = !isOnline || queueCount > 0 || syncStatus === 'success' || syncStatus === 'error';
    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, queueCount, syncStatus]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Format last sync time
  const syncLabel = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
    : null;

  // ── OFFLINE banner ───────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <Animated.View style={[styles.banner, styles.offlineBanner, { opacity: fadeAnim }]}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="wifi-off" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.bannerTitle}>You are offline</Text>
          <Text style={styles.bannerSub}>
            {queueCount > 0
              ? `${queueCount} ${queueCount === 1 ? 'recovery' : 'recoveries'} queued — will sync when online`
              : 'Working from local cache'}
          </Text>
        </View>
        {queueCount > 0 ? (
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>{queueCount}</Text>
          </View>
        ) : null}
      </Animated.View>
    );
  }

  // ── SYNCING banner ───────────────────────────────────────────────────────
  if (isSyncing || syncStatus === 'syncing') {
    return (
      <Animated.View style={[styles.banner, styles.syncingBanner, { opacity: fadeAnim }]}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <MaterialIcons name="sync" size={16} color="#FFFFFF" />
        </Animated.View>
        <View style={styles.textBlock}>
          <Text style={styles.bannerTitle}>Syncing recoveries...</Text>
          <Text style={styles.bannerSub}>{queueCount} pending upload</Text>
        </View>
      </Animated.View>
    );
  }

  // ── SUCCESS banner ───────────────────────────────────────────────────────
  if (syncStatus === 'success' && queueCount === 0) {
    return (
      <Animated.View style={[styles.banner, styles.successBanner, { opacity: fadeAnim }]}>
        <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
        <View style={styles.textBlock}>
          <Text style={styles.bannerTitle}>All recoveries synced</Text>
          {syncLabel ? <Text style={styles.bannerSub}>Last sync: {syncLabel}</Text> : null}
        </View>
      </Animated.View>
    );
  }

  // ── PENDING SYNC banner (online but queue > 0) ───────────────────────────
  if (queueCount > 0) {
    return (
      <Animated.View style={[styles.banner, styles.pendingBanner, { opacity: fadeAnim }]}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="cloud-upload" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.bannerTitle}>
            {queueCount} {queueCount === 1 ? 'recovery' : 'recoveries'} pending sync
          </Text>
          <Text style={styles.bannerSub}>Tap to upload now</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.syncNowBtn, pressed && { opacity: 0.75 }]}
          onPress={onSync}
          hitSlop={8}
        >
          <Text style={styles.syncNowText}>Sync Now</Text>
        </Pressable>
      </Animated.View>
    );
  }

  // ── ERROR banner ─────────────────────────────────────────────────────────
  if (syncStatus === 'error') {
    return (
      <Animated.View style={[styles.banner, styles.errorBanner, { opacity: fadeAnim }]}>
        <MaterialIcons name="error-outline" size={16} color="#FFFFFF" />
        <View style={styles.textBlock}>
          <Text style={styles.bannerTitle}>Sync failed</Text>
          <Text style={styles.bannerSub}>Some recoveries could not be uploaded</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.syncNowBtn, pressed && { opacity: 0.75 }]}
          onPress={onSync}
          hitSlop={8}
        >
          <Text style={styles.syncNowText}>Retry</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return null;
});

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  offlineBanner: {
    backgroundColor: '#1F2937',
  },
  syncingBanner: {
    backgroundColor: '#2563EB',
  },
  successBanner: {
    backgroundColor: Colors.primary,
  },
  pendingBanner: {
    backgroundColor: Colors.secondary,
  },
  errorBanner: {
    backgroundColor: Colors.danger,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  bannerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  queueBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  queueBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  syncNowBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  syncNowText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
