import { Stack } from 'expo-router'
import React from 'react'

export default function ReviewsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="reviews" />
    </Stack>
  )
} 