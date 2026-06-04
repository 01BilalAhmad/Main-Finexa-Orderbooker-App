// contexts/RouteTrackingContext.tsx — Route Session Management
// Handles start/end route, background GPS, and session state

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { RouteTrackingService, RouteSession, ShopProximity } from '@/services/routeTracking';
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  getCurrentLocation,
  flushOfflineLocations,
} from '@/services/backgroundLocation';
import { StorageService } from '@/services/storage';
import { useAuth } from './AuthContext';

// ── Types ──────────────────────────────────────────────────────────
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

export function RouteTrackingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RouteTrackingState>(initialState);
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);

  // Restore session from storage on mount
  useEffect(() => {
    async function restoreSession() {
      if (!user) return;

      try {
        const savedSessionId = await StorageService.getRouteSessionId();
        const savedStart = await StorageService.getRouteSessionStart();

        if (savedSessionId) {
          // Verify session is still active on server
          try {
            const result = await RouteTrackingService.getActiveSession(user.id);
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
              await startBackgroundLocationTracking();
              console.log('[RouteTracking] Restored active session:', savedSessionId);
            } else {
              // Session no longer active, clear storage
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
            await startBackgroundLocationTracking();
          }
        }
      } catch (error) {
        console.error('[RouteTracking] Restore failed:', error);
      }
    }

    restoreSession();
  }, [user?.id]);

  // Check for midnight auto-end (server auto-ends at 12 AM PKT)
  useEffect(() => {
    if (!state.isTracking) return;

    const interval = setInterval(async () => {
      try {
        if (!user || !sessionIdRef.current) return;
        const result = await RouteTrackingService.getActiveSession(user.id);
        if (!result.session || result.session.status !== 'active') {
          // Session was auto-ended by server
          await stopBackgroundLocationTracking();
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
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [state.isTracking, user?.id]);

  // Flush offline locations when app comes to foreground
  useEffect(() => {
    const flushOnResume = async () => {
      if (state.isTracking && sessionIdRef.current) {
        await flushOfflineLocations(sessionIdRef.current);
      }
    };

    // Listen for app state changes
    const { AppState } = require('react-native');
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
      // Get current GPS location
      const location = await getCurrentLocation();

      // Call API to start session
      const result = await RouteTrackingService.startRoute({
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
      const trackingStarted = await startBackgroundLocationTracking();
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
      // Stop background tracking first
      await stopBackgroundLocationTracking();

      // Flush any remaining locations
      await flushOfflineLocations(currentSessionId);

      // Get current GPS for end location
      const location = await getCurrentLocation();

      // Call API to end session
      const result = await RouteTrackingService.endRoute({
        sessionId: currentSessionId,
        endLat: location?.lat,
        endLng: location?.lng,
        endAddress: location?.address,
      });

      // Clear storage
      await StorageService.saveRouteSessionId(null);
      sessionIdRef.current = null;

      setState({
        ...initialState,
      });

      console.log('[RouteTracking] Route ended:', result.summary);
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
