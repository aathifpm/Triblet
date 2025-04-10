import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
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
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced'
}

interface Turf {
  _id: string
  name: string
  location: {
    address: string
  }
  images: string[]
  ratings: {
    totalReviews: number
    averageRating: number
  }
}

interface Tournament {
  _id: string
  name: string
  sport: string
  status: 'Upcoming' | 'Ongoing' | 'Completed'
}

interface Review {
  _id: string
  userId: string
  targetId: string
  rating: number
  comment: string
  createdAt: string
  // Populated fields
  user?: User
  turf?: Turf
  tournament?: Tournament
  targetType: 'Turf' | 'Tournament' | 'User'
}

// Mock data
const mockReviews: Review[] = [
  {
    _id: '1',
    userId: '1',
    targetId: '1',
    rating: 4.5,
    comment: 'Great turf with excellent facilities. The grass quality is amazing and the staff is very helpful.',
    createdAt: '2024-03-15T10:30:00Z',
    targetType: 'Turf',
    turf: {
      _id: '1',
      name: 'Green Field Arena',
      location: {
        address: '123 Sports Avenue, Mumbai',
      },
      images: ['https://example.com/turf1.jpg'],
      ratings: {
        totalReviews: 45,
        averageRating: 4.3,
      },
    },
  },
  {
    _id: '2',
    userId: '1',
    targetId: '1',
    rating: 5,
    comment: 'Well organized tournament with great competition. Looking forward to participating again!',
    createdAt: '2024-03-10T15:45:00Z',
    targetType: 'Tournament',
    tournament: {
      _id: '1',
      name: 'Summer Cricket Championship',
      sport: 'Cricket',
      status: 'Completed',
    },
  },
  {
    _id: '3',
    userId: '1',
    targetId: '2',
    rating: 3.5,
    comment: 'Good player but needs to improve communication during team games.',
    createdAt: '2024-03-05T09:15:00Z',
    targetType: 'User',
    user: {
      _id: '2',
      fullName: 'Jane Smith',
      profilePic: 'https://example.com/jane.jpg',
      skillLevel: 'Intermediate',
    },
  },
]

