// app/_layout.js - This is the root layout with bottom tabs
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../styles/colors';
import { useEffect, useState } from 'react';
import { initDatabase } from '../database';
import { ActivityIndicator, View, Text } from 'react-native';
import { GlobalProvider } from './globalContext';

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const setupDatabase = async () => {
      try {
        await initDatabase();
        setDbReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    setupDatabase();
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.aquaWhite }}>
        <ActivityIndicator size="large" color={colors.lightAqua} />
        <Text style={{ marginTop: 16, color: colors.darkGrey }}>Loading AquaLedger...</Text>
      </View>
    );
  }

  return (
    <GlobalProvider>
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.aquaWhite} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.lightAqua,
          tabBarInactiveTintColor: colors.textLight,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.border,
            elevation: 8,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          headerStyle: {
            backgroundColor: colors.aquaWhite,
          },
          headerTintColor: colors.darkGrey,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>🏠</Text>,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>👤</Text>,
          }}
        />
        <Tabs.Screen
          name="stock"
          options={{
            title: 'Stock',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📦</Text>,
          }}
        />
        <Tabs.Screen
          name="sales"
          options={{
            title: 'Sales',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>💰</Text>,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Orders',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📋</Text>,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>⚙️</Text>,
          }}
        />
      </Tabs>
    </SafeAreaProvider>
    </GlobalProvider>
  );
}