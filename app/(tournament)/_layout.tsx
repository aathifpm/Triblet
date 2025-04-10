import { Stack } from 'expo-router'
import React from 'react'

export default function TournamentLayout() {
  return (
    <Stack>
      <Stack.Screen name="tournament" options={{ headerShown: false }} />
      <Stack.Screen name="tournaments" options={{ headerShown: false }} />
      <Stack.Screen name="tournament-details" options={{ headerShown: false }} />
      <Stack.Screen name="create-tournament" options={{ headerShown: false }} />
      <Stack.Screen name="team-details" options={{ headerShown: false }} />
      <Stack.Screen name="football-match" options={{ headerShown: false }} />
    </Stack>
  )
}
