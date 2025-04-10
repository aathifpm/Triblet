import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import React, { useState, useCallback } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { format } from 'date-fns'

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

// Define interfaces based on schema
interface User {
  _id: string
  fullName: string
  profilePic?: string
  skillLevel: string
}

interface Location {
  address: string
  latitude: number
  longitude: number
  virtualServer?: string
}

interface Team {
  teamId: string
  players: User[]
}

interface TournamentTeam {
  teamId: string
  players: string[]
}

interface Match {
  matchId: string
  team1: Team
  team2: Team
  time: Date
  venue: string
}

interface TournamentSchedule {
  matchId: string
  team1: string
  team2: string
  time: Date
  venue: string
}

interface LiveMatch {
  team1: TournamentTeam
  team2: TournamentTeam
  startTime: Date
  status: string
  result?: string
  delayMinutes: number
}

interface LiveSchedule {
  matches: LiveMatch[]
}

interface LeaderboardEntry {
  teamId: string
  teamName: string
  matchesPlayed: number
  wins: number
  losses: number
  draws: number
  points: number
}

interface Leaderboard {
  rankings: LeaderboardEntry[]
}

interface Tournament {
  _id: string
  createdBy: string
  createdByType?: CreatedByType
  name: string
  sport: string
  location: string
  entryFee: number
  prizePool: number
  matchFormat: MatchFormat
  teams: Team[]
  status: TournamentStatus
  schedule: Match[]
  createdAt: Date
  updatedAt?: Date
  teamCount?: number
  currentTeams?: number
  description?: string
  image?: string
  startDate?: Date
  endDate?: Date
  registrationDeadline?: Date
  rules?: string
  liveSchedule?: LiveSchedule
  leaderboard?: Leaderboard
  isPrivate?: boolean
  minTeamSize?: number
  maxTeamSize?: number
  ageRestriction?: number
  skillLevel?: string
  sponsors?: string[]
  streamingLink?: string
  contactEmail?: string
  contactPhone?: string
  tags?: string[]
}

// Add getStatusColor function
const getStatusColor = (status: TournamentStatus) => {
  switch (status) {
    case TournamentStatus.Upcoming:
      return '#FF9F45'
    case TournamentStatus.Ongoing:
      return '#4BB543'
    case TournamentStatus.Completed:
      return '#666666'
    default:
      return '#FFFFFF'
  }
}

// Mock data
const mockTournaments: Tournament[] = [
  {
    _id: '1',
    createdBy: 'turf1',
    createdByType: CreatedByType.GAMING_ARENA,
    name: 'Summer Cricket Championship 2024',
    sport: 'Cricket',
    location: 'Hiranandani Powai',
    entryFee: 5000,
    prizePool: 50000,
    matchFormat: MatchFormat.Knockout,
    teams: [],
    status: TournamentStatus.Upcoming,
    schedule: [],
    createdAt: new Date('2024-03-15'),
    startDate: new Date('2024-04-15'),
    endDate: new Date('2024-04-30'),
    registrationDeadline: new Date('2024-04-10'),
  },
  {
    _id: '2',
    createdBy: 'turf2',
    createdByType: CreatedByType.GAMING_ARENA,
    name: 'Mumbai Football League',
    sport: 'Football',
    location: 'Andheri Sports Complex',
    entryFee: 3000,
    prizePool: 30000,
    matchFormat: MatchFormat.League,
    teams: [],
    status: TournamentStatus.Upcoming,
    schedule: [],
    createdAt: new Date('2024-03-16'),
    startDate: new Date('2024-04-20'),
    endDate: new Date('2024-05-15'),
    registrationDeadline: new Date('2024-04-15'),
  },
  {
    _id: '3',
    createdBy: 'turf3',
    name: 'Basketball Tournament 2024',
    sport: 'Basketball',
    location: 'Matunga Gymkhana',
    entryFee: 2000,
    prizePool: 20000,
    matchFormat: MatchFormat.RoundRobin,
    teams: [],
    status: TournamentStatus.Ongoing,
    schedule: [],
    createdAt: new Date('2024-03-14'),
  },
]

