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
import { getFirestore, collection, query, getDocs, orderBy, where, Timestamp } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'

// Define enums based on schema
enum CreatedByType {
  USER = 'USER',
  GAMING_ARENA = 'GAMING_ARENA'
}

enum MatchFormat {
  Knockout = 'Knockout',
  League = 'League',
  RoundRobin = 'RoundRobin'
}

enum TournamentStatus {
  Upcoming = 'Upcoming',
  Ongoing = 'Ongoing',
  Completed = 'Completed'
}

// Define types based on schema
interface User {
  id: string;
  name: string;
  profilePic?: string;
  skillLevel: string;
}

interface Location {
  address: string;
  latitude: number;
  longitude: number;
  virtualServer?: string;
}

interface Turf {
  id: string;
  name: string;
  location: Location;
  images: string[];
}

interface Team {
  id: string;
  name: string;
  players: string[];
  playerDetails?: User[];
}

interface TournamentTeam {
  teamId: string;
  players: string[];
}

interface Match {
  matchId: string;
  team1: string;
  team2: string;
  time: Date | Timestamp;
  venue: string;
  team1Details?: Team;
  team2Details?: Team;
  venueDetails?: Turf;
}

interface LiveMatch {
  team1: TournamentTeam;
  team2: TournamentTeam;
  startTime: Date;
  status: string;
  result?: string;
  delayMinutes: number;
}

interface LiveSchedule {
  matches: LiveMatch[];
}

interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
}

interface Leaderboard {
  rankings: LeaderboardEntry[];
}

interface Tournament {
  id: string;
  createdById: string;
  createdByType: CreatedByType;
  name: string;
  game: string;
  location: string;
  entryFee: number;
  prizePool: number;
  matchFormat: MatchFormat;
  status: TournamentStatus;
  schedule?: Match[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  teamCount: number;
  currentTeams: number;
  description?: string;
  image?: string;
  startDate?: Date | Timestamp;
  endDate?: Date | Timestamp;
  registrationDeadline?: Date | Timestamp;
  rules?: string;
  liveSchedule?: LiveSchedule;
  leaderboard?: Leaderboard;
  isPrivate?: boolean;
  minTeamSize?: number;
  maxTeamSize?: number;
  ageRestriction?: number;
  skillLevel?: string;
  sponsors?: string[];
  streamingLink?: string;
  contactEmail?: string;
  contactPhone?: string;
  tags?: string[];
}

// Helper function to get status color
const getStatusColor = (status: TournamentStatus) => {
  switch (status) {
    case TournamentStatus.Upcoming:
      return {
        background: 'rgba(255, 159, 69, 0.2)',
        text: '#FF9F45',
      }
    case TournamentStatus.Ongoing:
      return {
        background: 'rgba(75, 181, 67, 0.2)',
        text: '#4BB543',
      }
    case TournamentStatus.Completed:
      return {
        background: 'rgba(160, 160, 160, 0.2)',
        text: '#A0A0A0',
      }
    default:
      return {
        background: 'rgba(255, 159, 69, 0.2)',
        text: '#FF9F45',
      }
  }
}

// Helper function to get sport icon
const getSportIcon = (sport: string) => {
  switch (sport.toLowerCase()) {
    case 'cricket':
      return 'sports-cricket'
    case 'football':
      return 'sports-soccer'
    case 'basketball':
      return 'sports-basketball'
    case 'tennis':
      return 'sports-tennis'
    case 'volleyball':
      return 'sports-volleyball'
    case 'badminton':
      return 'sports-tennis' // Using tennis as fallback
    default:
      return 'sports'
  }
}

export default function Tournaments() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all')

  useEffect(() => {
    fetchTournaments()
  }, [])