export default function Reviews() {
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'turfs' | 'tournaments' | 'players'>('all')

  // Fetch reviews data
  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = () => {
    setIsLoading(true)
    // Simulating API call
    setTimeout(() => {
      setReviews(mockReviews)
      setIsLoading(false)
    }, 1000)
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // Simulating API call
    setTimeout(() => {
      fetchReviews()
      setRefreshing(false)
    }, 1000)
  }, [])

  const filteredReviews = reviews.filter(review => {
    if (activeTab === 'turfs') {
      return review.targetType === 'Turf'
    } else if (activeTab === 'tournaments') {
      return review.targetType === 'Tournament'
    } else if (activeTab === 'players') {
      return review.targetType === 'User'
    }
    return true
  })

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    return (
      <View style={styles.starsContainer}>
        {[...Array(5)].map((_, index) => {
          if (index < fullStars) {
            return (
              <MaterialIcons
                key={index}
                name="star"
                size={16}
                color="#FFD700"
                style={styles.star}
              />
            )
          } else if (index === fullStars && hasHalfStar) {
            return (
              <MaterialIcons
                key={index}
                name="star-half"
                size={16}
                color="#FFD700"
                style={styles.star}
              />
            )
          } else {
            return (
              <MaterialIcons
                key={index}
                name="star-outline"
                size={16}
                color="#FFD700"
                style={styles.star}
              />
            )
          }
        })}
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      </View>
    )
  }

  const renderReviewItem = ({ item }: { item: Review }) => {
    const reviewDate = parseISO(item.createdAt)
    const formattedDate = format(reviewDate, 'MMM d, yyyy')

    return (
      <View style={styles.reviewCard}>
        {/* Review Header */}
        <View style={styles.reviewHeader}>
          {item.targetType === 'Turf' && item.turf && (
            <View style={styles.targetInfo}>
              <View style={styles.imageContainer}>
                {item.turf.images && item.turf.images.length > 0 ? (
                  <Image 
                    source={{ uri: item.turf.images[0] }} 
                    style={styles.targetImage}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialIcons name="sports-cricket" size={24} color="#666666" />
                  </View>
                )}
              </View>
              <View style={styles.targetDetails}>
                <Text style={styles.targetName}>{item.turf.name}</Text>
                <Text style={styles.targetSubtitle}>{item.turf.location.address}</Text>
                <View style={styles.targetStats}>
                  <MaterialIcons name="star" size={14} color="#FFD700" />
                  <Text style={styles.statsText}>
                    {item.turf.ratings.averageRating.toFixed(1)} ({item.turf.ratings.totalReviews} reviews)
                  </Text>
                </View>
              </View>
            </View>
          )}

          {item.targetType === 'Tournament' && item.tournament && (
            <View style={styles.targetInfo}>
              <View style={[styles.imageContainer, styles.tournamentIcon]}>
                <MaterialIcons name="emoji-events" size={24} color="#FF9F45" />
              </View>
              <View style={styles.targetDetails}>
                <Text style={styles.targetName}>{item.tournament.name}</Text>
                <Text style={styles.targetSubtitle}>{item.tournament.sport}</Text>
                <View style={[
                  styles.statusBadge,
                  item.tournament.status === 'Completed' ? styles.completedBadge :
                  item.tournament.status === 'Ongoing' ? styles.ongoingBadge :
                  styles.upcomingBadge
                ]}>
                  <Text style={styles.statusText}>{item.tournament.status}</Text>
                </View>
              </View>
            </View>
          )}

          {item.targetType === 'User' && item.user && (
            <View style={styles.targetInfo}>
              <View style={styles.imageContainer}>
                {item.user.profilePic ? (
                  <Image 
                    source={{ uri: item.user.profilePic }} 
                    style={[styles.targetImage, styles.userImage]}
                  />
                ) : (
                  <View style={[styles.imagePlaceholder, styles.userImagePlaceholder]}>
                    <MaterialIcons name="person" size={24} color="#666666" />
                  </View>
                )}
              </View>
              <View style={styles.targetDetails}>
                <Text style={styles.targetName}>{item.user.fullName}</Text>
                <Text style={styles.targetSubtitle}>{item.user.skillLevel}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Review Content */}
        <View style={styles.reviewContent}>
          {renderStars(item.rating)}
          <Text style={styles.reviewText}>{item.comment}</Text>
          <Text style={styles.reviewDate}>{formattedDate}</Text>
        </View>

        {/* Review Actions */}
        <View style={styles.reviewActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              // Edit review
              Alert.alert('Edit Review', 'Edit your review for this item')
            }}
          >
            <MaterialIcons name="edit" size={16} color="#FF9F45" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              // Delete review
              Alert.alert(
                'Delete Review',
                'Are you sure you want to delete this review?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      // Handle delete
                      Alert.alert('Success', 'Review deleted successfully')
                    },
                  },
                ]
              )
            }}
          >
            <MaterialIcons name="delete-outline" size={16} color="#FF453A" />
            <Text style={[styles.actionButtonText, styles.deleteText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="rate-review" size={64} color="#333333" />
      <Text style={styles.emptyTitle}>No Reviews Found</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'turfs' 
          ? "You haven't reviewed any turfs yet."
          : activeTab === 'tournaments'
            ? "You haven't reviewed any tournaments yet."
            : activeTab === 'players'
              ? "You haven't reviewed any players yet."
              : "You haven't written any reviews yet."}
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
          <Text style={styles.headerTitle}>Reviews & Ratings</Text>
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
          style={[styles.tabButton, activeTab === 'turfs' && styles.activeTabButton]}
          onPress={() => setActiveTab('turfs')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'turfs' && styles.activeTabButtonText]}>
            Turfs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tournaments' && styles.activeTabButton]}
          onPress={() => setActiveTab('tournaments')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'tournaments' && styles.activeTabButtonText]}>
            Tournaments
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'players' && styles.activeTabButton]}
          onPress={() => setActiveTab('players')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'players' && styles.activeTabButtonText]}>
            Players
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reviews List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9F45" />
          <Text style={styles.loadingText}>Loading reviews...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          renderItem={renderReviewItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.reviewsList}
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
    fontSize: 14,
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
  reviewsList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  reviewCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  reviewHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  targetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#262626',
  },
  targetImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userImage: {
    borderRadius: 30,
  },
  userImagePlaceholder: {
    borderRadius: 30,
  },
  tournamentIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetDetails: {
    marginLeft: 12,
    flex: 1,
  },
  targetName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  targetSubtitle: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 4,
  },
  targetStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 12,
    color: '#CCCCCC',
    marginLeft: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  completedBadge: {
    backgroundColor: 'rgba(102, 102, 102, 0.2)',
  },
  ongoingBadge: {
    backgroundColor: 'rgba(75, 181, 67, 0.2)',
  },
  upcomingBadge: {
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  reviewContent: {
    padding: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  star: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#FFD700',
    marginLeft: 4,
  },
  reviewText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#666666',
  },
  reviewActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    padding: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#FF9F45',
    marginLeft: 4,
  },
  deleteText: {
    color: '#FF453A',
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