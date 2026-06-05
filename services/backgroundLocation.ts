// services/backgroundLocation.ts — Background GPS Location Tracking
// Uses expo-location foreground service to track GPS every 30 seconds
// NOTE: expo-battery and expo-task-manager removed — battery level is null, 
// tracking uses expo-location's built-in foreground service instead

const BACKGROUND_LOCATION_TASK = 'background-route-tracking';
const LOCATION_INTERVAL_MS = 30000; // 30 seconds
const LOCATION_DISTANCE_M = 0; // 0 = no distance filter, use time only

// Queue for offline locations
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
let taskDefined = false;

// Lazy-load expo-location (only when needed)
let _Location: typeof import('expo-location') | null = null;

async function getLocationModule() {
  if (!_Location) {
    try {
      _Location = require('expo-location');
    } catch (e) {
      console.error('[BackgroundLocation] Failed to load expo-location:', e);
      return null;
    }
  }
  return _Location;
}

// Lazy-load expo-task-manager
let _TaskManager: typeof import('expo-task-manager') | null = null;

async function getTaskManagerModule() {
  if (!_TaskManager) {
    try {
      _TaskManager = require('expo-task-manager');
    } catch (e) {
      console.error('[BackgroundLocation] Failed to load expo-task-manager:', e);
      return null;
    }
  }
  return _TaskManager;
}

async function getRouteTrackingService() {
  try {
    const mod = require('./routeTracking');
    return mod.RouteTrackingService;
  } catch (e) {
    console.error('[BackgroundLocation] Failed to load RouteTrackingService:', e);
    return null;
  }
}

async function getStorageService() {
  try {
    const mod = require('./storage');
    return mod.StorageService;
  } catch (e) {
    console.error('[BackgroundLocation] Failed to load StorageService:', e);
    return null;
  }
}

// Define the background task LAZILY (only when first needed)
async function ensureTaskDefined() {
  if (taskDefined) return true;

  const TaskManager = await getTaskManagerModule();
  if (!TaskManager) return false;

  try {
    if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
      TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
        if (error) {
          console.error('[BackgroundLocation] Task error:', error);
          return;
        }

        if (!data) return;

        const Location = await getLocationModule();
        if (!Location) return;

        const { locations } = data as { locations: Location.LocationObject[] };
        if (!locations || locations.length === 0) return;

        const loc = locations[locations.length - 1];
        const { coords } = loc;

        if (!coords) return;

        // Get session ID from storage
        let sessionId: string | null = null;
        try {
          const Storage = await getStorageService();
          if (Storage) sessionId = await Storage.getRouteSessionId();
        } catch {}

        if (!sessionId) {
          console.warn('[BackgroundLocation] No active session ID, skipping location');
          return;
        }

        const locationData: QueuedLocation = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy ?? null,
          speed: coords.speed ?? null,
          altitude: coords.altitude ?? null,
          batteryLevel: null, // expo-battery not installed
          isOffline: false,
          recordedAt: new Date(loc.timestamp).toISOString(),
        };

        // Add to queue
        locationQueue.push(locationData);

        // Try to send immediately, or batch later
        await flushLocationQueue(sessionId);
      });
    }
    taskDefined = true;
    return true;
  } catch (e) {
    console.error('[BackgroundLocation] Failed to define task:', e);
    return false;
  }
}

// Flush the location queue to the server
async function flushLocationQueue(sessionId: string) {
  if (isSending || locationQueue.length === 0) return;

  isSending = true;
  const batch = [...locationQueue];
  locationQueue = [];

  try {
    const service = await getRouteTrackingService();
    if (!service) {
      locationQueue = batch.map(l => ({ ...l, isOffline: true })).concat(locationQueue);
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
  } catch (error) {
    console.error('[BackgroundLocation] Failed to send, re-queuing:', error);
    locationQueue = batch.map(l => ({ ...l, isOffline: true })).concat(locationQueue);
    if (locationQueue.length > 200) {
      locationQueue = locationQueue.slice(-200);
    }
  } finally {
    isSending = false;
    if (locationQueue.length > 0) {
      setTimeout(() => flushLocationQueue(sessionId), 5000);
    }
  }
}

// Start background location tracking
export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    const Location = await getLocationModule();
    if (!Location) return false;

    const taskReady = await ensureTaskDefined();
    if (!taskReady) {
      console.error('[BackgroundLocation] Task not defined, cannot start');
      return false;
    }

    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.error('[BackgroundLocation] Foreground permission denied');
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('[BackgroundLocation] Background permission denied, using foreground only');
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: LOCATION_INTERVAL_MS,
        distanceInterval: LOCATION_DISTANCE_M,
        foregroundService: {
          notificationTitle: 'Finexa Route Tracking',
          notificationBody: 'Your route is being tracked for live monitoring',
          notificationColor: '#4338CA',
        },
        showsBackgroundLocationIndicator: true,
      });
      return true;
    }

    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      console.log('[BackgroundLocation] Already running');
      return true;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: LOCATION_INTERVAL_MS,
      distanceInterval: LOCATION_DISTANCE_M,
      foregroundService: {
        notificationTitle: 'Finexa Route Tracking',
        notificationBody: 'Your route is being tracked for live monitoring',
        notificationColor: '#4338CA',
      },
      showsBackgroundLocationIndicator: true,
    });

    console.log('[BackgroundLocation] Started successfully');
    return true;
  } catch (error) {
    console.error('[BackgroundLocation] Failed to start:', error);
    return false;
  }
}

// Stop background location tracking
export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const Location = await getLocationModule();
    if (!Location) return;

    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[BackgroundLocation] Stopped');
    }

    const Storage = await getStorageService();
    if (Storage) {
      const sessionId = await Storage.getRouteSessionId();
      if (sessionId && locationQueue.length > 0) {
        await flushLocationQueue(sessionId);
      }
    }

    locationQueue = [];
  } catch (error) {
    console.error('[BackgroundLocation] Failed to stop:', error);
  }
}

// Check if background tracking is running
export async function isBackgroundLocationRunning(): Promise<boolean> {
  try {
    const Location = await getLocationModule();
    if (!Location) return false;
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}

// Get current location once (for start/end of route)
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
    console.error('[BackgroundLocation] getCurrentLocation failed:', error);
    return null;
  }
}

// Flush any pending offline locations (call on app resume)
export async function flushOfflineLocations(sessionId?: string): Promise<void> {
  try {
    const Storage = await getStorageService();
    const sid = sessionId || (Storage ? await Storage.getRouteSessionId() : null);
    if (sid && locationQueue.length > 0) {
      await flushLocationQueue(sid);
    }
  } catch {}
}