  const fetchTournaments = async () => {
    setLoading(true)
    try {
      const db = getFirestore()
      const tournamentsRef = collection(db, 'tournaments')
      
      // Create query based on filter
      let tournamentsQuery = query(tournamentsRef)
      
      if (filter !== 'all') {
        tournamentsQuery = query(
          tournamentsRef,
          where('status', '==', filter.charAt(0).toUpperCase() + filter.slice(1))
        )
      }
      
      // Add ordering
      tournamentsQuery = query(
        tournamentsQuery,
        orderBy('createdAt', 'desc')
      )
      
      const querySnapshot = await getDocs(tournamentsQuery)
      const tournamentsData: Tournament[] = []
      
      querySnapshot.forEach(doc => {
        const data = doc.data()
        
        // Convert Firestore Timestamp to Date if needed
        const createdAt = data.createdAt instanceof Timestamp 
          ? new Date(data.createdAt.seconds * 1000) 
          : data.createdAt || new Date()
          
        const updatedAt = data.updatedAt instanceof Timestamp 
          ? new Date(data.updatedAt.seconds * 1000) 
          : data.updatedAt || new Date()
          
        const scheduleWithDates = data.schedule ? data.schedule.map((match: any) => ({
          ...match,
          time: match.time instanceof Timestamp ? 
            new Date(match.time.seconds * 1000) : 
            match.time
        })) : []
        
        tournamentsData.push({
          id: doc.id,
          ...data,
          createdAt,
          updatedAt,
          schedule: scheduleWithDates,
          // Set defaults for missing fields
          teamCount: data.teamCount || 8,
          currentTeams: data.currentTeams || 0,
          matchFormat: data.matchFormat || 'Knockout',
          status: data.status || 'Upcoming',
          game: data.game || data.sport || 'Unknown',
          createdById: data.createdById || '',
          createdByType: data.createdByType || 'USER',
          name: data.name || 'Unknown Tournament',
          location: data.location || 'Unknown Location',
          entryFee: data.entryFee || 0,
          prizePool: data.prizePool || 0
        })
      })
      
      setTournaments(tournamentsData)
    } catch (error) {
      console.error('Error fetching tournaments:', error)
      Alert.alert('Error', 'Failed to load tournaments. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetchTournaments()
    } catch (error) {
      console.error('Error refreshing tournaments:', error)
    } finally {
      setRefreshing(false)
    }
  }, [filter])

  const handleFilterChange = (newFilter: 'all' | 'upcoming' | 'ongoing' | 'completed') => {
    setFilter(newFilter)
    setTournaments([]) // Clear current tournaments
    setTimeout(() => {
      fetchTournaments() // Fetch with new filter
    }, 0)
  }

  const handleCreateTournament = () => {
    router.push('/(tournament)/create-tournament')
  }

  const handleTournamentPress = (tournamentId: string) => {
    router.push({
      pathname: '/(tournament)/tournament-details',
      params: { id: tournamentId }
    })
  }

