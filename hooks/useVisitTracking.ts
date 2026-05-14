// useVisitTracking — tracks which shops have been GPS-visited today
import { useState, useCallback, useEffect } from 'react';
import { ApiService } from '@/services/api';
import { StorageService } from '@/services/storage';
import { getTodayDateStr } from '@/utils/format';
import type { User } from '@/services/api';

interface UseVisitTrackingParams {
  user: User | null;
  isOnline: boolean;
}

export function useVisitTracking({ user, isOnline }: UseVisitTrackingParams) {
  const [visitedShopIds, setVisitedShopIds] = useState<Set<string>>(new Set());

  // Load cached visited shops on mount so they persist across app refreshes
  useEffect(() => {
    StorageService.getVisitedShops().then((cached) => {
      if (cached.length > 0) setVisitedShopIds(new Set(cached));
    });
  }, []);

  const handleGpsVisitMarked = useCallback(
    async (shopId: string, gpsLat: number, gpsLng: number, address: string) => {
      setVisitedShopIds((prev) => new Set([...prev, shopId]));
      StorageService.addVisitedShop(shopId);

      // Create a ShopVisit record on the server so admin map can show the location
      if (user && isOnline) {
        try {
          await ApiService.recordVisit(shopId, {
            orderbookerId: user.id,
            gpsLat,
            gpsLng,
            gpsAddress: address,
            inRange: true,
          });
        } catch (e) {
          console.warn('Failed to record GPS visit on server:', e);
        }

        // GPS UPDATE FIX: Check if this shop has a recovery submitted today without GPS
        // If so, update that transaction's GPS coordinates
        try {
          const today = getTodayDateStr();
          const txnResult = await ApiService.getTransactions({
            shopId,
            createdBy: user.id,
            type: 'recovery',
            date: today,
            limit: 10,
          });
          // Find a transaction without GPS
          const txnWithoutGps = txnResult.transactions.find(
            (t) => !t.gpsLat && !t.gpsLng
          );
          if (txnWithoutGps) {
            console.log('[GPS Update] Found transaction without GPS:', txnWithoutGps.id, '— updating...');
            await ApiService.updateTransactionGps(txnWithoutGps.id, {
              gpsLat,
              gpsLng,
              gpsAddress: address,
            });
            console.log('[GPS Update] Successfully updated GPS for transaction:', txnWithoutGps.id);
          }
        } catch (e) {
          console.warn('Failed to update GPS on existing transaction:', e);
        }
      }
    },
    [user, isOnline]
  );

  return { visitedShopIds, handleGpsVisitMarked, setVisitedShopIds };
}
