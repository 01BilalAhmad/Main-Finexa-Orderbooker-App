// services/backgroundLocation.ts — GPS Location Tracking Service
// Uses expo-location's watchPositionAsync() for foreground GPS tracking
// Works WITHOUT expo-task-manager — no crash risk!
//
// OFFLINE SUPPORT:
// - When internet is OFF: GPS locations saved to AsyncStorage (persist across kills)
// - When internet returns: Auto-flush all queued locations to server
// - Max 500 locations stored locally (~4 hours at 30s intervals)
//
// BEHAVIOR:
// - App foreground: GPS updates every 30 seconds ✅
// - App minimized: GPS pauses, resumes when app returns ✅
// - App killed: Offline locations saved in AsyncStorage, restored on next launch ✅
// - Net OFF → Net ON: Auto-sync queued locations ✅

const LOCATION_INTERVAL_MS = 30000; // 30 seconds between GPS pings
const LOCATION_DISTANCE_M = 10; // minimum 10 meters between updates
const MAX_OFFLINE_LOCATIONS = 500; // max stored locally (~4 hours of tracking)

// ── Queue for offline locations ────────────────────────────────────
interface QueuedLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  altitude: number | null;
  batteryLevel: number | null; // Always null — expo-battery not installed
  isOffline: boolean;
  recordedAt: string;
}

let locationQueue: QueuedLocation[] = [];
let isSending = false;

// ── Active watch subscription ──────────────────────────────────────
let _watchSubscription: { remove: () => void } | null = null;
let _isWatching = false;

// ── Network status ─────────────────────────────────────────────────
let _isOnline = true;
let _netInfoUnsubscribe: (() => void) | null = null;

// ── Lazy-load modules ──────────────────────────────────────────────
let _Location: typeof import('expo-location') | null = null;

async function getLocationModule() {
  if (!_Location) {
    try {
      _Location = require('expo-location');
    } catch (e) {
      console.error('[GPS] Failed to load expo-location:', e);
      return null;
    }
  }
  return _Location;
}

async function getRouteTrackingService() {
  try {
    const mod = require('./routeTracking');
    return mod.RouteTrackingService;
  } catch (e) {
    console.error('[GPS] Failed to load RouteTrackingService:', e);
    return null;
  }
}

async function getStorageService() {
  try {
    const mod = require('./storage');
    return mod.StorageService;
  } catch (e) {
    console.error('[GPS] Failed to load StorageService:', e);
    return null;
  }
}

// ── AsyncStorage persistence for offline locations ─────────────────
// When net is OFF, locations are saved to AsyncStorage so they survive app kills

async function persistOfflineLocations() {
  try {
    const Storage = await getStorageService();
    if (!Storage || locationQueue.length === 0) return;

    // Only persist locations that are marked offline (failed to send)
    const offlineOnly = locationQueue.filter(l => l.isOffline);
    if (offlineOnly.length > 0) {
      await Storage.addOfflineRouteLocations(offlineOnly);
      console.log(`[GPS] Persisted ${offlineOnly.length} offline locations to AsyncStorage`);
    }
  } catch (e) {
    console.error('[GPS] Failed to persist offline locations:', e);
  }
}

async function loadPersistedLocations() {
  try {
    const Storage = await getStorageService();
    if (!Storage) return;

    const persisted = await Storage.getOfflineRouteLocations();
    if (persisted.length > 0) {
      // Add persisted locations to the front of the queue (they're older)
      locationQueue = [...persisted, ...locationQueue.filter(l => !l.isOffline)];
      console.log(`[GPS] Loaded ${persisted.length} persisted locations from AsyncStorage`);
    }
  } catch (e) {
    console.error('[GPS] Failed to load persisted locations:', e);
  }
}

async function clearPersistedLocations() {
  try {
    const Storage = await getStorageService();
    if (Storage) await Storage.clearOfflineRouteLocations();
  } catch {}
}

