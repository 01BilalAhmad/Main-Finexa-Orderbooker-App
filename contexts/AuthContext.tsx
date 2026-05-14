// Finexa Orderbooker
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { StorageService } from '@/services/storage';
import { SecureStorageService } from '@/services/secureStorage';
import { ApiService, User } from '@/services/api';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updatePhone: (phone: string) => Promise<void>;
  distributorPhone: string | null;
  fetchDistributorPhone: (companyId?: string) => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [distributorPhone, setDistributorPhone] = useState<string | null>(null);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const [savedUser, savedToken, savedDistPhone] = await Promise.all([
        StorageService.getUser(),
        SecureStorageService.getToken(),
        StorageService.getDistributorPhone(),
      ]);
      if (savedUser && savedToken) {
        setUser(savedUser);
        setToken(savedToken);
        // Use saved distributor phone first (works offline)
        if (savedDistPhone) {
          setDistributorPhone(savedDistPhone);
        }
        // Then try to refresh from API (will fail silently if offline)
        fetchDistPhone(savedUser.companyId);
      }
    } catch (e) {
      console.error('Session load error:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(username: string, password: string) {
    const res = await ApiService.login(username, password);
    // Save user to AsyncStorage, token to SecureStore
    await Promise.all([
      StorageService.saveUser(res.user),
      SecureStorageService.saveToken(res.token),
    ]);
    setUser(res.user);
    setToken(res.token);
    // Fetch distributor phone on login
    fetchDistPhone(res.user.companyId);
  }

  async function logout() {
    // Full logout: clear session data + secure token + all app data
    await Promise.all([
      StorageService.clearAllData(),
      SecureStorageService.removeToken(),
      SecureStorageService.clearAll(),
    ]);
    setUser(null);
    setToken(null);
    setDistributorPhone(null);
  }

  async function refreshUser() {
    const saved = await StorageService.getUser();
    if (saved) setUser(saved);
  }

  async function updatePhone(phone: string) {
    if (!user) return;
    await ApiService.updateUserPhone(user.id, phone);
    const updatedUser = { ...user, phone };
    setUser(updatedUser);
    const currentToken = await SecureStorageService.getToken();
    if (currentToken) {
      await Promise.all([
        StorageService.saveUser(updatedUser),
        SecureStorageService.saveToken(currentToken),
      ]);
    }
  }

  async function fetchDistPhone(companyId?: string) {
    try {
      const res = await ApiService.fetchDistributorPhone(companyId);
      const phone = res.distributorPhone || null;
      setDistributorPhone(phone);
      // Save locally for offline use
      if (phone) {
        await StorageService.saveDistributorPhone(phone);
      }
      return phone;
    } catch (e) {
      console.error('Failed to fetch distributor phone:', e);
      return null;
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser, updatePhone, distributorPhone, fetchDistributorPhone: fetchDistPhone }}>
      {children}
    </AuthContext.Provider>
  );
}