export default function Tournament() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tournaments, setTournaments] = useState<Tournament[]>(mockTournaments)
  const [activeFilter, setActiveFilter] = useState<'All' | 'Upcoming' | 'Ongoing' | 'Completed'>('All')
  const [activeSport, setActiveSport] = useState<string>('All')

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false)
    }, 1000)
  }, [])

  const filteredTournaments = tournaments.filter(tournament => {
    if (activeFilter !== 'All' && tournament.status !== activeFilter) return false
    if (activeSport !== 'All' && tournament.sport !== activeSport) return false
    return true
  })

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
      default:
        return 'sports'
    }
  }

  const handleRegister = (tournamentId: string) => {
    // Handle tournament registration
    router.push({
      pathname: '/(tournament)/tournament-details',
      params: { id: tournamentId }
    })
  }

  const renderTournamentCard = (tournament: Tournament) => (
    <TouchableOpacity
      key={tournament._id}
      style={styles.cardContainer}
      onPress={() => router.push({
        pathname: '/(tournament)/tournament-details',
        params: { id: tournament._id }
      })}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#FF9F45', '#D494FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardGradient}
      >
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={styles.sportIconContainer}>
              <MaterialIcons name={getSportIcon(tournament.sport)} size={24} color="#FF9F45" />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.tournamentName}>{tournament.name}</Text>
              <Text style={styles.location}>{tournament.location}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tournament.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(tournament.status) }]}>
                {tournament.status}
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialIcons name="emoji-events" size={20} color="#FF9F45" />
                <Text style={styles.infoLabel}>Prize Pool</Text>
                <Text style={styles.infoValue}>₹{tournament.prizePool.toLocaleString()}</Text>
              </View>
              <View style={styles.infoItem}>
                <MaterialIcons name="group" size={20} color="#FF9F45" />
                <Text style={styles.infoLabel}>Teams</Text>
                <Text style={styles.infoValue}>{tournament.teams.length}</Text>
              </View>
              <View style={styles.infoItem}>
                <MaterialIcons name="sports" size={20} color="#FF9F45" />
                <Text style={styles.infoLabel}>Format</Text>
                <Text style={styles.infoValue}>{tournament.matchFormat}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => handleRegister(tournament._id)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.registerGradient}
              >
                <View style={styles.registerInner}>
                  <Text style={styles.registerText}>Register Now</Text>
                  <Text style={styles.entryFee}>₹{tournament.entryFee}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
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
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => router.push('/(tournament)/create-tournament')}
        >
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButtonGradient}
          >
            <MaterialIcons name="add" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Enhanced Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusFilters}
          contentContainerStyle={styles.statusFiltersContent}
        >
          {['All', 'Upcoming', 'Ongoing', 'Completed'].map(status => (
            <TouchableOpacity
              key={status}
              onPress={() => setActiveFilter(status as any)}
              style={[
                styles.filterButton,
                activeFilter === status && styles.activeFilterButton,
              ]}
            >
              <LinearGradient
                colors={activeFilter === status ? ['#FF9F45', '#D494FF'] : ['#1A1A1A', '#1A1A1A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.filterGradient}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === status && styles.activeFilterText,
                  ]}
                >
                  {status}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sportsFilter}
          contentContainerStyle={styles.sportsFilterContent}
        >
          {['All', 'Cricket', 'Football', 'Basketball', 'Tennis'].map(sport => (
            <TouchableOpacity
              key={sport}
              onPress={() => setActiveSport(sport)}
              style={[
                styles.sportButton,
                activeSport === sport && styles.activeSportButton,
              ]}
            >
              {sport !== 'All' && (
                <MaterialIcons
                  name={getSportIcon(sport)}
                  size={20}
                  color={activeSport === sport ? '#FF9F45' : '#666'}
                />
              )}
              <Text
                style={[
                  styles.sportButtonText,
                  activeSport === sport && styles.activeSportText,
                ]}
              >
                {sport}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tournament List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF9F45" />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF9F45" />
            <Text style={styles.loadingText}>Loading tournaments...</Text>
          </View>
        ) : filteredTournaments.length > 0 ? (
          <View style={styles.tournamentList}>
            {filteredTournaments.map(tournament => (
              <View key={tournament._id}>
                {renderTournamentCard(tournament)}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="emoji-events" size={64} color="#333" />
            <Text style={styles.emptyStateTitle}>No tournaments found</Text>
            <Text style={styles.emptyStateText}>
              Try adjusting your filters or check back later
            </Text>
            <TouchableOpacity
              style={styles.createTournamentButton}
              onPress={() => router.push('/(tournament)/create-tournament')}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.createTournamentGradient}
              >
                <View style={styles.createTournamentInner}>
                  <MaterialIcons name="add" size={20} color="#fff" />
                  <Text style={styles.createTournamentText}>Create Tournament</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  titleUnderline: {
    height: 2,
    width: 40,
    borderRadius: 1,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    paddingVertical: 16,
  },
  statusFilters: {
    marginBottom: 12,
  },
  statusFiltersContent: {
    paddingHorizontal: 16,
  },
  filterButton: {
    marginRight: 8,
    overflow: 'hidden',
    borderRadius: 20,
  },
  filterGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  filterText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  sportsFilter: {
    marginTop: 8,
  },
  sportsFilterContent: {
    paddingHorizontal: 16,
  },
  sportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#1A1A1A',
    gap: 6,
  },
  activeSportButton: {
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
  },
  sportButtonText: {
    color: '#666',
    fontSize: 14,
  },
  activeSportText: {
    color: '#FF9F45',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  tournamentList: {
    gap: 16,
  },
  cardContainer: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 1.5,
  },
  cardInner: {
    backgroundColor: '#000000',
    borderRadius: 23,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  sportIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#999999',
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
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  registerButton: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  registerGradient: {
    padding: 1.5,
  },
  registerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    padding: 14,
    paddingHorizontal: 20,
    borderRadius: 23,
  },
  registerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  entryFee: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9F45',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  createTournamentButton: {
    overflow: 'hidden',
    borderRadius: 24,
  },
  createTournamentGradient: {
    borderRadius: 24,
    padding: 1.5,
  },
  createTournamentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#000',
    borderRadius: 23,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  createTournamentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activeFilterButton: {
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
  },
}) 