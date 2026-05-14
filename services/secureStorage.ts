// Powered by Finexa
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  PIN: 'af_pin',
  WRONG_ATTEMPTS: 'af_wrong_attempts',
  LAST_ACTIVE: 'af_last_active',
} as const;

export const SecureStorageService = {
  // ── PIN Management ──────────────────────────────────────────────────
  savePin: async (pin: string): Promise<void> => {
    await SecureStore.setItemAsync(KEYS.PIN, pin);
  },

  getPin: async (): Promise<string | null> => {
    return SecureStore.getItemAsync(KEYS.PIN);
  },

  hasPin: async (): Promise<boolean> => {
    const pin = await SecureStore.getItemAsync(KEYS.PIN);
    return pin !== null && pin.length > 0;
  },

  clearPin: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(KEYS.PIN);
  },

  // ── Wrong Attempts Tracking ─────────────────────────────────────────
  getWrongAttempts: async (): Promise<number> => {
    const raw = await SecureStore.getItemAsync(KEYS.WRONG_ATTEMPTS);
    return raw ? parseInt(raw, 10) : 0;
  },

  incrementWrongAttempts: async (): Promise<number> => {
    const current = await SecureStorageService.getWrongAttempts();
    const next = current + 1;
    await SecureStore.setItemAsync(KEYS.WRONG_ATTEMPTS, String(next));
    return next;
  },

  resetWrongAttempts: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(KEYS.WRONG_ATTEMPTS);
  },

  // ── Last Active Timestamp ───────────────────────────────────────────
  saveLastActive: async (timestamp: number): Promise<void> => {
    await SecureStore.setItemAsync(KEYS.LAST_ACTIVE, String(timestamp));
  },

  getLastActive: async (): Promise<number | null> => {
    const raw = await SecureStore.getItemAsync(KEYS.LAST_ACTIVE);
    return raw ? parseInt(raw, 10) : null;
  },

  clearLastActive: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(KEYS.LAST_ACTIVE);
  },

  // ── Full Clear (used on forced logout) ──────────────────────────────
  clearAll: async (): Promise<void> => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.PIN),
      SecureStore.deleteItemAsync(KEYS.WRONG_ATTEMPTS),
      SecureStore.deleteItemAsync(KEYS.LAST_ACTIVE),
    ]);
  },
};