// ── NetInfo listener — auto-flush when internet returns ────────────
async function setupNetInfoListener() {
  try {
    const NetInfo = require('@react-native-community/netinfo');
    _netInfoUnsubscribe = NetInfo.addEventListener((state: any) => {
      const wasOffline = !_isOnline;
      _isOnline = state.isConnected === true;

      if (wasOffline && _isOnline) {
        console.log('[GPS] Internet restored — auto-flushing offline locations');
        // Small delay to let network stabilize
        setTimeout(async () => {
          const Storage = await getStorageService();
          const sessionId = Storage ? await Storage.getRouteSessionId() : null;
          if (sessionId && locationQueue.length > 0) {
            await flushLocationQueue(sessionId);
          }
        }, 2000);
      }
    });
    console.log('[GPS] NetInfo listener set up');
  } catch (e) {
    console.warn('[GPS] NetInfo not available, auto-sync disabled:', e);
  }
}

// ── Flush the location queue to server ─────────────────────────────
async function flushLocationQueue(sessionId: string) {
  if (isSending || locationQueue.length === 0) return;

  isSending = true;
  const batch = [...locationQueue];
  locationQueue = [];

  try {
    const service = await getRouteTrackingService();
    if (!service) {
      // No service available — mark as offline and persist
      const offlineBatch = batch.map(l => ({ ...l, isOffline: true }));
      locationQueue = offlineBatch;
      await persistOfflineLocations();
      return;
    }

    if (batch.length === 1) {
      await service.sendLocation({
        sessionId,
        ...batch[0],
      });
    } else {
      await service.sendLocationsBatch({
        sessionId,
        locations: batch,
      });
    }

    console.log(`[GPS] Sent ${batch.length} location(s) to server`);

    // Successfully sent — clear persisted offline locations
    await clearPersistedLocations();
  } catch (error) {
    console.error('[GPS] Failed to send, saving offline:', error);
    // Network error — mark as offline, persist to AsyncStorage
    const offlineBatch = batch.map(l => ({ ...l, isOffline: true }));
    locationQueue = offlineBatch;

    // Keep queue size manageable
    if (locationQueue.length > MAX_OFFLINE_LOCATIONS) {
      locationQueue = locationQueue.slice(-MAX_OFFLINE_LOCATIONS);
    }

    // Persist to AsyncStorage so locations survive app kill
    await persistOfflineLocations();
  } finally {
    isSending = false;
    // If more locations accumulated while sending, flush again
    if (locationQueue.length > 0 && _isOnline) {
      setTimeout(() => flushLocationQueue(sessionId), 5000);
    }
  }
}

// ── Handle each GPS location update ────────────────────────────────
async function handleLocationUpdate(coords: {
  latitude: number;
  longitude: number;
  accuracy: number | null | undefined;
  speed: number | null | undefined;
  altitude: number | null | undefined;
}, timestamp: number) {
  try {
    // Get session ID from storage
    const Storage = await getStorageService();
    const sessionId = Storage ? await Storage.getRouteSessionId() : null;

    if (!sessionId) {
      console.warn('[GPS] No active session ID, skipping location');
      return;
    }

    const locationData: QueuedLocation = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy ?? null,
      speed: coords.speed ?? null,
      altitude: coords.altitude ?? null,
      batteryLevel: null, // expo-battery not installed
      isOffline: !_isOnline, // Mark offline if no internet
      recordedAt: new Date(timestamp).toISOString(),
    };

    // Add to queue
    locationQueue.push(locationData);

    if (_isOnline) {
      // Try to send immediately
      await flushLocationQueue(sessionId);
    } else {
      // No internet — persist to AsyncStorage
      console.log(`[GPS] Net OFF — location saved locally (${locationQueue.length} queued)`);
      await persistOfflineLocations();
    }
  } catch (error) {
    console.error('[GPS] handleLocationUpdate error:', error);
  }
}

