// useTodayStats — loads and tracks today's recovery total and notification counts
import { useState, useCallback, useEffect } from 'react';
import { ApiService } from '@/services/api';
import { StorageService } from '@/services/storage';
import { getTodayDateStr } from '@/utils/format';
import type { User } from '@/services/api';

interface UseTodayStatsParams {
  user: User | null;
  setVisitedShopIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useTodayStats({ user, setVisitedShopIds }: UseTodayStatsParams) {
  const [todayRecovery, setTodayRecovery] = useState(0);
  const [smsSentCount, setSmsSentCount] = useState(0);
  const [whatsappSentCount, setWhatsappSentCount] = useState(0);

  // Load cached todayRecovery & notification counts on mount so they persist across refreshes
  useEffect(() => {
    StorageService.getTodayRecovery().then((cached) => {
      if (cached > 0) setTodayRecovery(cached);
    });
    StorageService.getNotifCounts().then((counts) => {
      if (counts.sms > 0) setSmsSentCount(counts.sms);
      if (counts.whatsapp > 0) setWhatsappSentCount(counts.whatsapp);
    });
  }, []);

  const loadTodayStats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await ApiService.getRecoverySummary(getTodayDateStr());
      const myEntry = res.orderbookers.find((ob) => ob.orderbookerId === user.id);
      if (myEntry) {
        setTodayRecovery(myEntry.totalRecovery);
        StorageService.saveTodayRecovery(myEntry.totalRecovery);
        const visited = new Set(
          myEntry.shops.filter((s) => s.visited).map((s) => s.shopId)
        );
        // Merge API visited with locally tracked visited (local takes precedence)
        setVisitedShopIds((prev) => {
          const merged = new Set([...prev, ...visited]);
          StorageService.saveVisitedShops([...merged]);
          return merged;
        });
      }
      // If myEntry not found, don't reset — keep cached value
    } catch {
      // API failed — keep cached value, don't reset to 0
      console.warn('[loadTodayStats] Failed to fetch, using cached value');
    }
  }, [user, setVisitedShopIds]);

  return {
    todayRecovery,
    setTodayRecovery,
    loadTodayStats,
    smsSentCount,
    setSmsSentCount,
    whatsappSentCount,
    setWhatsappSentCount,
  };
}
