// contexts/RouteTrackingContext.tsx — Route Session Management
// Handles start/end route, foreground GPS tracking, and session state
// CRASH-SAFE: Uses expo-location watchPositionAsync() — no task-manager needed!
//
// TRACKING BEHAVIOR:
// - App foreground: GPS updates every 30 seconds ✅
// - App minimized: GPS pauses, auto-resumes when app returns ✅
// - App killed: Session saved in storage, restored on next launch ✅

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, Component } from 'react';
import { AppState } from 'react-native';
import { StorageService } from '@/services/storage';
import { useAuth } from './AuthContext';

// ── Types ──────────────────────────────────────────────────────────
interface RouteSession {
  id: string;
  orderbookerId: string;
  startTime: string;
  endTime: string | null;
  startLat: number | null;
  startLng: number | null;
  startAddress: string | null;
  endLat: number | null;
  endLng: number | null;
  endAddress: string | null;
  totalDistance: number;
  totalDuration: number | null;
  status: 'active' | 'ended' | 'auto_ended';
  autoEndReason: string | null;
}

interface ShopProximity {
  shopId: string;
  shopName: string;
  distance: number;
  action: 'entered' | 'exited' | 'nearby' | null;
}

interface RouteTrackingState {
  isTracking: boolean;
  sessionId: string | null;
  session: RouteSession | null;
  startTime: string | null;
  lastProximity: ShopProximity | null;
  isStarting: boolean;
  isStopping: boolean;
  error: string | null;
}

interface RouteTrackingContextType extends RouteTrackingState {
  startRoute: () => Promise<void>;
  endRoute: () => Promise<void>;
  clearError: () => void;
}

const initialState: RouteTrackingState = {
  isTracking: false,
  sessionId: null,
  session: null,
  startTime: null,
  lastProximity: null,
  isStarting: false,
  isStopping: false,
  error: null,
};

const RouteTrackingContext = createContext<RouteTrackingContextType>({
  ...initialState,
  startRoute: async () => {},
  endRoute: async () => {},
  clearError: () => {},
});

export function useRouteTracking() {
  return useContext(RouteTrackingContext);
}

// ── Lazy-loaded modules (prevents crash on import) ─────────────────
let _RouteTrackingService: any = null;
let _backgroundLocation: any = null;

async function getRouteTrackingService() {
  if (!_RouteTrackingService) {
    try {
      const mod = await import('@/services/routeTracking');
      _RouteTrackingService = mod.RouteTrackingService;
    } catch (e) {
      console.error('[RouteTracking] Failed to load RouteTrackingService:', e);
      return null;
    }
  }
  return _RouteTrackingService;
}

async function getBackgroundLocation() {
  if (!_backgroundLocation) {
    try {
      _backgroundLocation = await import('@/services/backgroundLocation');
    } catch (e) {
      console.error('[RouteTracking] Failed to load backgroundLocation:', e);
      return null;
    }
  }
  return _backgroundLocation;
}

// ── Error Boundary ─────────────────────────────────────────────────
class RouteTrackingErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RouteTracking] ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      // Silently fail — app still works, just no route tracking
      return this.props.children;
    }
    return this.props.children;
  }
}