// ── Start foreground GPS tracking using watchPositionAsync ─────────
export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    // If already watching, don't start again
    if (_isWatching && _watchSubscription) {
      console.log('[GPS] Already watching');
      return true;
    }

    const Location = await getLocationModule();
    if (!Location) return false;

    // Request foreground permission
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.error('[GPS] Foreground permission denied');
      return false;
    }

    // Try to get background permission too (for future task-manager upgrade)
    try {
      await Location.requestBackgroundPermissionsAsync();
    } catch {
      // Not critical — we use foreground tracking
    }

    // Load any persisted offline locations from previous session
    await loadPersistedLocations();

    // Set up NetInfo listener for auto-sync when internet returns
    await setupNetInfoListener();

    // Start watching position — this works in foreground WITHOUT task-manager
    _watchSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_INTERVAL_MS,
        distanceInterval: LOCATION_DISTANCE_M,
      },
      (location) => {
        handleLocationUpdate(location.coords, location.timestamp);
      }
    );

    _isWatching = true;
    console.log('[GPS] watchPositionAsync started — tracking every 30s');

    // If there are persisted offline locations, try to flush them now
    if (locationQueue.length > 0) {
      const Storage = await getStorageService();
      const sessionId = Storage ? await Storage.getRouteSessionId() : null;
      if (sessionId) {
        setTimeout(() => flushLocationQueue(sessionId), 3000);
      }
    }

    return true;
  } catch (error) {
    console.error('[GPS] Failed to start:', error);
    _isWatching = false;
    return false;
  }
}

// ── Stop GPS tracking ──────────────────────────────────────────────
export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    // Stop the watch subscription
    if (_watchSubscription) {
      _watchSubscription.remove();
      _watchSubscription = null;
    }
    _isWatching = false;

    // Remove NetInfo listener
    if (_netInfoUnsubscribe) {
      _netInfoUnsubscribe();
      _netInfoUnsubscribe = null;
    }

    // Flush any remaining locations in queue
    const Storage = await getStorageService();
    if (Storage) {
      const sessionId = await Storage.getRouteSessionId();
      if (sessionId && locationQueue.length > 0) {
        await flushLocationQueue(sessionId);
      }
    }

    locationQueue = [];
    console.log('[GPS] Stopped');
  } catch (error) {
    console.error('[GPS] Failed to stop:', error);
  }
}

// ── Check if tracking is running ───────────────────────────────────
export async function isBackgroundLocationRunning(): Promise<boolean> {
  return _isWatching;
}

// ── Get current location once (for start/end of route) ─────────────
export async function getCurrentLocation(): Promise<{
  lat: number;
  lng: number;
  accuracy: number | null;
  address?: string;
} | null> {
  try {
    const Location = await getLocationModule();
    if (!Location) return null;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    let address: string | undefined;
    try {
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geo) {
        address = [geo.name, geo.street, geo.city, geo.region].filter(Boolean).join(', ');
      }
    } catch {}

    return {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      address,
    };
  } catch (error) {
    console.error('[GPS] getCurrentLocation failed:', error);
    return null;
  }
}

// ── Flush any pending offline locations (call on app resume) ───────
export async function flushOfflineLocations(sessionId?: string): Promise<void> {
  try {
    // First load any persisted locations from AsyncStorage
    await loadPersistedLocations();

    const Storage = await getStorageService();
    const sid = sessionId || (Storage ? await Storage.getRouteSessionId() : null);
    if (sid && locationQueue.length > 0) {
      await flushLocationQueue(sid);
    }
  } catch {}
}

// ── Resume tracking after app comes back to foreground ──────────────
export async function resumeTrackingIfNeeded(): Promise<boolean> {
  try {
    const Storage = await getStorageService();
    const sessionId = Storage ? await Storage.getRouteSessionId() : null;

    if (!sessionId) return false; // No active route

    if (_isWatching) {
      // Already watching, just flush any pending
      await flushOfflineLocations(sessionId);
      return true;
    }

    // Restart the watch (it may have been paused/lost when app was backgrounded)
    return await startBackgroundLocationTracking();
  } catch (error) {
    console.error('[GPS] resumeTrackingIfNeeded failed:', error);
    return false;
  }
}

// ── Get count of offline locations (for UI display) ────────────────
export function getOfflineLocationCount(): number {
  return locationQueue.filter(l => l.isOffline).length;
}

// ── Check if currently online ──────────────────────────────────────
export function isNetworkOnline(): boolean {
  return _isOnline;
}
