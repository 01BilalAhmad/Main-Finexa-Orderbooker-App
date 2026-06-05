// Powered by Finexa
import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/contexts/AuthContext';
import { ShopsProvider } from '@/contexts/ShopsContext';
import { LockProvider } from '@/contexts/LockContext';
import { LockOverlay } from '@/components/LockOverlay';
import { BismillahSplash } from '@/components/BismillahSplash';

// CRASH-SAFE: Lazy load RouteTrackingProvider so that if it fails,
// the rest of the app still works. We wrap it in an error boundary.
import { Component, ReactNode } from 'react';

class SafeRouteTrackingWrapper extends Component<
  { children: ReactNode },
  { hasError: boolean; Provider: any }
> {
  state = { hasError: false, Provider: null as any };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[SafeRouteTracking] ErrorBoundary caught:', error, info);
  }

  componentDidMount() {
    // Lazy import RouteTrackingProvider AFTER app is already rendered
    // This prevents any crash from blocking the entire app startup
    import('@/contexts/RouteTrackingContext').then((mod) => {
      this.setState({ Provider: mod.RouteTrackingProvider });
    }).catch((e) => {
      console.error('[SafeRouteTracking] Failed to load RouteTrackingProvider:', e);
      // App works fine without route tracking
      this.setState({ hasError: true });
    });
  }

  render() {
    if (this.state.hasError || !this.state.Provider) {
      // Route tracking failed to load — render children without it
      return this.props.children;
    }
    const { Provider } = this.state;
    return <Provider>{this.props.children}</Provider>;
  }
}

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
      <AuthProvider>
        <ShopsProvider>
          <SafeRouteTrackingWrapper>
            <LockProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
              </Stack>
              <LockOverlay />
            </LockProvider>
          </SafeRouteTrackingWrapper>
        </ShopsProvider>
      </AuthProvider>

      {/* Bismillah Splash Overlay - shows for 3 seconds on top of everything */}
      {showBismillah ? (
        <BismillahSplash onFinish={handleBismillahFinish} />
      ) : null}
    </SafeAreaProvider>
  );
}