// ── Provider ───────────────────────────────────────────────────────
function RouteTrackingProviderInner({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RouteTrackingState>(initialState);
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const prevUserRef = useRef<string | null>(null);

  // Cleanup route tracking on logout (user becomes null)
  useEffect(() => {
    if (prevUserRef.current && !user) {
      // User logged out — stop tracking and reset state
      (async () => {
        try {
          const bg = await getBackgroundLocation();
          if (bg) await bg.stopBackgroundLocationTracking();
        } catch {}
      })();
      sessionIdRef.current = null;
      setState(initialState);
      console.log('[RouteTracking] Cleaned up on logout');
    }
    prevUserRef.current = user?.id || null;
  }, [user?.id]);

  // Restore session from storage on mount
  useEffect(() => {
    async function restoreSession() {
      if (!user) return;

      try {
        const savedSessionId = await StorageService.getRouteSessionId();
        const savedStart = await StorageService.getRouteSessionStart();

        if (savedSessionId) {
          const service = await getRouteTrackingService();
          if (!service) return;

          try {
            const result = await service.getActiveSession(user.id);
            if (result.session && result.session.id === savedSessionId && result.session.status === 'active') {
              sessionIdRef.current = savedSessionId;
              setState({
                isTracking: true,
                sessionId: savedSessionId,
                session: result.session,
                startTime: savedStart,
                lastProximity: null,
                isStarting: false,
                isStopping: false,
                error: null,
              });

              // Restart GPS tracking (foreground watchPositionAsync)
              const bg = await getBackgroundLocation();
              if (bg) await bg.startBackgroundLocationTracking();
              console.log('[RouteTracking] Restored active session:', savedSessionId);
            } else {
              // Session no longer active on server
              await StorageService.saveRouteSessionId(null);
              sessionIdRef.current = null;
            }
          } catch {
            // Server unreachable — assume session is still active if we have local ID
            sessionIdRef.current = savedSessionId;
            setState(prev => ({
              ...prev,
              isTracking: true,
              sessionId: savedSessionId,
              startTime: savedStart,
            }));
            const bg = await getBackgroundLocation();
            if (bg) await bg.startBackgroundLocationTracking();
          }
        }
      } catch (error) {
        console.error('[RouteTracking] Restore failed:', error);
      }
    }

    restoreSession();
  }, [user?.id]);

  // Check for midnight auto-end
  useEffect(() => {
    if (!state.isTracking) return;

    const interval = setInterval(async () => {
      try {
        if (!user || !sessionIdRef.current) return;
        const service = await getRouteTrackingService();
        if (!service) return;
        const result = await service.getActiveSession(user.id);
        if (!result.session || result.session.status !== 'active') {
          const bg = await getBackgroundLocation();
          if (bg) await bg.stopBackgroundLocationTracking();
          await StorageService.saveRouteSessionId(null);
          sessionIdRef.current = null;
          setState({
            ...initialState,
            error: result.session?.autoEndReason === '12am_auto'
              ? 'Route was auto-ended at midnight'
              : null,
          });
        }
      } catch {}
    }, 60000);

    return () => clearInterval(interval);
  }, [state.isTracking, user?.id]);

  // Handle app foreground/background transitions
  // When app returns to foreground: resume GPS tracking + flush offline locations
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active' && state.isTracking && sessionIdRef.current) {
        console.log('[RouteTracking] App came to foreground — resuming GPS tracking');
        try {
          const bg = await getBackgroundLocation();
          if (bg) {
            // Resume tracking (restarts watchPositionAsync if needed)
            await bg.resumeTrackingIfNeeded();
            // Flush any locations that were queued while offline
            await bg.flushOfflineLocations(sessionIdRef.current!);
          }
        } catch (error) {
          console.error('[RouteTracking] Resume failed:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => subscription?.remove();
  }, [state.isTracking]);

  // Start a new route session
  const startRoute = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isStarting: true, error: null }));

    try {
      const bg = await getBackgroundLocation();
      const service = await getRouteTrackingService();
      if (!service || !bg) {
        setState(prev => ({ ...prev, isStarting: false, error: 'Route tracking not available' }));
        return;
      }

      // Get current GPS location
      const location = await bg.getCurrentLocation();

      // Call API to start session
      const result = await service.startRoute({
        orderbookerId: user.id,
        startLat: location?.lat,
        startLng: location?.lng,
        startAddress: location?.address,
      });

      const session = result.session;
      sessionIdRef.current = session.id;

      // Save to storage (for crash/kill recovery)
      await StorageService.saveRouteSessionId(session.id);

      // Start GPS tracking — watchPositionAsync sends updates every 30 seconds
      const trackingStarted = await bg.startBackgroundLocationTracking();
      if (!trackingStarted) {
        console.warn('[RouteTracking] GPS tracking failed to start — route session created but no live GPS');
      }

      setState({
        isTracking: true,
        sessionId: session.id,
        session,
        startTime: new Date().toISOString(),
        lastProximity: null,
        isStarting: false,
        isStopping: false,
        error: null,
      });

      console.log('[RouteTracking] Route started:', session.id);
    } catch (error: any) {
      console.error('[RouteTracking] Start failed:', error);
      setState(prev => ({
        ...prev,
        isStarting: false,
        error: error.message || 'Failed to start route',
      }));
    }
  }, [user]);

  // End the current route session — ROBUST with retry logic
  const endRoute = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    setState(prev => ({ ...prev, isStopping: true, error: null }));

    let endLocation: { lat?: number; lng?: number; address?: string } | null = null;
    let apiCallSucceeded = false;

    try {
      const bg = await getBackgroundLocation();
      const service = await getRouteTrackingService();

      // Step 1: Stop GPS tracking FIRST (even if API call fails later, GPS must stop)
      try {
        if (bg) await bg.stopBackgroundLocationTracking();
      } catch (gpsStopError) {
        console.warn('[RouteTracking] GPS stop failed, continuing with end route:', gpsStopError);
      }

      // Step 2: Flush any remaining locations (before ending session on server)
      try {
        if (bg) await bg.flushOfflineLocations(currentSessionId);
      } catch (flushError) {
        console.warn('[RouteTracking] Flush failed, continuing with end route:', flushError);
      }

      // Step 3: Get current GPS for end location
      try {
        endLocation = bg ? await bg.getCurrentLocation() : null;
      } catch (locError) {
        console.warn('[RouteTracking] Get end location failed:', locError);
      }

      // Step 4: Call API to end session — WITH RETRY (up to 3 attempts)
      if (service) {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const result = await service.endRoute({
              sessionId: currentSessionId,
              endLat: endLocation?.lat,
              endLng: endLocation?.lng,
              endAddress: endLocation?.address,
            });
            console.log('[RouteTracking] Route ended:', result.summary);
            apiCallSucceeded = true;
            break; // Success — exit retry loop
          } catch (apiError: any) {
            console.warn(`[RouteTracking] End route attempt ${attempt}/${maxRetries} failed:`, apiError.message);
            if (attempt < maxRetries) {
              // Wait before retrying (exponential backoff: 2s, 4s)
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            } else {
              // All retries exhausted
              console.error('[RouteTracking] All end route attempts failed');
              throw apiError;
            }
          }
        }
      }

      // Step 5: Clear local state (regardless of API success, GPS is already stopped)
      await StorageService.saveRouteSessionId(null);
      sessionIdRef.current = null;

      setState({
        ...initialState,
        // If API failed but GPS stopped, still reset state but show a warning
        error: !apiCallSucceeded ? 'Route ended locally but server may still show active. It will auto-update shortly.' : null,
      });
    } catch (error: any) {
      console.error('[RouteTracking] End failed:', error);

      // Even on failure, clear local tracking state (GPS already stopped above)
      // This prevents the app from being stuck in "stopping" state
      try {
        await StorageService.saveRouteSessionId(null);
      } catch {}
      sessionIdRef.current = null;

      setState(prev => ({
        ...initialState,
        error: error.message || 'Failed to end route on server. The route will be auto-ended shortly.',
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return (
    <RouteTrackingContext.Provider
      value={{
        ...state,
        startRoute,
        endRoute,
        clearError,
      }}
    >
      {children}
    </RouteTrackingContext.Provider>
  );
}

// ── Exported Provider with Error Boundary ──────────────────────────
export function RouteTrackingProvider({ children }: { children: React.ReactNode }) {
  return (
    <RouteTrackingErrorBoundary>
      <RouteTrackingProviderInner>
        {children}
      </RouteTrackingProviderInner>
    </RouteTrackingErrorBoundary>
  );
}
