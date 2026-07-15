import { View, Text } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router'

const _layout = () => {
  return (
    <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="production" options={{ title: 'Production' }} />
        <Stack.Screen name="raw-items" options={{ title: 'Raw Items' }} />
        <Stack.Screen name="ready-items" options={{ title: 'Ready Items' }} />
    </Stack>
  )
}

export default _layout