import { View, Text } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router'

const _layout = () => {
  return (
    <Stack>
        <Stack.Screen name="index" options={{ headerTitle: 'Account' }} />
        <Stack.Screen name="cashin" options={{ headerTitle: 'Cash In' }} />
        <Stack.Screen name="cashout" options={{ headerTitle: 'Cash Out' }} />
        <Stack.Screen name="transactions" options={{ headerTitle: 'Transaction History' }} />
    </Stack>
  )
}

export default _layout