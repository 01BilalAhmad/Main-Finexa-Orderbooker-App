// contexts/RouteTrackingContext.tsx — Route Session Management
// Handles start/end route, background GPS, and session state
// CRASH-SAFE: All native module calls are lazy and wrapped in try-catch

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, Component } from 'react';
import { AppState, View, Text } from 'react-native';
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

// ── Lazy-loaded native modules (prevents crash on import) ──────
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

// ── Error Boundary ──────────────────────────────────────────────
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

// ── Provider ────────────────────────────────────────────────────
function RouteTrackingProviderInner({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RouteTrackingState>(initialState);
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const prevUserRef = useRef<string | null>(null);

  // Cleanup route tracking on logout (user becomes null)
  useEffect(() => {
    if (prevUserRef.current && !user) {
      // User logged out — stop background tracking and reset state
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

              // Restart background tracking
              const bg = await getBackgroundLocation();
              if (bg) await bg.startBackgroundLocationTracking();
              console.log('[RouteTracking] Restored active session:', savedSessionId);
            } else {
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

  // Flush offline locations when app comes to foreground
  useEffect(() => {
    const flushOnResume = async () => {
      if (state.isTracking && sessionIdRef.current) {
        try {
          const bg = await getBackgroundLocation();
          if (bg) await bg.flushOfflineLocations(sessionIdRef.current!);
        } catch {}
      }
    };

    const subscription = AppState.addEventListener('change', (nextState: string) => {
      if (nextState === 'active') {
        flushOnResume();
      }
    });

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

      // Save to storage
      await StorageService.saveRouteSessionId(session.id);

      // Start background GPS tracking
      const trackingStarted = await bg.startBackgroundLocationTracking();
      if (!trackingStarted) {
        console.warn('[RouteTracking] Background tracking failed to start, route will still work but GPS updates may be limited');
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

  // End the current route session
  const endRoute = useCallback(async () => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;

    setState(prev => ({ ...prev, isStopping: true, error: null }));

    try {
      const bg = await getBackgroundLocation();
      const service = await getRouteTrackingService();

      // Stop background tracking first
      if (bg) await bg.stopBackgroundLocationTracking();

      // Flush any remaining locations
      if (bg) await bg.flushOfflineLocations(currentSessionId);

      // Get current GPS for end location
      const location = bg ? await bg.getCurrentLocation() : null;

      // Call API to end session
      if (service) {
        const result = await service.endRoute({
          sessionId: currentSessionId,
          endLat: location?.lat,
          endLng: location?.lng,
          endAddress: location?.address,
        });
        console.log('[RouteTracking] Route ended:', result.summary);
      }

      // Clear storage
      await StorageService.saveRouteSessionId(null);
      sessionIdRef.current = null;

      setState({
        ...initialState,
      });
    } catch (error: any) {
      console.error('[RouteTracking] End failed:', error);
      setState(prev => ({
        ...prev,
        isStopping: false,
        error: error.message || 'Failed to end route',
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

// ── Exported Provider with Error Boundary ───────────────────────
export function RouteTrackingProvider({ children }: { children: React.ReactNode }) {
  return (
    <RouteTrackingErrorBoundary>
      <RouteTrackingProviderInner>
        {children}
      </RouteTrackingProviderInner>
    </RouteTrackingErrorBoundary>
  );
}
