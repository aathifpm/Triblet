import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { format, isPast, isFuture, parseISO } from 'date-fns'
import { useAuth } from '../../app/context/AuthContext'
import { getUserBookings, cancelBooking } from '../../app/firebase/firestore'

// Define types based on schema
interface User {
  id: string;
  name: string;
  email: string;
}

interface Turf {
  id: string;
  name: string;
  location: {
    address: string;
  };
  images: string[];
  sportsAvailable: string[];
}

interface Party {
  id: string;
  sport: string;
  eventType: string;
  players: string[];
}

interface SplitPaymentMember {
  userId: string;
  amountPaid: number;
}

interface Booking {
  id: string;
  userId: string;
  turfId: string;
  partyId?: string;
  bookingDate: string;
  timeSlot: string;
  paymentStatus: 'Pending' | 'Paid' | 'Refunded';
  amount: number;
  splitPayment: {
    isEnabled: boolean;
    members: SplitPaymentMember[];
  };
  createdAt: string;
  updatedAt: string;
  // Populated fields
  turf?: Turf;
  party?: Party;
}

export default function Bookings() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming')

  // Fetch bookings data from Firestore
  useEffect(() => {
    if (currentUser) {
      fetchBookings()
    } else {
      // If not authenticated, redirect to login
      router.replace('/LoginScreen')
    }
  }, [currentUser])

  const fetchBookings = async () => {
    setIsLoading(true)
    try {
      const { bookings: userBookings, error } = await getUserBookings()
      
      if (error) {
        console.error('Error fetching bookings:', error)
        Alert.alert('Error', 'Failed to load bookings. Please try again.')
      } else {
        setBookings(userBookings as Booking[])
      }
    } catch (err) {
      console.error('Exception fetching bookings:', err)
      Alert.alert('Error', 'Something went wrong while loading your bookings')
    } finally {
      setIsLoading(false)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchBookings()
    } catch (err) {
      console.error('Error refreshing bookings:', err)
    } finally {
      setRefreshing(false)
    }
  }, [])

  const filteredBookings = bookings.filter(booking => {
    const bookingDate = parseISO(booking.bookingDate);
    const today = new Date();
    
    if (activeTab === 'upcoming') {
      return isFuture(bookingDate) || bookingDate.toDateString() === today.toDateString();
    } else if (activeTab === 'past') {
      return isPast(bookingDate) && bookingDate.toDateString() !== today.toDateString();
    }
    return true;
  })

  const handleCancelBooking = async (bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? Cancellation policy may apply.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true)
            try {
              const { success, error } = await cancelBooking(bookingId)
              
              if (success) {
                // Update local state to reflect cancellation
                const updatedBookings = bookings.map(booking => 
                  booking.id === bookingId 
                    ? { ...booking, paymentStatus: 'Refunded' as const } 
                    : booking
                )
                setBookings(updatedBookings)
                Alert.alert('Success', 'Booking cancelled successfully. Refund initiated.')
              } else {
                console.error('Failed to cancel booking:', error)
                Alert.alert('Error', error || 'Failed to cancel booking. Please try again.')
              }
            } catch (err) {
              console.error('Exception cancelling booking:', err)
              Alert.alert('Error', 'Something went wrong while cancelling your booking')
            } finally {
              setIsLoading(false)
            }
          },
        },
      ]
    )
  }

  const handleViewBookingDetails = (bookingId: string) => {
    // Navigate to booking details page
    // You can implement this when you create the booking details screen
    Alert.alert('View Details', `Viewing details for booking ${bookingId}`)
  }

  const renderBookingItem = ({ item }: { item: Booking }) => {
    const bookingDate = parseISO(item.bookingDate);
    const isPastBooking = isPast(bookingDate) && bookingDate.toDateString() !== new Date().toDateString();
    const formattedDate = format(bookingDate, 'EEE, MMM d, yyyy');
    
    return (
      <TouchableOpacity 
        style={styles.bookingCard}
        onPress={() => handleViewBookingDetails(item.id)}
        activeOpacity={0.8}
      >
        {/* Turf Image */}
        <View style={styles.bookingImageContainer}>
          {item.turf?.images && item.turf.images.length > 0 ? (
            <Image 
              source={{ uri: item.turf.images[0] }} 
              style={styles.bookingImage}
            />
          ) : (
            <View style={styles.bookingImagePlaceholder}>
              <MaterialIcons name="sports-cricket" size={30} color="#666666" />
            </View>
          )}
          <View style={[
            styles.statusBadge, 
            item.paymentStatus === 'Paid' ? styles.paidBadge : 
            item.paymentStatus === 'Pending' ? styles.pendingBadge : 
            styles.refundedBadge
          ]}>
            <Text style={styles.statusBadgeText}>{item.paymentStatus}</Text>
          </View>
        </View>
        
        {/* Booking Details */}
        <View style={styles.bookingDetails}>
          <Text style={styles.turfName}>{item.turf?.name || 'Unknown Turf'}</Text>
          <Text style={styles.turfLocation}>{item.turf?.location?.address || 'Unknown Location'}</Text>
          
          <View style={styles.bookingInfoRow}>
            <MaterialIcons name="event" size={16} color="#FF9F45" />
            <Text style={styles.bookingInfoText}>{formattedDate}</Text>
          </View>
          
          <View style={styles.bookingInfoRow}>
            <MaterialIcons name="access-time" size={16} color="#FF9F45" />
            <Text style={styles.bookingInfoText}>{item.timeSlot}</Text>
          </View>
          
          {item.party && (
            <View style={styles.bookingInfoRow}>
              <MaterialIcons name="groups" size={16} color="#FF9F45" />
              <Text style={styles.bookingInfoText}>
                {item.party.eventType} {item.party.sport} Party ({item.party.players?.length || 0} players)
              </Text>
            </View>
          )}
          
          <View style={styles.bookingInfoRow}>
            <MaterialIcons name="payments" size={16} color="#FF9F45" />
            <Text style={styles.bookingInfoText}>
              ₹{item.amount} {item.splitPayment?.isEnabled && '(Split Payment)'}
            </Text>
          </View>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.bookingActions}>
          {!isPastBooking && item.paymentStatus !== 'Refunded' && (
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => handleCancelBooking(item.id)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
          
          {isPastBooking && item.paymentStatus === 'Paid' && (
            <TouchableOpacity 
              style={styles.reviewButton}
              onPress={() => Alert.alert('Review', `Add review for ${item.turf?.name}`)}
            >
              <Text style={styles.reviewButtonText}>Review</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.detailsButton}
            onPress={() => handleViewBookingDetails(item.id)}
          >
            <Text style={styles.detailsButtonText}>Details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="event-busy" size={64} color="#333333" />
      <Text style={styles.emptyTitle}>No Bookings Found</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'upcoming' 
          ? "You don't have any upcoming bookings." 
          : activeTab === 'past' 
            ? "You don't have any past bookings." 
            : "You haven't made any bookings yet."}
      </Text>
      <TouchableOpacity 
        style={styles.bookNowButton}
        onPress={() => router.push('/(tabs)/book')}
      >
        <LinearGradient
          colors={['#FF9F45', '#D494FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bookNowGradient}
        >
          <Text style={styles.bookNowText}>Book Now</Text>
        </LinearGradient>
      </TouchableOpacity>
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
          <Text style={styles.headerTitle}>My Bookings</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => Alert.alert('Filter', 'Filter options will be implemented in a future update.')}
        >
          <MaterialIcons name="filter-list" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'upcoming' && styles.activeTabButton]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'upcoming' && styles.activeTabButtonText]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'past' && styles.activeTabButton]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'past' && styles.activeTabButtonText]}>
            Past
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'all' && styles.activeTabButton]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'all' && styles.activeTabButtonText]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bookings List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9F45" />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.bookingsList}
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
  filterButton: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  bookingsList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  bookingCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  bookingImageContainer: {
    position: 'relative',
    height: 150,
  },
  bookingImage: {
    width: '100%',
    height: '100%',
  },
  bookingImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  paidBadge: {
    backgroundColor: 'rgba(75, 181, 67, 0.8)',
  },
  pendingBadge: {
    backgroundColor: 'rgba(255, 159, 69, 0.8)',
  },
  refundedBadge: {
    backgroundColor: 'rgba(255, 69, 58, 0.8)',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bookingDetails: {
    padding: 16,
  },
  turfName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  turfLocation: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 12,
  },
  bookingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingInfoText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginLeft: 8,
  },
  bookingActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    padding: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '500',
  },
  reviewButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 159, 69, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  reviewButtonText: {
    color: '#FF9F45',
    fontSize: 14,
    fontWeight: '500',
  },
  detailsButton: {
    flex: 1,
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
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
  bookNowButton: {
    width: '60%',
  },
  bookNowGradient: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bookNowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 