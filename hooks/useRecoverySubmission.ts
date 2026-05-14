// useRecoverySubmission — handles recovery submission, undo, and duplicate-prevention logic
import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { ApiService, Shop, User } from '@/services/api';
import { StorageService, PendingNotification, OfflineRecovery } from '@/services/storage';
import { getTodayDateStr } from '@/utils/format';
import type {
  NotifChoiceState,
  PendingNotifAfterSuccess,
  LastRecoveryInfo,
} from './useNotificationFlow';

// ── Recovery payload shape (matches RecoveryBottomSheet) ──────────────────
export interface RecoveryPayload {
  amount: number;
  description: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAddress?: string;
  markGpsVisit: boolean;
  outOfRange?: boolean;
}

// ── Success overlay state ──────────────────────────────────────────────────
export interface SuccessState {
  visible: boolean;
  shopName: string;
  amount: number;
  isOffline: boolean;
}

// ── Hook params ────────────────────────────────────────────────────────────
interface UseRecoverySubmissionParams {
  user: User | null;
  isOnline: boolean;
  recoveryShop: Shop | null;
  distributorPhone: string | null;
  addToOfflineQueue: (item: OfflineRecovery) => Promise<void>;

  // State setters owned by other hooks — passed in for cross-hook communication
  setRecoveryShop: React.Dispatch<React.SetStateAction<Shop | null>>;
  setTodayRecovery: React.Dispatch<React.SetStateAction<number>>;
  setVisitedShopIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setPendingNotifAfterSuccess: React.Dispatch<React.SetStateAction<PendingNotifAfterSuccess | null>>;
  setNotifChoice: React.Dispatch<React.SetStateAction<NotifChoiceState>>;
  setPhoneInputShop: React.Dispatch<React.SetStateAction<Shop | null>>;
  loadPendingNotifications: () => void;
}

