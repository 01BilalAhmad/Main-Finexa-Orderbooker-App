// useNotificationFlow — manages notification choice, pending notifications, and phone input flow
import { useState, useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { StorageService, PendingNotification } from '@/services/storage';
import { getTodayDateStr } from '@/utils/format';
import type { User, Shop } from '@/services/api';

// ── Shared types ────────────────────────────────────────────────────────────
export interface NotifChoiceState {
  visible: boolean;
  shopId: string;
  shopPhone: string;
  shopName: string;
  shopAddress?: string;
  shopOwnerName?: string;
  openingBalance: number;
  recoveryAmount: number;
  remainingBalance: number;
  companyName?: string;
  orderbookerName?: string;
  distributorPhone?: string;
}

export interface PendingNotifAfterSuccess {
  shopId: string;
  shopPhone: string;
  shopName: string;
  shopAddress?: string;
  shopOwnerName?: string;
  openingBalance: number;
  recoveryAmount: number;
  remainingBalance: number;
  companyName?: string;
  orderbookerName?: string;
  distributorPhone?: string;
}

export interface LastRecoveryInfo {
  shopId: string;
  amount: number;
  isOffline: boolean;
  transactionId?: string;
  localId?: string;
}

// ── Hook params ─────────────────────────────────────────────────────────────
interface UseNotificationFlowParams {
  user: User | null;
  distributorPhone: string | null;
  // Use a ref so this hook can read the latest value without a circular dependency
  lastRecoveryInfoRef: MutableRefObject<LastRecoveryInfo | null>;
  recoveryShop: Shop | null;
}

const EMPTY_NOTIF_CHOICE: NotifChoiceState = {
  visible: false,
  shopId: '',
  shopPhone: '',
  shopName: '',
  openingBalance: 0,
  recoveryAmount: 0,
  remainingBalance: 0,
};

export function useNotificationFlow({
  user,
  distributorPhone,
  lastRecoveryInfoRef,
  recoveryShop,
}: UseNotificationFlowParams) {
  const [pendingNotifAfterSuccess, setPendingNotifAfterSuccess] =
    useState<PendingNotifAfterSuccess | null>(null);
  const [notifChoice, setNotifChoice] = useState<NotifChoiceState>(EMPTY_NOTIF_CHOICE);
  const [phoneInputShop, setPhoneInputShop] = useState<Shop | null>(null);
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([]);

  // ── Load pending notifications from storage ─────────────────────────────
  const loadPendingNotifications = useCallback(async () => {
    try {
      const today = getTodayDateStr();
      const list = await StorageService.getPendingNotifications(today);
      setPendingNotifications(list);
    } catch {
      /* not critical */
    }
  }, []);

  // ── Pending Reminder: Show alert when app comes to foreground ──────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        loadPendingNotifications();
      }
    });
    return () => subscription.remove();
  }, [loadPendingNotifications]);

  // ── Pending Reminder: Show alert on app open if there are pending receipts ──
  const pendingAlertShownRef = useRef(false);
  useEffect(() => {
    if (pendingNotifications.length > 0 && user && !pendingAlertShownRef.current) {
      pendingAlertShownRef.current = true;
      const timer = setTimeout(() => {
        Alert.alert(
          'Pending Receipts',
          `${pendingNotifications.length} receipt${pendingNotifications.length > 1 ? 's' : ''} pending hain — SMS/WhatsApp bhejna lazmi hai!`,
          [
            { text: 'Abhi Bhej', onPress: () => setShowPending(true) },
            { text: 'Baad Mein', style: 'cancel' },
          ]
        );
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (pendingNotifications.length === 0) {
      pendingAlertShownRef.current = false;
    }
  }, [pendingNotifications.length, user]);

  // showPending is kept local since it's only used inside this hook's UI alerts
  const [showPending, setShowPending] = useState(false);

  // ── Handle phone number saved from PhoneInputModal → show NotificationChoice ──
  const handlePhoneSaved = useCallback(
    (savedPhone: string, savedOwnerName?: string) => {
      if (!phoneInputShop || !user) return;
      const shopName = phoneInputShop.name;
      const shopId = phoneInputShop.id;
      const openingBalance = phoneInputShop.balance;

      const lastRecoveryInfo = lastRecoveryInfoRef.current;
      const remainingBalance =
        openingBalance - (lastRecoveryInfo?.shopId === shopId ? lastRecoveryInfo.amount : 0);
      const recoveryAmount =
        lastRecoveryInfo?.shopId === shopId ? lastRecoveryInfo.amount : 0;

      const ownerName = savedOwnerName || phoneInputShop.ownerName || undefined;

      // Create pending notification with the new phone number
      const pendingNotif: PendingNotification = {
        id: `${shopId}_${Date.now()}`,
        shopId,
        shopName,
        shopPhone: savedPhone,
        area: phoneInputShop.area,
        openingBalance,
        recoveryAmount,
        remainingBalance,
        companyName: user.companyName || undefined,
        orderbookerName: user.name || undefined,
        distributorPhone: distributorPhone || undefined,
        createdAt: new Date().toISOString(),
        date: getTodayDateStr(),
      };
      StorageService.addPendingNotification(pendingNotif);
      loadPendingNotifications();

      // Close phone input modal and show notification choice
      setPhoneInputShop(null);
      setNotifChoice({
        visible: true,
        shopId: phoneInputShop?.id || '',
        shopPhone: savedPhone,
        shopName,
        shopAddress: phoneInputShop.address || phoneInputShop.area || undefined,
        shopOwnerName: ownerName,
        openingBalance,
        recoveryAmount,
        remainingBalance,
        companyName: user.companyName || undefined,
        orderbookerName: user.name || undefined,
        distributorPhone: distributorPhone || undefined,
      });
    },
    [phoneInputShop, user, lastRecoveryInfoRef, distributorPhone, loadPendingNotifications]
  );

  return {
    pendingNotifAfterSuccess,
    setPendingNotifAfterSuccess,
    notifChoice,
    setNotifChoice,
    phoneInputShop,
    setPhoneInputShop,
    handlePhoneSaved,
    pendingNotifications,
    loadPendingNotifications,
    showPending,
    setShowPending,
  };
}
