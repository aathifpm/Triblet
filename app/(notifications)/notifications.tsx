import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { format, formatDistanceToNow, parseISO } from 'date-fns'

// Define interfaces based on schema
interface Notification {
  _id: string
  userId: string
  type: 'Booking' | 'Payment' | 'Reminder' | 'System Alert'
  message: string
  isRead: boolean
  createdAt: string
}

// Mock data
const mockNotifications: Notification[] = [
  {
    _id: '1',
    userId: '1',
    type: 'Booking',
    message: 'Your booking for Green Field Arena on March 20, 2024 at 2:00 PM has been confirmed.',
    isRead: false,
    createdAt: '2024-03-15T10:30:00Z',
  },
  {
    _id: '2',
    userId: '1',
    type: 'Payment',
    message: 'Payment of ₹1,200 for turf booking has been successfully processed.',
    isRead: false,
    createdAt: '2024-03-15T10:31:00Z',
  },
  {
    _id: '3',
    userId: '1',
    type: 'Reminder',
    message: 'Your cricket match at Sports Arena starts in 2 hours. Get ready!',
    isRead: true,
    createdAt: '2024-03-14T15:45:00Z',
  },
  {
    _id: '4',
    userId: '1',
    type: 'System Alert',
    message: 'Welcome to Triblet! Complete your profile to get personalized recommendations.',
    isRead: true,
    createdAt: '2024-03-13T09:15:00Z',
  },
]

export default function Notifications() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')

  // Fetch notifications data
  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = () => {
    setIsLoading(true)
    // Simulating API call
    setTimeout(() => {
      setNotifications(mockNotifications)
      setIsLoading(false)
    }, 1000)
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // Simulating API call
    setTimeout(() => {
      fetchNotifications()
      setRefreshing(false)
    }, 1000)
  }, [])

  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === 'unread') {
      return !notification.isRead
    }
    return true
  })

  const markAsRead = (notificationId: string) => {
    setNotifications(prevNotifications =>
      prevNotifications.map(notification =>
        notification._id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    )
  }

  const markAllAsRead = () => {
    setNotifications(prevNotifications =>
      prevNotifications.map(notification => ({
        ...notification,
        isRead: true,
      }))
    )
  }

  const deleteNotification = (notificationId: string) => {
    setNotifications(prevNotifications =>
      prevNotifications.filter(notification => notification._id !== notificationId)
    )
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'Booking':
        return 'event'
      case 'Payment':
        return 'payment'
      case 'Reminder':
        return 'alarm'
      case 'System Alert':
        return 'info'
      default:
        return 'notifications'
    }
  }

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'Booking':
        return '#4BB543'
      case 'Payment':
        return '#FF9F45'
      case 'Reminder':
        return '#FFB74D'
      case 'System Alert':
        return '#2196F3'
      default:
        return '#FFFFFF'
    }
  }

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const notificationDate = parseISO(item.createdAt)
    const timeAgo = formatDistanceToNow(notificationDate, { addSuffix: true })

    return (
      <TouchableOpacity 
        style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
        onPress={() => {
          markAsRead(item._id)
          // Handle notification action based on type
          switch (item.type) {
            case 'Booking':
              router.push('/(bookings)/bookings')
              break
            case 'Payment':
              router.push('/(payments)/payments')
              break
            case 'Reminder':
              // Navigate to relevant screen
              break
            case 'System Alert':
              // Handle system alert action
              break
          }
        }}
        activeOpacity={0.8}
      >
        <View style={styles.notificationContent}>
          <View style={[
            styles.iconContainer,
            { backgroundColor: `${getNotificationColor(item.type)}20` }
          ]}>
            <MaterialIcons 
              name={getNotificationIcon(item.type)} 
              size={24} 
              color={getNotificationColor(item.type)} 
            />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationType}>{item.type}</Text>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notificationMessage}>{item.message}</Text>
            <Text style={styles.notificationTime}>{timeAgo}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert(
              'Delete Notification',
              'Are you sure you want to delete this notification?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteNotification(item._id),
                },
              ]
            )
          }}
        >
          <MaterialIcons name="delete-outline" size={20} color="#FF453A" />
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="notifications-none" size={64} color="#333333" />
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'unread' 
          ? "You don't have any unread notifications."
          : "You don't have any notifications yet."}
      </Text>
    </View>
  )

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity 
            style={styles.markAllReadButton}
            onPress={() => {
              Alert.alert(
                'Mark All as Read',
                'Are you sure you want to mark all notifications as read?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Mark All',
                    onPress: markAllAsRead,
                  },
                ]
              )
            }}
          >
            <MaterialIcons name="done-all" size={24} color="#FF9F45" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'all' && styles.activeTabButton]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'all' && styles.activeTabButtonText]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'unread' && styles.activeTabButton]}
          onPress={() => setActiveTab('unread')}
        >
          <View style={styles.tabButtonContent}>
            <Text style={[styles.tabButtonText, activeTab === 'unread' && styles.activeTabButtonText]}>
              Unread
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9F45" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.notificationsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF9F45"
              colors={["#FF9F45"]}
            />
          }
        />
      )}
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
  markAllReadButton: {
    padding: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF9F45',
  },
  tabButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  activeTabButtonText: {
    color: '#FF9F45',
    fontWeight: 'bold',
  },
  tabButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: '#FF9F45',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  notificationsList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  notificationCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadCard: {
    backgroundColor: '#262626',
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9F45',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666666',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
}) 