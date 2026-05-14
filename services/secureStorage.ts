// Finexa Orderbooker
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  PIN: 'fx_pin',
  TOKEN: 'fx_token',
  WRONG_ATTEMPTS: 'fx_wrong_attempts',
  LAST_ACTIVE: 'fx_last_active',
} as const;

// ── Simple hash function for PIN (better than plaintext) ────────────────
async function hashPin(pin: string): Promise<string> {
  // Use a simple but effective approach - combine pin with a salt and encode
  const salt = 'finexa_pin_salt_2025';
  const combined = `${salt}:${pin}:${salt}`;
  // For React Native, we'll use a basic encoding approach
  // This is not cryptographically perfect but much better than plaintext
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `h:${Math.abs(hash).toString(36)}`;
}

export const SecureStorageService = {
  // ── Token Management (JWT stored securely) ──────────────────────────
  saveToken: async (token: string): Promise<void> => {
    await SecureStore.setItemAsync(KEYS.TOKEN, token);
  },

  getToken: async (): Promise<string | null> => {
    return SecureStore.getItemAsync(KEYS.TOKEN);
  },

  removeToken: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(KEYS.TOKEN);
  },

  // ── PIN Management (hashed before storing) ─────────────────────────
  savePin: async (pin: string): Promise<void> => {
    const hashed = await hashPin(pin);
    await SecureStore.setItemAsync(KEYS.PIN, hashed);
  },

  getPin: async (): Promise<string | null> => {
    // Returns the hashed PIN
    return SecureStore.getItemAsync(KEYS.PIN);
  },

  hasPin: async (): Promise<boolean> => {
    const pin = await SecureStore.getItemAsync(KEYS.PIN);
    return pin !== null && pin.length > 0;
  },

  verifyPin: async (inputPin: string): Promise<boolean> => {
    const storedHash = await SecureStore.getItemAsync(KEYS.PIN);
    if (!storedHash) return false;
    const inputHash = await hashPin(inputPin);
    return inputHash === storedHash;
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
      SecureStore.deleteItemAsync(KEYS.TOKEN),
      SecureStore.deleteItemAsync(KEYS.WRONG_ATTEMPTS),
      SecureStore.deleteItemAsync(KEYS.LAST_ACTIVE),
    ]);
  },
};
