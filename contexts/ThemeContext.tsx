import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { Colors as LightColors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { DarkColors } from '@/constants/darkTheme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
  colors: typeof LightColors;
  spacing: typeof Spacing;
  radius: typeof Radius;
  fontSize: typeof FontSize;
  fontWeight: typeof FontWeight;
  shadow: typeof Shadow;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? { ...LightColors, ...DarkColors } : LightColors;

  // Persist theme preference
  useEffect(() => {
    // Can add AsyncStorage persistence later
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, isDark, colors, spacing: Spacing, radius: Radius, fontSize: FontSize, fontWeight: FontWeight, shadow: Shadow }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
