// Finexa Orderbooker
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { SecureStorageService } from '@/services/secureStorage';
import { StorageService } from '@/services/storage';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface LockContextType {
  isLocked: boolean;
  needsPinSetup: boolean;
  lock: () => void;
  unlock: () => void;
  checkLockState: () => Promise<void>;
  resetIdleTimer: () => void;
  setNeedsPinSetup: (v: boolean) => void;
}

export const LockContext = createContext<LockContextType | undefined>(undefined);

export function LockProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastActiveRef = useRef<number>(Date.now());
  const isInitializedRef = useRef(false);

  // Reset the idle timer — called on any user interaction
  const resetIdleTimer = useCallback(() => {
    lastActiveRef.current = Date.now();
    SecureStorageService.saveLastActive(lastActiveRef.current);
  }, []);

  // Lock the app
  const lock = useCallback(() => {
    setIsLocked(true);
  }, []);

  // Unlock the app and reset idle timer
  const unlock = useCallback(() => {
    setIsLocked(false);
    resetIdleTimer();
  }, [resetIdleTimer]);

  // Check the current lock state — called on mount and app foreground
  const checkLockState = useCallback(async () => {
    try {
      const [hasPin, savedUser] = await Promise.all([
        SecureStorageService.hasPin(),
        StorageService.getUser(),
      ]);

      if (!savedUser) {
        // No session — no lock needed
        setIsLocked(false);
        setNeedsPinSetup(false);
        return;
      }

      if (!hasPin) {
        // Session exists but no PIN set — need setup
        setNeedsPinSetup(true);
        setIsLocked(false);
        return;
      }

      // Session exists and PIN is set — check idle time
      setNeedsPinSetup(false);
      const lastActive = await SecureStorageService.getLastActive();

      if (!lastActive) {
        // No last active time stored (fresh install or cleared) — lock
        setIsLocked(true);
        resetIdleTimer();
        return;
      }

      const elapsed = Date.now() - lastActive;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        setIsLocked(true);
      } else {
        setIsLocked(false);
        // Update last active to now since we just foregrounded
        resetIdleTimer();
      }
    } catch (e) {
      console.error('Lock state check error:', e);
      // On error, lock for safety
      setIsLocked(true);
    }
  }, [resetIdleTimer]);

  // Initialize lock state on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      checkLockState();
    }
  }, [checkLockState]);

  // Listen for AppState changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && appStateRef.current !== 'active') {
        // App came to foreground
        checkLockState();
      } else if (nextAppState === 'background' && appStateRef.current === 'active') {
        // App went to background — save current timestamp
        lastActiveRef.current = Date.now();
        SecureStorageService.saveLastActive(lastActiveRef.current);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [checkLockState]);

  // Periodic idle check while app is active (every 30 seconds)
  useEffect(() => {
    if (isLocked) return; // Don't run timer if already locked

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActiveRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        setIsLocked(true);
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [isLocked]);

  return (
    <LockContext.Provider
      value={{
        isLocked,
        needsPinSetup,
        lock,
        unlock,
        checkLockState,
        resetIdleTimer,
        setNeedsPinSetup,
      }}
    >
      {children}
    </LockContext.Provider>
  );
}
