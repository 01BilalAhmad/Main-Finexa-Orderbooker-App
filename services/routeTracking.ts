// services/routeTracking.ts — Route Tracking API Service
// Handles all API calls for route session management

import { API_BASE_URL } from '@/constants/config';

// Types
export interface RouteSession {
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

export interface ShopProximity {
  shopId: string;
  shopName: string;
  distance: number;
  action: 'entered' | 'exited' | 'nearby' | null;
}

// Internal request helper (no auth token needed for route-sessions public endpoints)
async function routeRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Try to get token for authenticated requests
  try {
    const { StorageService } = require('./storage');
    const token = await StorageService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {}

  const res = await fetch(url, { headers, ...options });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const RouteTrackingService = {
  // Start a new route session
  startRoute: async (payload: {
    orderbookerId: string;
    startLat?: number;
    startLng?: number;
    startAddress?: string;
  }): Promise<{ session: RouteSession }> => {
    return routeRequest('/api/route-sessions/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Send a single GPS location
  sendLocation: async (payload: {
    sessionId: string;
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    altitude?: number;
    batteryLevel?: number;
    isOffline?: boolean;
  }): Promise<{ success: boolean; shopProximity: ShopProximity | null; allProximities: ShopProximity[] }> => {
    return routeRequest('/api/route-sessions/location', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Send batch GPS locations (for offline queue)
  sendLocationsBatch: async (payload: {
    sessionId: string;
    locations: Array<{
      lat: number;
      lng: number;
      accuracy?: number;
      speed?: number;
      altitude?: number;
      batteryLevel?: number;
      isOffline?: boolean;
      recordedAt?: string;
    }>;
  }): Promise<{ saved: number; shopProximity: ShopProximity[] }> => {
    return routeRequest('/api/route-sessions/locations-batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // End the current route session
  endRoute: async (payload: {
    sessionId: string;
    endLat?: number;
    endLng?: number;
    endAddress?: string;
    autoEndReason?: string;
    status?: 'auto_ended';
  }): Promise<{
    session: RouteSession;
    summary: {
      totalDistance: number;
      totalDuration: number;
      shopsVisited: number;
      locationsCount: number;
    };
  }> => {
    return routeRequest('/api/route-sessions/end', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Get active session for current orderbooker
  getActiveSession: async (orderbookerId: string): Promise<{
    session: RouteSession | null;
    shopVisits: any[];
  }> => {
    return routeRequest(`/api/route-sessions/active?orderbookerId=${orderbookerId}`);
  },
};
