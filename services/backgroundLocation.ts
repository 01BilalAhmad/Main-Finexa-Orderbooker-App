// services/backgroundLocation.ts — Background GPS Location Tracking
// Uses expo-location foreground service to track GPS every 30 seconds

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { RouteTrackingService } from './routeTracking';
import { StorageService } from './storage';

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
  batteryLevel: number | null;
  isOffline: boolean;
  recordedAt: string;
}

let locationQueue: QueuedLocation[] = [];
let isSending = false;

// Define the background task
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('[BackgroundLocation] Task error:', error);
      return;
    }

    if (!data) return;

    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    const loc = locations[locations.length - 1]; // Use the latest location
    const { coords } = loc;

    if (!coords) return;

    // Get battery level
    let batteryLevel: number | null = null;
    try {
      const batteryState = await Battery.getBatteryLevelAsync();
      batteryLevel = batteryState;
    } catch {}

    // Get session ID from storage
    let sessionId: string | null = null;
    try {
      sessionId = await StorageService.getRouteSessionId();
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
      batteryLevel,
      isOffline: false,
      recordedAt: new Date(loc.timestamp).toISOString(),
    };

    // Add to queue
    locationQueue.push(locationData);

    // Try to send immediately, or batch later
    await flushLocationQueue(sessionId);
  });
}

// Flush the location queue to the server
async function flushLocationQueue(sessionId: string) {
  if (isSending || locationQueue.length === 0) return;

  isSending = true;
  const batch = [...locationQueue];
  locationQueue = [];

  try {
    if (batch.length === 1) {
      // Single location — use single endpoint
      await RouteTrackingService.sendLocation({
        sessionId,
        ...batch[0],
      });
    } else {
      // Multiple locations — use batch endpoint
      await RouteTrackingService.sendLocationsBatch({
        sessionId,
        locations: batch,
      });
    }
  } catch (error) {
    console.error('[BackgroundLocation] Failed to send, re-queuing:', error);
    // Re-queue with isOffline flag
    locationQueue = batch.map(l => ({ ...l, isOffline: true })).concat(locationQueue);

    // Limit queue size to prevent memory issues
    if (locationQueue.length > 200) {
      locationQueue = locationQueue.slice(-200);
    }
  } finally {
    isSending = false;

    // If more queued, try again
    if (locationQueue.length > 0) {
      setTimeout(() => flushLocationQueue(sessionId), 5000);
    }
  }
}

// Start background location tracking
export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    // Request permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.error('[BackgroundLocation] Foreground permission denied');
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('[BackgroundLocation] Background permission denied, using foreground only');
      // Fall back to foreground tracking
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

    // Start background location updates
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
    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('[BackgroundLocation] Stopped');
    }

    // Flush any remaining locations
    const sessionId = await StorageService.getRouteSessionId();
    if (sessionId && locationQueue.length > 0) {
      await flushLocationQueue(sessionId);
    }

    locationQueue = [];
  } catch (error) {
    console.error('[BackgroundLocation] Failed to stop:', error);
  }
}

// Check if background tracking is running
export async function isBackgroundLocationRunning(): Promise<boolean> {
  try {
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
  const sid = sessionId || (await StorageService.getRouteSessionId());
  if (sid && locationQueue.length > 0) {
    await flushLocationQueue(sid);
  }
}
