// Finexa Orderbooker
import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/contexts/AuthContext';
import { ShopsProvider } from '@/contexts/ShopsContext';
import { LockProvider } from '@/contexts/LockContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LockOverlay } from '@/components/LockOverlay';
import { BismillahSplash } from '@/components/BismillahSplash';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [showBismillah, setShowBismillah] = useState(true);

  // IMPORTANT: Hide the native splash screen IMMEDIATELY so our custom
  // Bismillah splash is visible. The native splash covers the React view,
  // so if we wait to hide it, the user never sees Bismillah properly.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleBismillahFinish = () => {
    setShowBismillah(false);
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <ShopsProvider>
              <LockProvider>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="(tabs)" />
                </Stack>
                <LockOverlay />
              </LockProvider>
            </ShopsProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>

      {/* Bismillah Splash Overlay - shows for 3 seconds on top of everything */}
      {showBismillah ? (
        <BismillahSplash onFinish={handleBismillahFinish} />
      ) : null}
    </SafeAreaProvider>
  );
}
