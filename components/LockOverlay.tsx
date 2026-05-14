// Finexa Orderbooker
import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useLock } from '@/hooks/useLock';
import { PinLockScreen } from '@/components/ui/PinLockScreen';
import { PinSetupScreen } from '@/components/ui/PinSetupScreen';
import { SecureStorageService } from '@/services/secureStorage';

export function LockOverlay() {
  const { user, logout } = useAuth();
  const { isLocked, needsPinSetup, unlock, setNeedsPinSetup, resetIdleTimer } = useLock();
  const router = useRouter();

  const handleUnlock = useCallback(() => {
    unlock();
  }, [unlock]);

  const handlePinSet = useCallback(() => {
    setNeedsPinSetup(false);
    unlock();
    resetIdleTimer();
  }, [setNeedsPinSetup, unlock, resetIdleTimer]);

  const handleForceLogout = useCallback(async () => {
    await logout();
    await SecureStorageService.clearAll();
    router.replace('/login' as any);
  }, [logout, router]);

  // Only show overlay if user is authenticated
  if (!user) return null;

  // PIN setup screen — shown when user is logged in but has no PIN
  if (needsPinSetup) {
    return (
      <View style={styles.overlay}>
        <PinSetupScreen onPinSet={handlePinSet} />
      </View>
    );
  }

  // PIN lock screen — shown when app is locked
  if (isLocked) {
    return (
      <View style={styles.overlay}>
        <PinLockScreen onUnlock={handleUnlock} onForceLogout={handleForceLogout} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});
