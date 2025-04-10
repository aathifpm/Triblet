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
import { format, parseISO } from 'date-fns'

// Define interfaces based on schema
interface User {
  _id: string
  fullName: string
  profilePic?: string
}

interface Booking {
  _id: string
  turfId: string
  bookingDate: string
  timeSlot: string
  amount: number
}

interface Tournament {
  _id: string
  name: string
  entryFee: number
}

interface Payment {
  _id: string
  userId: string
  bookingId?: string
  tournamentId?: string
  amount: number
  paymentMethod: 'UPI' | 'Card' | 'Wallet' | 'Net Banking'
  status: 'Success' | 'Pending' | 'Failed' | 'Refunded'
  transactionId: string
  createdAt: string
  // Populated fields
  booking?: Booking
  tournament?: Tournament
}

// Mock data
const mockPayments: Payment[] = [
  {
    _id: '1',
    userId: '1',
    bookingId: '1',
    amount: 1200,
    paymentMethod: 'UPI',
    status: 'Success',
    transactionId: 'TXN123456789',
    createdAt: '2024-03-15T10:30:00Z',
    booking: {
      _id: '1',
      turfId: '1',
      bookingDate: '2024-03-20T14:00:00Z',
      timeSlot: '2:00 PM - 3:00 PM',
      amount: 1200,
    },
  },
  {
    _id: '2',
    userId: '1',
    tournamentId: '1',
    amount: 5000,
    paymentMethod: 'Card',
    status: 'Success',
    transactionId: 'TXN987654321',
    createdAt: '2024-03-10T15:45:00Z',
    tournament: {
      _id: '1',
      name: 'Summer Cricket Championship',
      entryFee: 5000,
    },
  },
  {
    _id: '3',
    userId: '1',
    bookingId: '2',
    amount: 800,
    paymentMethod: 'Wallet',
    status: 'Refunded',
    transactionId: 'TXN456789123',
    createdAt: '2024-03-05T09:15:00Z',
    booking: {
      _id: '2',
      turfId: '2',
      bookingDate: '2024-03-08T16:00:00Z',
      timeSlot: '4:00 PM - 5:00 PM',
      amount: 800,
    },
  },
]

export default function Payments() {
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'success' | 'refunded'>('all')

  // Fetch payments data
  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = () => {
    setIsLoading(true)
    // Simulating API call
    setTimeout(() => {
      setPayments(mockPayments)
      setIsLoading(false)
    }, 1000)
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // Simulating API call
    setTimeout(() => {
      fetchPayments()
      setRefreshing(false)
    }, 1000)
  }, [])

  const filteredPayments = payments.filter(payment => {
    if (activeTab === 'success') {
      return payment.status === 'Success'
    } else if (activeTab === 'refunded') {
      return payment.status === 'Refunded'
    }
    return true
  })

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'Success':
        return '#4BB543'
      case 'Pending':
        return '#FFB74D'
      case 'Failed':
        return '#FF5252'
      case 'Refunded':
        return '#9E9E9E'
      default:
        return '#FFFFFF'
    }
  }

  const getPaymentMethodIcon = (method: Payment['paymentMethod']) => {
    switch (method) {
      case 'UPI':
        return 'account-balance'
      case 'Card':
        return 'credit-card'
      case 'Wallet':
        return 'account-balance-wallet'
      case 'Net Banking':
        return 'public'
      default:
        return 'payment'
    }
  }

  const renderPaymentItem = ({ item }: { item: Payment }) => {
    const paymentDate = parseISO(item.createdAt)
    const formattedDate = format(paymentDate, 'MMM d, yyyy')
    const formattedTime = format(paymentDate, 'h:mm a')

    return (
      <TouchableOpacity 
        style={styles.paymentCard}
        onPress={() => {
          // Navigate to payment details
          Alert.alert('Payment Details', `Transaction ID: ${item.transactionId}`)
        }}
        activeOpacity={0.8}
      >
        <View style={styles.paymentHeader}>
          <View style={styles.paymentType}>
            <MaterialIcons 
              name={getPaymentMethodIcon(item.paymentMethod)} 
              size={24} 
              color="#FF9F45" 
            />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentTitle}>
                {item.booking 
                  ? 'Turf Booking Payment'
                  : item.tournament
                    ? 'Tournament Registration'
                    : 'Payment'}
              </Text>
              <Text style={styles.paymentSubtitle}>
                {item.paymentMethod} • {item.transactionId}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.paymentDetails}>
          {item.booking && (
            <View style={styles.detailRow}>
              <MaterialIcons name="event" size={16} color="#FF9F45" />
              <Text style={styles.detailText}>
                Booking for {format(parseISO(item.booking.bookingDate), 'MMM d, yyyy')}
                {' • '}{item.booking.timeSlot}
              </Text>
            </View>
          )}

          {item.tournament && (
            <View style={styles.detailRow}>
              <MaterialIcons name="emoji-events" size={16} color="#FF9F45" />
              <Text style={styles.detailText}>
                {item.tournament.name}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <MaterialIcons name="schedule" size={16} color="#FF9F45" />
            <Text style={styles.detailText}>
              {formattedDate} at {formattedTime}
            </Text>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amount}>₹{item.amount.toLocaleString()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="receipt-long" size={64} color="#333333" />
      <Text style={styles.emptyTitle}>No Payments Found</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'success' 
          ? "You don't have any successful payments yet."
          : activeTab === 'refunded'
            ? "You don't have any refunded payments."
            : "You don't have any payment history yet."}
      </Text>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Payment History</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <View style={styles.placeholder} />
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
          style={[styles.tabButton, activeTab === 'success' && styles.activeTabButton]}
          onPress={() => setActiveTab('success')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'success' && styles.activeTabButtonText]}>
            Success
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'refunded' && styles.activeTabButton]}
          onPress={() => setActiveTab('refunded')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'refunded' && styles.activeTabButtonText]}>
            Refunded
          </Text>
        </TouchableOpacity>
      </View>

      {/* Payments List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9F45" />
          <Text style={styles.loadingText}>Loading payments...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPayments}
          renderItem={renderPaymentItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.paymentsList}
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
  placeholder: {
    width: 40,
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
  paymentsList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  paymentCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  paymentType: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentInfo: {
    marginLeft: 12,
    flex: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  paymentSubtitle: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  paymentDetails: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginLeft: 8,
    flex: 1,
  },
  amountContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#262626',
    borderRadius: 8,
  },
  amountLabel: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 4,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
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