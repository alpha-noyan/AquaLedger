import { View, Text } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router'

const _layout = () => {
  return (
    <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="employees" options={{ title: 'Employees' }} />
        <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
        <Stack.Screen name="loans" options={{ title: 'Loans' }} />
        <Stack.Screen name="vehicles" options={{ title: 'Vehicles' }} />
        <Stack.Screen name="withdrawals" options={{ title: 'Withdrawals' }} />
    </Stack>
  )
}

export default _layout