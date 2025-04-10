import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import 'react-native-reanimated'
import { useColorScheme } from '@/hooks/useColorScheme'
import * as SecureStore from 'expo-secure-store'
import { AuthProvider } from './context/AuthContext'
import { auth } from './firebase/config'
import { onAuthStateChanged } from 'firebase/auth'

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [loaded] = useFonts({
    Montserrat: require('../assets/fonts/Montserrat-SemiBold.ttf'),
  })

  useEffect(() => {
    // Check for authentication with Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loaded && !isLoading) {
      SplashScreen.hideAsync()
    }
  }, [loaded, isLoading])

  if (!loaded || isLoading) {
    return null
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Stack initialRouteName={isAuthenticated ? '(tabs)' : 'LoginScreen'}>
          <Stack.Screen name='LoginScreen' options={{ headerShown: false }} />
          <Stack.Screen name='(tabs)' options={{ headerShown: false }} />
          <Stack.Screen name='SignupScreen' options={{ headerShown: false }} />
          <Stack.Screen name='GameDetailsScreen' options={{ headerShown: false }} />
          <Stack.Screen name='create-game' options={{ headerShown: false }} />
          <Stack.Screen name='(profile)' options={{ headerShown: false }} />
          <Stack.Screen name='(parties)' options={{ headerShown: false }} />
          <Stack.Screen name='(bookings)' options={{ headerShown: false }} />
          <Stack.Screen name='(tournament)' options={{ headerShown: false }} />
          <Stack.Screen name='(payments)' options={{ headerShown: false }} />
          <Stack.Screen name='(reviews)' options={{ headerShown: false }} />
          <Stack.Screen name='(notifications)' options={{ headerShown: false }} />
          <Stack.Screen name='(settings)' options={{ headerShown: false }} />
        </Stack>
        <StatusBar style='auto' />
      </AuthProvider>
    </ThemeProvider>
  )
}
