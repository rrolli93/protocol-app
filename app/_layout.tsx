import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, Tabs, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import * as Notifications from 'expo-notifications';
import { wagmiConfig } from '../lib/wagmi';
import { useAuth } from '../hooks/useAuth';
import { theme } from '../constants/theme';
import { requestPermissions, registerForPushNotifications } from '../lib/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

// Auth guard — redirects unauthenticated users to /(auth)/login
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

// Tab navigator component
function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 28,
          paddingTop: 10,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.ui,
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.medium,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon="🏠" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon="🧭" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => (
            <CreateTabIcon active={color === theme.colors.accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon="👤" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

interface TabIconProps {
  icon: string;
  color: string;
  size: number;
}

function TabIcon({ icon, color, size }: TabIconProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ opacity: color === theme.colors.accent ? 1 : 0.6 }}>
        <View style={{ fontSize: size } as any}>
          {/* Emoji icon rendered as Text */}
        </View>
      </View>
      {/* Use Text for emoji rendering */}
      <View>
        {React.createElement(require('react-native').Text, {
          style: { fontSize: size - 4, color: color },
        }, icon)}
      </View>
    </View>
  );
}

function CreateTabIcon({ active }: { active: boolean }) {
  const { Text, View } = require('react-native');
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: active ? theme.colors.accent : theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: active ? theme.colors.accent : theme.colors.border,
        marginBottom: 4,
        ...(active ? theme.shadows.accent : {}),
      }}
    >
      <Text
        style={{
          fontSize: 22,
          color: '#FFFFFF',
          lineHeight: 26,
          fontWeight: '300',
        }}
      >
        +
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const [fontsLoaded] = useFonts({
    Inter: require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    JetBrainsMono: require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    'JetBrainsMono-Bold': require('../assets/fonts/JetBrainsMono-Bold.ttf'),
  });

  // ── Push notifications setup ─────────────────────────────────────────────
  useEffect(() => {
    // Request permissions and register token on app start
    (async () => {
      try {
        const status = await requestPermissions();
        if (status === 'granted') {
          await registerForPushNotifications();
        }
      } catch (err) {
        console.warn('[RootLayout] Notification setup error:', err);
      }
    })();

    // Foreground notification listener (optional — handler in lib/notifications.ts takes care of display)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[RootLayout] Notification received:', notification.request.content.title);
      },
    );

    // Response listener: user tapped a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        // Navigate to the relevant challenge screen if a challengeId is provided
        if (data?.challengeId && typeof data.challengeId === 'string') {
          router.push(`/challenge/${data.challengeId}` as any);
        } else {
          // Default: go to home tab
          router.push('/(tabs)/' as any);
        }
      },
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="light" backgroundColor={theme.colors.background} />
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen
                name="challenge/[id]"
                options={{
                  headerShown: false,
                  presentation: 'card',
                  animation: 'slide_from_right',
                }}
              />
            </Stack>
          </AuthGuard>
        </SafeAreaProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
