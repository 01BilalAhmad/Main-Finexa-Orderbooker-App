// Powered by Finexa
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { StorageService } from '@/services/storage';
import { ApiService, User, UserCompany } from '@/services/api';

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
  companies: UserCompany[];
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [distributorPhone, setDistributorPhone] = useState<string | null>(null);
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(null);

  useEffect(() => {
    loadSession();
  }, []);

  // When selectedCompanyId changes, update distributor phone
  useEffect(() => {
    if (selectedCompanyId) {
      fetchDistPhone(selectedCompanyId);
      // Persist the selection
      StorageService.saveSelectedCompanyId(selectedCompanyId);
    } else if (user?.companyId) {
      fetchDistPhone(user.companyId);
    }
  }, [selectedCompanyId]);

  async function loadSession() {
    try {
      const [savedUser, savedToken, savedDistPhone, savedCompanyId] = await Promise.all([
        StorageService.getUser(),
        StorageService.getToken(),
        StorageService.getDistributorPhone(),
        StorageService.getSelectedCompanyId(),
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

        // Load companies from user object if available
        if (savedUser.companies && savedUser.companies.length > 0) {
          setCompanies(savedUser.companies);
        }

        // Set selected company ID: prefer saved, then user's primary companyId
        if (savedCompanyId) {
          setSelectedCompanyIdState(savedCompanyId);
        } else if (savedUser.companyId) {
          setSelectedCompanyIdState(savedUser.companyId);
        }

        // Try to fetch companies from API (will fail silently if offline)
        fetchUserCompanies(savedUser.id);
      }
    } catch (e) {
      console.error('Session load error:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUserCompanies(userId: string) {
    try {
      const userCompanies = await ApiService.getUserCompanies(userId);
      if (userCompanies && userCompanies.length > 0) {
        setCompanies(userCompanies);
        // Update user object with companies
        setUser((prev) => {
          if (!prev) return prev;
          return { ...prev, companies: userCompanies };
        });
        // If no selectedCompanyId yet, use primary company or first one
        if (!selectedCompanyId) {
          const primary = userCompanies.find((c) => c.isPrimary);
          const defaultId = primary?.companyId || userCompanies[0]?.companyId;
          if (defaultId) {
            setSelectedCompanyIdState(defaultId);
            StorageService.saveSelectedCompanyId(defaultId);
          }
        }
      }
    } catch (e) {
      // API failed — keep companies from user object if available
      console.warn('Failed to fetch user companies:', e);
    }
  }

  async function login(username: string, password: string) {
    const res = await ApiService.login(username, password);
    await StorageService.saveUser(res.user, res.token);
    setUser(res.user);
    setToken(res.token);
    // Fetch distributor phone on login
    fetchDistPhone(res.user.companyId);

    // Load companies from user object if available
    if (res.user.companies && res.user.companies.length > 0) {
      setCompanies(res.user.companies);
      // Set selected to primary company or first one
      const primary = res.user.companies.find((c) => c.isPrimary);
      const defaultId = primary?.companyId || res.user.companies[0]?.companyId || res.user.companyId || null;
      setSelectedCompanyIdState(defaultId);
      if (defaultId) {
        StorageService.saveSelectedCompanyId(defaultId);
      }
    } else {
      // No companies array — use user.companyId as before
      setSelectedCompanyIdState(res.user.companyId || null);
      if (res.user.companyId) {
        StorageService.saveSelectedCompanyId(res.user.companyId);
      }
    }

    // Also try to fetch companies from API
    fetchUserCompanies(res.user.id);
  }

  async function logout() {
    await StorageService.clearSession();
    await StorageService.saveSelectedCompanyId(null);
    setUser(null);
    setToken(null);
    setCompanies([]);
    setSelectedCompanyIdState(null);
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
    const currentToken = await StorageService.getToken();
    if (currentToken) {
      await StorageService.saveUser(updatedUser, currentToken);
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

  function setSelectedCompanyId(id: string | null) {
    setSelectedCompanyIdState(id);
    if (id) {
      StorageService.saveSelectedCompanyId(id);
    } else {
      StorageService.saveSelectedCompanyId(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser, updatePhone, distributorPhone, fetchDistributorPhone: fetchDistPhone, companies, selectedCompanyId, setSelectedCompanyId }}>
      {children}
    </AuthContext.Provider>
  );
}
