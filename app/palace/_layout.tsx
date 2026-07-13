import { View, Text } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router'
import { GlobalContextProvider } from './globalcontext/globalcontext'

const _layout = () => {
  return (
    <GlobalContextProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ headerShown: false }} />
        <Stack.Screen name="stock" options={{ headerShown: false }} />
        <Stack.Screen name="orders" options={{ headerShown: false }} />
        <Stack.Screen name="sellings" options={{ headerShown: false }} />
        <Stack.Screen name="loans" options={{ headerShown: false }} />
        <Stack.Screen name="wasooli" options={{ headerShown: false }} />
        <Stack.Screen name="withdrawals" options={{ headerShown: false }} />
        <Stack.Screen name="other-expenses" options={{ headerShown: false }} />
        <Stack.Screen name="vehicles" options={{ headerShown: false }} />
        <Stack.Screen name="employees" options={{ headerShown: false }} />
    </Stack>
    </GlobalContextProvider>
  )
}

export default _layout