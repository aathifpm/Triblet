import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native'
import React, { useState } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Define interfaces based on schema
interface User {
  _id: string
  fullName: string
  email: string
  phone: string
  profilePic?: string
  age?: number
  preferredSports: string[]
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced'
  bio?: string
  friends: string[]
  badges: string[]
  createdAt: Date
}

interface Settings {
  notifications: {
    bookings: boolean
    payments: boolean
    reminders: boolean
    chat: boolean
    systemAlerts: boolean
  }
  privacy: {
    showProfile: boolean
    showSkillLevel: boolean
    showFriends: boolean
    allowFriendRequests: boolean
  }
  preferences: {
    darkMode: boolean
    language: string
    currency: string
    distanceUnit: 'km' | 'mi'
  }
}

// Mock data
const mockSettings: Settings = {
  notifications: {
    bookings: true,
    payments: true,
    reminders: true,
    chat: true,
    systemAlerts: true,
  },
  privacy: {
    showProfile: true,
    showSkillLevel: true,
    showFriends: true,
    allowFriendRequests: true,
  },
  preferences: {
    darkMode: true,
    language: 'English',
    currency: 'INR',
    distanceUnit: 'km',
  },
}

export default function Settings() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(mockSettings)

  const handleToggleSetting = (
    category: keyof Settings,
    setting: string,
    value: boolean
  ) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value,
      },
    }))
  }

  const handleLanguageChange = () => {
    Alert.alert('Select Language', 'Choose your preferred language', [
      { text: 'English', onPress: () => updatePreference('language', 'English') },
      { text: 'हिंदी', onPress: () => updatePreference('language', 'Hindi') },
      { text: 'தமிழ்', onPress: () => updatePreference('language', 'Tamil') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleCurrencyChange = () => {
    Alert.alert('Select Currency', 'Choose your preferred currency', [
      { text: 'INR (₹)', onPress: () => updatePreference('currency', 'INR') },
      { text: 'USD ($)', onPress: () => updatePreference('currency', 'USD') },
      { text: 'EUR (€)', onPress: () => updatePreference('currency', 'EUR') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const handleDistanceUnitChange = () => {
    Alert.alert('Select Distance Unit', 'Choose your preferred unit', [
      { text: 'Kilometers (km)', onPress: () => updatePreference('distanceUnit', 'km') },
      { text: 'Miles (mi)', onPress: () => updatePreference('distanceUnit', 'mi') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const updatePreference = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value,
      },
    }))
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Handle account deletion
            router.replace('/LoginScreen')
          },
        },
      ]
    )
  }

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear()
      router.replace('/LoginScreen')
    } catch (error) {
      Alert.alert('Error', 'Failed to logout. Please try again.')
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Settings</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="event" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Booking Updates</Text>
            </View>
            <Switch
              value={settings.notifications.bookings}
              onValueChange={(value) =>
                handleToggleSetting('notifications', 'bookings', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.notifications.bookings ? '#FF9F45' : '#666666'}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="payment" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Payment Alerts</Text>
            </View>
            <Switch
              value={settings.notifications.payments}
              onValueChange={(value) =>
                handleToggleSetting('notifications', 'payments', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.notifications.payments ? '#FF9F45' : '#666666'}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="alarm" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Game Reminders</Text>
            </View>
            <Switch
              value={settings.notifications.reminders}
              onValueChange={(value) =>
                handleToggleSetting('notifications', 'reminders', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.notifications.reminders ? '#FF9F45' : '#666666'}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="chat" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Chat Messages</Text>
            </View>
            <Switch
              value={settings.notifications.chat}
              onValueChange={(value) =>
                handleToggleSetting('notifications', 'chat', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.notifications.chat ? '#FF9F45' : '#666666'}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="info" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>System Alerts</Text>
            </View>
            <Switch
              value={settings.notifications.systemAlerts}
              onValueChange={(value) =>
                handleToggleSetting('notifications', 'systemAlerts', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.notifications.systemAlerts ? '#FF9F45' : '#666666'}
            />
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="visibility" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Show Profile</Text>
            </View>
            <Switch
              value={settings.privacy.showProfile}
              onValueChange={(value) =>
                handleToggleSetting('privacy', 'showProfile', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.privacy.showProfile ? '#FF9F45' : '#666666'}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="trending-up" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Show Skill Level</Text>
            </View>
            <Switch
              value={settings.privacy.showSkillLevel}
              onValueChange={(value) =>
                handleToggleSetting('privacy', 'showSkillLevel', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.privacy.showSkillLevel ? '#FF9F45' : '#666666'}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="people" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Show Friends List</Text>
            </View>
            <Switch
              value={settings.privacy.showFriends}
              onValueChange={(value) =>
                handleToggleSetting('privacy', 'showFriends', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.privacy.showFriends ? '#FF9F45' : '#666666'}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="person-add" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Allow Friend Requests</Text>
            </View>
            <Switch
              value={settings.privacy.allowFriendRequests}
              onValueChange={(value) =>
                handleToggleSetting('privacy', 'allowFriendRequests', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.privacy.allowFriendRequests ? '#FF9F45' : '#666666'}
            />
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="dark-mode" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Switch
              value={settings.preferences.darkMode}
              onValueChange={(value) =>
                handleToggleSetting('preferences', 'darkMode', value)
              }
              trackColor={{ false: '#333333', true: '#FF9F4580' }}
              thumbColor={settings.preferences.darkMode ? '#FF9F45' : '#666666'}
            />
          </View>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleLanguageChange}
          >
            <View style={styles.settingInfo}>
              <MaterialIcons name="language" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Language</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>
                {settings.preferences.language}
              </Text>
              <MaterialIcons name="chevron-right" size={24} color="#666666" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleCurrencyChange}
          >
            <View style={styles.settingInfo}>
              <MaterialIcons name="attach-money" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Currency</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>
                {settings.preferences.currency}
              </Text>
              <MaterialIcons name="chevron-right" size={24} color="#666666" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleDistanceUnitChange}
          >
            <View style={styles.settingInfo}>
              <MaterialIcons name="straighten" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Distance Unit</Text>
            </View>
            <View style={styles.settingValue}>
              <Text style={styles.settingValueText}>
                {settings.preferences.distanceUnit}
              </Text>
              <MaterialIcons name="chevron-right" size={24} color="#666666" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => router.push('/(profile)/profile')}
          >
            <View style={styles.settingInfo}>
              <MaterialIcons name="person" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Edit Profile</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#666666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Change Password', 'Feature coming soon!')}
          >
            <View style={styles.settingInfo}>
              <MaterialIcons name="lock" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Change Password</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#666666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingItem, styles.dangerItem]}
            onPress={handleDeleteAccount}
          >
            <View style={styles.settingInfo}>
              <MaterialIcons name="delete-forever" size={24} color="#FF453A" />
              <Text style={[styles.settingText, styles.dangerText]}>
                Delete Account
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#FF453A" />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Help Center', 'Feature coming soon!')}
          >
            <View style={styles.settingInfo}>
              <MaterialIcons name="help" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Help Center</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#666666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Terms of Service', 'Feature coming soon!')}
          >
            <View style={styles.settingInfo}>
              <MaterialIcons name="description" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Terms of Service</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#666666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('Privacy Policy', 'Feature coming soon!')}
          >
            <View style={styles.settingInfo}>
              <MaterialIcons name="privacy-tip" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#666666" />
          </TouchableOpacity>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="info" size={24} color="#FF9F45" />
              <Text style={styles.settingText}>Version</Text>
            </View>
            <Text style={styles.versionText}>1.0.0</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logoutGradient}
          >
            <View style={styles.logoutInner}>
              <MaterialIcons name="logout" size={24} color="#FF9F45" />
              <Text style={styles.logoutText}>Logout</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  titleUnderline: {
    height: 2,
    width: 80,
    borderRadius: 1,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    fontSize: 16,
    color: '#999999',
    marginRight: 8,
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#FF453A',
  },
  versionText: {
    fontSize: 16,
    color: '#999999',
  },
  logoutButton: {
    margin: 16,
    marginBottom: 32,
  },
  logoutGradient: {
    borderRadius: 24,
    padding: 1,
  },
  logoutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#000000',
    margin: 1,
    borderRadius: 23,
    padding: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9F45',
  },
}) 