export function useRecoverySubmission({
  user,
  isOnline,
  recoveryShop,
  distributorPhone,
  addToOfflineQueue,
  setRecoveryShop,
  setTodayRecovery,
  setVisitedShopIds,
  setPendingNotifAfterSuccess,
  setNotifChoice,
  setPhoneInputShop,
  loadPendingNotifications,
}: UseRecoverySubmissionParams) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successState, setSuccessState] = useState<SuccessState>({
    visible: false,
    shopName: '',
    amount: 0,
    isOffline: false,
  });
  const [lastRecoveryInfo, setLastRecoveryInfo] = useState<LastRecoveryInfo | null>(null);
  const [recoverySubmittedShopIds, setRecoverySubmittedShopIds] = useState<Set<string>>(new Set());

  // Load cached recovery submitted shops on mount for duplicate prevention
  useEffect(() => {
    StorageService.getRecoverySubmittedShops().then((cached) => {
      if (cached.length > 0) setRecoverySubmittedShopIds(new Set(cached));
    });
  }, []);

  // ── Submit recovery (online or offline) ────────────────────────────────
  const handleSubmitRecovery = async (payload: RecoveryPayload) => {
    if (!recoveryShop || !user) return;
    // Duplicate recovery prevention — check if recovery already submitted for this shop today
    if (recoverySubmittedShopIds.has(recoveryShop.id)) {
      Alert.alert(
        'Already Recovered',
        `Recovery for ${recoveryShop.name} has already been submitted today. You cannot submit duplicate recovery.`
      );
      return;
    }
    setIsSubmitting(true);
    const shopName = recoveryShop.name;
    const shopId = recoveryShop.id;
    const shopPhone = recoveryShop.phone;
    const openingBalance = recoveryShop.balance;
    const idempotencyKey = `${shopId}_${user.id}_${payload.amount}_${Date.now()}`;
    try {
      if (isOnline) {
        const result = await ApiService.submitRecovery({
          shopId,
          type: 'recovery',
          amount: payload.amount,
          createdBy: user.id,
          description: payload.description || undefined,
          gpsLat: payload.gpsLat,
          gpsLng: payload.gpsLng,
          gpsAddress: payload.gpsAddress,
          outOfRange: payload.outOfRange,
          companyId: user.companyId || undefined,
          idempotencyKey,
        });
        setVisitedShopIds((prev) => new Set([...prev, shopId]));
        StorageService.addVisitedShop(shopId);
        // Mark shop as recovery submitted (duplicate prevention)
        setRecoverySubmittedShopIds((prev) => new Set([...prev, shopId]));
        StorageService.addRecoverySubmittedShop(shopId);
        setTodayRecovery((prev) => {
          const newTotal = prev + payload.amount;
          StorageService.saveTodayRecovery(newTotal);
          return newTotal;
        });
        // Also create a ShopVisit record so admin map can show the location
        if (payload.markGpsVisit && payload.gpsLat && payload.gpsLng) {
          try {
            await ApiService.recordVisit(shopId, {
              orderbookerId: user.id,
              gpsLat: payload.gpsLat,
              gpsLng: payload.gpsLng,
              gpsAddress: payload.gpsAddress,
              inRange: !payload.outOfRange,
            });
          } catch (e) {
            console.warn('Failed to record GPS visit from recovery:', e);
          }
        }
        // Feature 12: Track last recovery for undo
        setLastRecoveryInfo({
          shopId,
          amount: payload.amount,
          isOffline: false,
          transactionId: result.id,
        });
        // Feature 13: Update last recovery date
        StorageService.updateLastRecoveryDate(shopId, new Date().toISOString());
        setSuccessState({ visible: true, shopName, amount: payload.amount, isOffline: false });

        if (shopPhone) {
          const remainingBalance = openingBalance - payload.amount;
          const pendingNotif: PendingNotification = {
            id: `${shopId}_${Date.now()}`,
            shopId,
            shopName,
            shopPhone,
            area: recoveryShop.area,
            openingBalance,
            recoveryAmount: payload.amount,
            remainingBalance,
            companyName: user.companyName || undefined,
            orderbookerName: user.name || undefined,
            distributorPhone: distributorPhone || undefined,
            createdAt: new Date().toISOString(),
            date: getTodayDateStr(),
          };
          await StorageService.addPendingNotification(pendingNotif);
          loadPendingNotifications();

          // Store pending notification data — will be shown when SuccessOverlay dismisses
          setPendingNotifAfterSuccess({
            shopId,
            shopPhone,
            shopName,
            shopAddress: recoveryShop.address || recoveryShop.area || undefined,
            shopOwnerName: recoveryShop.ownerName || undefined,
            openingBalance,
            recoveryAmount: payload.amount,
            remainingBalance,
            companyName: user.companyName || undefined,
            orderbookerName: user.name || undefined,
            distributorPhone: distributorPhone || undefined,
          });

          // Fallback timeout in case SuccessOverlay doesn't dismiss properly
          setTimeout(() => {
            setNotifChoice((prev) => {
              if (prev.visible) return prev;
              return {
                visible: true,
                shopId,
                shopPhone,
                shopName,
                shopAddress: recoveryShop.address || recoveryShop.area || undefined,
                shopOwnerName: recoveryShop.ownerName || undefined,
                openingBalance,
                recoveryAmount: payload.amount,
                remainingBalance,
                companyName: user.companyName || undefined,
                orderbookerName: user.name || undefined,
                distributorPhone: distributorPhone || undefined,
              };
            });
            setPendingNotifAfterSuccess(null);
          }, 4000);
        } else {
          // No phone number — show phone input popup to add number
          setPhoneInputShop(recoveryShop);
        }
      } else {
        // ── OFFLINE path ──────────────────────────────────────────────────
        const localId = `local_${Date.now()}`;
        await addToOfflineQueue({
          localId,
          shopId,
          shopName,
          amount: payload.amount,
          description: payload.description,
          gpsLat: payload.gpsLat,
          gpsLng: payload.gpsLng,
          gpsAddress: payload.gpsAddress,
          createdBy: user.id,
          createdAt: new Date().toISOString(),
        });
        if (payload.markGpsVisit) {
          setVisitedShopIds((prev) => new Set([...prev, shopId]));
          StorageService.addVisitedShop(shopId);
        }
        setRecoverySubmittedShopIds((prev) => new Set([...prev, shopId]));
        StorageService.addRecoverySubmittedShop(shopId);
        setTodayRecovery((prev) => {
          const newTotal = prev + payload.amount;
          StorageService.saveTodayRecovery(newTotal);
          return newTotal;
        });
        setLastRecoveryInfo({ shopId, amount: payload.amount, isOffline: true, localId });
        StorageService.updateLastRecoveryDate(shopId, new Date().toISOString());
        setSuccessState({ visible: true, shopName, amount: payload.amount, isOffline: true });

        // OFFLINE: Also create pending notification and show receipt/notification choice
        const remainingBalance = openingBalance - payload.amount;
        if (shopPhone) {
          const pendingNotif: PendingNotification = {
            id: `${shopId}_${Date.now()}`,
            shopId,
            shopName,
            shopPhone,
            area: recoveryShop.area,
            openingBalance,
            recoveryAmount: payload.amount,
            remainingBalance,
            companyName: user.companyName || undefined,
            orderbookerName: user.name || undefined,
            distributorPhone: distributorPhone || undefined,
            createdAt: new Date().toISOString(),
            date: getTodayDateStr(),
          };
          await StorageService.addPendingNotification(pendingNotif);
          loadPendingNotifications();

          setPendingNotifAfterSuccess({
            shopId,
            shopPhone,
            shopName,
            shopAddress: recoveryShop.address || recoveryShop.area || undefined,
            shopOwnerName: recoveryShop.ownerName || undefined,
            openingBalance,
            recoveryAmount: payload.amount,
            remainingBalance,
            companyName: user.companyName || undefined,
            orderbookerName: user.name || undefined,
            distributorPhone: distributorPhone || undefined,
          });

          setTimeout(() => {
            setNotifChoice((prev) => {
              if (prev.visible) return prev;
              return {
                visible: true,
                shopId,
                shopPhone,
                shopName,
                shopAddress: recoveryShop.address || recoveryShop.area || undefined,
                shopOwnerName: recoveryShop.ownerName || undefined,
                openingBalance,
                recoveryAmount: payload.amount,
                remainingBalance,
                companyName: user.companyName || undefined,
                orderbookerName: user.name || undefined,
                distributorPhone: distributorPhone || undefined,
              };
            });
            setPendingNotifAfterSuccess(null);
          }, 4000);
        } else {
          setPhoneInputShop(recoveryShop);
        }
      }
      setRecoveryShop(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit recovery. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Undo last recovery ────────────────────────────────────────────────
  const handleUndoRecovery = useCallback(async () => {
    if (!lastRecoveryInfo) return;
    const { shopId, amount, isOffline, transactionId, localId } = lastRecoveryInfo;

    try {
      setTodayRecovery((prev) => {
        const newTotal = Math.max(0, prev - amount);
        StorageService.saveTodayRecovery(newTotal);
        return newTotal;
      });
      setVisitedShopIds((prev) => {
        const next = new Set(prev);
        next.delete(shopId);
        StorageService.saveVisitedShops([...next]);
        return next;
      });
      setRecoverySubmittedShopIds((prev) => {
        const next = new Set(prev);
        next.delete(shopId);
        StorageService.removeRecoverySubmittedShop(shopId);
        return next;
      });

      if (isOffline && localId) {
        await StorageService.removeFromOfflineQueue([localId]);
      } else if (!isOffline && transactionId) {
        try {
          await ApiService.deleteTransaction(transactionId);
        } catch {
          console.warn('[Undo] Failed to delete transaction on server');
        }
      }

      // Feature 13: Remove last recovery date for this shop
      await StorageService.removeLastRecoveryDate(shopId);

      setLastRecoveryInfo(null);
      setSuccessState((s) => ({ ...s, visible: false }));
    } catch {
      Alert.alert('Undo Failed', 'Could not reverse the recovery. Please try again.');
    }
  }, [lastRecoveryInfo, setTodayRecovery, setVisitedShopIds]);

  // ── Open recovery sheet with duplicate check ──────────────────────────
  const handleOpenRecovery = useCallback(
    (shop: Shop) => {
      if (recoverySubmittedShopIds.has(shop.id)) {
        Alert.alert(
          'Already Recovered',
          `Recovery for ${shop.name} has already been submitted today. You cannot submit duplicate recovery.`
        );
        return;
      }
      setRecoveryShop(shop);
    },
    [recoverySubmittedShopIds, setRecoveryShop]
  );

  return {
    handleSubmitRecovery,
    handleUndoRecovery,
    handleOpenRecovery,
    isSubmitting,
    successState,
    setSuccessState,
    lastRecoveryInfo,
    setLastRecoveryInfo,
    recoverySubmittedShopIds,
  };
}
