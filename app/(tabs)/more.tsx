import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native'
import React, { useState, useEffect } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, Link } from 'expo-router'
import { useAuth } from '../../app/context/AuthContext'
import { getCurrentUserData } from '../../app/firebase/firestore'
import authService from '../../app/firebase/auth'

// Define types based on schema
interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  preferredGames?: string[];
  skillLevel?: string;
  badges?: string[];
  phone?: string;
}

export default function More() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser) {
        try {
          setLoading(true)
          const { user: userData, error } = await getCurrentUserData()
          
          if (error) {
            console.error('Error fetching user data:', error)
            Alert.alert('Error', 'Failed to load user data')
          } else if (userData) {
            setUser(userData as unknown as User)
          }
        } catch (error) {
          console.error('Error in fetchUserData:', error)
          Alert.alert('Error', 'Something went wrong while loading user data')
        } finally {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [currentUser])

  const menuItems = [
    {
      id: 1,
      title: 'My Profile',
      icon: 'person',
      route: '/(profile)/profile',
      description: 'View and edit your profile',
    },
    {
      id: 2,
      title: 'My Bookings',
      icon: 'calendar-today',
      route: '/(bookings)/bookings',
      description: 'Past and upcoming bookings',
    },
    {
      id: 3,
      title: 'My Parties',
      icon: 'groups',
      route: '/(parties)/parties',
      description: 'Your sports parties and events',
    },
    {
      id: 4,
      title: 'Tournaments',
      icon: 'emoji-events',
      route: '/(tournament)/tournaments',
      description: 'Ongoing and upcoming tournaments',
    },
    {
      id: 5,
      title: 'Payment History',
      icon: 'payment',
      route: '/(payments)/payments',
      description: 'View your transactions',
    },
    {
      id: 6,
      title: 'Reviews & Ratings',
      icon: 'star',
      route: '/(reviews)/reviews',
      description: 'Your reviews and ratings',
    },
    {
      id: 7,
      title: 'Notifications',
      icon: 'notifications',
      route: '/(notifications)/notifications',
      description: 'Manage your notifications',
    },
    {
      id: 8,
      title: 'Settings',
      icon: 'settings',
      route: '/(settings)/settings',
      description: 'App preferences and account settings',
    },
  ] as const

  const handleLogout = async () => {
    try {
      setLoading(true)
      const { success, error } = await authService.logoutUser()
      
      if (success) {
        router.replace('/LoginScreen')
      } else {
        console.error('Logout error:', error)
        Alert.alert('Logout Failed', error || 'Failed to log out. Please try again.')
      }
    } catch (error) {
      console.error('Error during logout:', error)
      Alert.alert('Error', 'Something went wrong during logout')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#FF9F45" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>More</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
      </View>

      {/* Profile Section */}
      <Link href="/(profile)/profile" asChild>
        <TouchableOpacity style={styles.profileSection}>
          <View style={styles.profilePicContainer}>
            {user?.image ? (
              <Image 
                source={{ uri: user.image }} 
                style={styles.profilePic}
              />
            ) : (
              <View style={styles.profilePicPlaceholder}>
                <MaterialIcons name="person" size={30} color="#666666" />
              </View>
            )}
            <View style={styles.badgeContainer}>
              <MaterialIcons name="verified" size={20} color="#FF9F45" />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'No email'}</Text>
            <View style={styles.skillLevelContainer}>
              <MaterialIcons name="trending-up" size={16} color="#FF9F45" />
              <Text style={styles.skillLevelText}>{user?.skillLevel || 'Beginner'}</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#666666" />
        </TouchableOpacity>
      </Link>

      {/* Menu Items */}
      <ScrollView style={styles.menuContainer}>
        {menuItems.map((item) => (
          <Link key={item.id} href={item.route} asChild>
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View style={styles.menuIconContainer}>
                  <MaterialIcons 
                    name={item.icon as keyof typeof MaterialIcons.glyphMap} 
                    size={24} 
                    color="#FF9F45" 
                  />
                </View>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemText}>{item.title}</Text>
                  <Text style={styles.menuItemDescription}>{item.description}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#666666" />
            </TouchableOpacity>
          </Link>
        ))}
      </ScrollView>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={loading}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  titleUnderline: {
    height: 2,
    width: 80,
    borderRadius: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1A1A1A',
    marginBottom: 24,
  },
  profilePicContainer: {
    position: 'relative',
  },
  profilePic: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profilePicPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#000000',
    borderRadius: 10,
    padding: 2,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  skillLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skillLevelText: {
    fontSize: 12,
    color: '#FF9F45',
  },
  menuContainer: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 12,
    color: '#666666',
  },
  logoutButton: {
    margin: 16,
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
}); 