  const handleRegisterTeam = (tournamentId: string) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to register for this tournament')
      return
    }
    
    router.push({
      pathname: '/(tournament)/create-team',
      params: { tournamentId }
    })
  }

  const handleViewSchedule = (tournamentId: string) => {
    router.push({
      pathname: '/(tournament)/tournament-details',
      params: { id: tournamentId, tab: 'schedule' }
    })
  }

  const handleViewTeams = (tournamentId: string) => {
    router.push({
      pathname: '/(tournament)/tournament-details',
      params: { id: tournamentId, tab: 'teams' }
    })
  }

  const renderTournamentItem = ({ item }: { item: Tournament }) => {
    const statusColors = getStatusColor(item.status)
    
    return (
      <TouchableOpacity 
        style={styles.tournamentCard}
        onPress={() => handleTournamentPress(item.id)}
      >
        <View style={styles.tournamentHeader}>
          <View style={styles.tournamentTitleContainer}>
              <Text style={styles.tournamentName}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.background }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>{item.status}</Text>
            </View>
          </View>
          
          <View style={styles.tournamentMeta}>
            <View style={styles.metaItem}>
              <MaterialIcons name={getSportIcon(item.game)} size={16} color="#FF9F45" />
              <Text style={styles.metaText}>{item.game}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="location-on" size={16} color="#FF9F45" />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tournamentDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Entry Fee</Text>
            <Text style={styles.detailValue}>₹{item.entryFee.toLocaleString()}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Prize Pool</Text>
            <Text style={styles.detailValue}>₹{item.prizePool.toLocaleString()}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Teams</Text>
            <Text style={styles.detailValue}>{item.currentTeams}/{item.teamCount}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Format</Text>
            <Text style={styles.detailValue}>{item.matchFormat}</Text>
          </View>
        </View>

        <View style={styles.tournamentActions}>
          {item.status === 'Upcoming' && (
            <TouchableOpacity 
              style={styles.registerButton}
              onPress={() => handleRegisterTeam(item.id)}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.registerGradient}
              >
                <Text style={styles.registerText}>Register Team</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {item.status === 'Ongoing' && (
          <TouchableOpacity 
              style={styles.viewButton}
              onPress={() => handleViewSchedule(item.id)}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.viewGradient}
              >
                <Text style={styles.viewText}>View Schedule</Text>
              </LinearGradient>
          </TouchableOpacity>
          )}
          
          {item.status === 'Completed' && (
          <TouchableOpacity 
              style={styles.viewButton}
              onPress={() => handleViewTeams(item.id)}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.viewGradient}
              >
                <Text style={styles.viewText}>View Results</Text>
              </LinearGradient>
          </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="emoji-events" size={64} color="#666" />
      <Text style={styles.emptyTitle}>No Tournaments Found</Text>
      <Text style={styles.emptyText}>
        {filter === 'all'
          ? 'There are no tournaments available at the moment.'
          : `There are no ${filter} tournaments available.`}
      </Text>
      <TouchableOpacity 
        style={styles.createEmptyButton}
        onPress={handleCreateTournament}
      >
        <LinearGradient
          colors={['#FF9F45', '#D494FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.createEmptyGradient}
        >
          <Text style={styles.createEmptyText}>Create Tournament</Text>
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
          <Text style={styles.headerTitle}>Tournaments</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <TouchableOpacity onPress={handleCreateTournament} style={styles.createButton}>
          <MaterialIcons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
            onPress={() => handleFilterChange('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All</Text>
          </TouchableOpacity>
        <TouchableOpacity
            style={[styles.filterButton, filter === 'upcoming' && styles.activeFilter]}
            onPress={() => handleFilterChange('upcoming')}
        >
            <Text style={[styles.filterText, filter === 'upcoming' && styles.activeFilterText]}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.filterButton, filter === 'ongoing' && styles.activeFilter]}
            onPress={() => handleFilterChange('ongoing')}
        >
            <Text style={[styles.filterText, filter === 'ongoing' && styles.activeFilterText]}>Ongoing</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.filterButton, filter === 'completed' && styles.activeFilter]}
            onPress={() => handleFilterChange('completed')}
        >
            <Text style={[styles.filterText, filter === 'completed' && styles.activeFilterText]}>Completed</Text>
        </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Tournament List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9F45" />
          <Text style={styles.loadingText}>Loading tournaments...</Text>
        </View>
      ) : (
        <FlatList
          data={tournaments}
          renderItem={renderTournamentItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF9F45"
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
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
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF9F45',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filtersContent: {
    paddingVertical: 8,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
  },
  activeFilter: {
    backgroundColor: '#FF9F45',
  },
  filterText: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  activeFilterText: {
    color: '#000000',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  tournamentCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tournamentHeader: {
    marginBottom: 16,
  },
  tournamentTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tournamentMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  tournamentDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  detailItem: {
    width: '50%',
    marginBottom: 12,
  },
  detailLabel: {
    color: '#999999',
    fontSize: 12,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tournamentActions: {
    alignItems: 'center',
  },
  registerButton: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  registerGradient: {
    padding: 12,
    alignItems: 'center',
  },
  registerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewButton: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  viewGradient: {
    padding: 12,
    alignItems: 'center',
  },
  viewText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
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
  },
  createEmptyButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  createEmptyGradient: {
    padding: 12,
    paddingHorizontal: 24,
  },
  createEmptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}) 