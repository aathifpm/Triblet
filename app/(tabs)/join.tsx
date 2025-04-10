import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialIcons } from '@expo/vector-icons'
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit, 
  Timestamp, 
  addDoc,
  serverTimestamp
} from 'firebase/firestore'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../context/AuthContext'

// Define interfaces
interface User {
  id: string
  name: string
  profilePic?: string
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced'
}

interface Party {
  id: string
  leaderId: string
  sport: string
  eventType: 'Casual' | 'Tournament' | 'Training'
  date: Date | string | Timestamp
  time: string
  maxPlayers: number
  requiredSkillLevel: 'Beginner' | 'Intermediate' | 'Advanced'
  players: string[]
  isPrivate: boolean
  leader?: User
  playerDetails?: User[]
  location?: string
  image?: string
}

interface Tournament {
  id: string
  name: string
  sport: string
  location: string
  entryFee: number
  prizePool: number
  matchFormat: 'Knockout' | 'League' | 'RoundRobin'
  status: 'Upcoming' | 'Ongoing' | 'Completed'
  teamCount: number
  currentTeams: number
  image?: string
  createdById?: string
  createdByType?: 'USER' | 'GAMING_ARENA'
  schedule?: TournamentSchedule[]
}

interface TournamentSchedule {
  matchId: string
  team1: string
  team2: string
  time: Date
  venue: string
}

export default function Join() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'games' | 'tournaments'>('games')
  const [parties, setParties] = useState<Party[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [isLoadingParties, setIsLoadingParties] = useState(true)
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch data on component mount
  useEffect(() => {
    fetchParties()
    fetchTournaments()
  }, [])

  // Function to fetch parties from Firestore
  const fetchParties = async () => {
    setIsLoadingParties(true)
    try {
      const db = getFirestore()
      const partiesRef = collection(db, 'parties')
      
      // Modified query to avoid composite index requirement
      // Option 1: Remove the orderBy clause (fastest solution)
      const partiesQuery = query(
        partiesRef,
        where('isPrivate', '==', false),
        limit(10)
      )
      
      // Option 2: If you need ordering, you should create the index
      // by visiting the URL in the error message:
      // https://console.firebase.google.com/v1/r/project/triblet-f8227/firestore/indexes?create_composite=Ck1wcm9qZWN0cy90cmlibGV0LWY4MjI3L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wYXJ0aWVzL2luZGV4ZXMvXxABGg0KCWlzUHJpdmF0ZRABGggKBGRhdGUQARoMCghfX25hbWVfXxAB
      
      /* Enable this query after creating the index in Firebase console:
      const partiesQuery = query(
        partiesRef,
        where('isPrivate', '==', false),
        orderBy('date', 'asc'),
        limit(10)
      );
      */
      
      const querySnapshot = await getDocs(partiesQuery)
      const partiesData: Party[] = []
      
      for (const doc of querySnapshot.docs) {
        const data = doc.data() as Party
        
        // Process date
        const date = data.date instanceof Date 
          ? data.date 
          : typeof data.date === 'string' 
            ? parseISO(data.date) 
            : new Date((data.date as any).seconds * 1000)
            
        // Fetch leader and player details
        let leaderData: User | undefined
        let playerDetailsData: User[] = []
        
        if (data.leaderId) {
          // For simplicity, creating a placeholder leader
          leaderData = {
            id: data.leaderId,
            name: "Party Leader",
            skillLevel: "Intermediate"
          }
        }
        
        if (data.players && data.players.length > 0) {
          // For simplicity, creating placeholder player details
          playerDetailsData = data.players.map((playerId, index) => ({
            id: playerId,
            name: `Player ${index + 1}`,
            skillLevel: "Intermediate" as const
          }))
        }
        
        partiesData.push({
          ...data,
          id: doc.id,
          date,
          leader: leaderData,
          playerDetails: playerDetailsData
        })
      }
      
      setParties(partiesData)
    } catch (error) {
      console.error('Error fetching parties:', error)
      Alert.alert('Error', 'Failed to load games. Please try again.')
    } finally {
      setIsLoadingParties(false)
    }
  }
  
  // Function to fetch tournaments from Firestore
  const fetchTournaments = async () => {
    setIsLoadingTournaments(true)
    try {
      const db = getFirestore()
      const tournamentsRef = collection(db, 'tournaments')
      const tournamentsQuery = query(
        tournamentsRef,
        orderBy('status', 'desc'),
        limit(10)
      )
      
      const querySnapshot = await getDocs(tournamentsQuery)
      const tournamentsData: Tournament[] = []
      
      querySnapshot.forEach(doc => {
        const data = doc.data()
        
        // Convert Firestore Timestamp to Date if needed
        const scheduleWithDates = data.schedule ? data.schedule.map((match: any) => ({
          ...match,
          time: match.time instanceof Timestamp ? 
            new Date(match.time.seconds * 1000) : 
            match.time
        })) : []
        
        tournamentsData.push({
          ...data,
          id: doc.id,
          currentTeams: data.currentTeams || 0,
          teamCount: data.teamCount || 8,
          schedule: scheduleWithDates,
          // Map from schema fields to our interface
          matchFormat: data.matchFormat || 'Knockout',
          status: data.status || 'Upcoming',
          sport: data.game || data.sport || 'Unknown',
          location: data.location || 'Unknown location',
          name: data.name || 'Unknown Tournament',
          entryFee: data.entryFee || 0,
          prizePool: data.prizePool || 0
        })
      })
      
      setTournaments(tournamentsData)
    } catch (error) {
      console.error('Error fetching tournaments:', error)
      Alert.alert('Error', 'Failed to load tournaments. Please try again.')
    } finally {
      setIsLoadingTournaments(false)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      if (activeTab === 'games') {
        await fetchParties()
      } else {
        await fetchTournaments()
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setRefreshing(false)
    }
  }, [activeTab])

  const handleGamePress = (partyId: string) => {
    // Navigate to game details screen
    router.push({
      pathname: '/GameDetailsScreen',
      params: { id: partyId }
    })
  }

  const handleCreateGame = () => {
    router.push('/create-game')
  }

  const handleTournamentPress = (tournamentId: string) => {
    // Navigate to tournament details screen
    router.push({
      pathname: '/(tournament)/tournament-details',
      params: { id: tournamentId }
    })
  }

  const handleCreateTournament = () => {
    router.push('/(tournament)/create-tournament')
  }

  const handleJoinTournament = async (tournamentId: string) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to join this tournament')
      return
    }
    
    try {
      // Here you would implement the logic to join a tournament
      // This might involve creating a team entry or adding the user to an existing team
      Alert.alert('Success', 'Tournament registration initiated. Please complete payment to confirm your spot.')
      
      // Navigate to payment screen or tournament details
      router.push({
        pathname: '/(tournament)/tournament-details',
        params: { id: tournamentId, action: 'join' }
      })
    } catch (error) {
      console.error('Error joining tournament:', error)
      Alert.alert('Error', 'Failed to join tournament. Please try again.')
    }
  }

  const renderLoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF9F45" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  )

  const renderEmptyParties = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="sports" size={48} color="#666" />
      <Text style={styles.emptyText}>No games available</Text>
    </View>
  )

  const renderEmptyTournaments = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="emoji-events" size={48} color="#666" />
      <Text style={styles.emptyText}>No tournaments available</Text>
    </View>
  )

  const renderPartyCards = () => {
    if (isLoadingParties) {
      return renderLoadingIndicator()
    }

    if (parties.length === 0) {
      return renderEmptyParties()
    }

    return (
      <View style={styles.gameCards}>
        {parties.map(party => {
          const partyDate = party.date instanceof Date ? party.date : new Date(party.date as any);
          const formattedDate = format(partyDate, 'EEE d MMM');
          
          return (
            <TouchableOpacity 
              key={party.id}
              style={styles.gameCard}
              onPress={() => handleGamePress(party.id)}
            >
              <ImageBackground
                source={party.image ? { uri: party.image } : require('@/assets/images/turf-cricket.png')}
                style={styles.gameImage}
                imageStyle={styles.gameImageStyle}
              >
                <View style={styles.gameContent}>
                  <View style={styles.topRow}>
                    <View style={styles.playerCount}>
                      <View style={styles.avatarStack}>
                        {party.playerDetails?.slice(0, 3).map((player, i) => (
                          <View
                            key={player.id}
                            style={[styles.avatar, { marginLeft: i > 0 ? -10 : 0 }]}
                          />
                        ))}
                      </View>
                      <Text style={styles.playerText}>{party.players?.length || 0}/{party.maxPlayers} Are In</Text>
                    </View>
                    <View style={styles.dateTime}>
                      <MaterialIcons name="event" size={16} color="#fff" />
                      <Text style={styles.dateTimeText}>{formattedDate}</Text>
                      <MaterialIcons name="access-time" size={16} color="#fff" />
                      <Text style={styles.dateTimeText}>{party.time}</Text>
                    </View>
                  </View>

                  <View style={styles.bottomRow}>
                    <View style={styles.locationInfo}>
                      <MaterialIcons name="location-on" size={16} color="#FF9F45" />
                      <Text style={styles.locationText}>{party.location || 'Location not specified'}</Text>
                      <MaterialIcons name="trending-up" size={16} color="#FF9F45" />
                      <Text style={styles.levelText}>{party.requiredSkillLevel} level</Text>
                    </View>
                    <View style={styles.sportInfo}>
                      <Text style={styles.sportText}>{party.sport}</Text>
                      <Text style={styles.distanceText}>20 kms away</Text>
                      <TouchableOpacity 
                        style={styles.detailsButton}
                        onPress={() => handleGamePress(party.id)}
                      >
                        <LinearGradient
                          colors={['#FF9F45', '#D494FF']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.detailsGradient}
                        >
                          <Text style={styles.detailsText}>Details</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderTournamentCards = () => {
    if (isLoadingTournaments) {
      return renderLoadingIndicator()
    }

    if (tournaments.length === 0) {
      return renderEmptyTournaments()
    }

    return (
      <View style={styles.tournamentCards}>
        {tournaments.map(tournament => (
          <TouchableOpacity 
            key={tournament.id}
            style={styles.tournamentCard}
            onPress={() => handleTournamentPress(tournament.id)}
          >
            <ImageBackground
              source={tournament.image ? { uri: tournament.image } : require('@/assets/images/turf-cricket.png')}
              style={styles.tournamentImage}
              imageStyle={styles.tournamentImageStyle}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']}
                style={styles.tournamentGradient}
              >
                <View style={styles.tournamentBadge}>
                  <MaterialIcons name="emoji-events" size={14} color="#000" />
                  <Text style={styles.tournamentBadgeText}>Tournament</Text>
                </View>
                
                <View style={styles.tournamentContent}>
                  <View style={styles.tournamentHeader}>
                    <Text style={styles.tournamentName}>{tournament.name}</Text>
                    <View style={[
                      styles.tournamentStatus, 
                      tournament.status === 'Ongoing' ? styles.ongoingStatus : 
                      tournament.status === 'Completed' ? styles.completedStatus : styles.upcomingStatus
                    ]}>
                      <Text style={[
                        styles.tournamentStatusText, 
                        tournament.status === 'Ongoing' ? styles.ongoingStatusText : 
                        tournament.status === 'Completed' ? styles.completedStatusText : styles.upcomingStatusText
                      ]}>{tournament.status}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.tournamentDetails}>
                    <View style={styles.tournamentInfo}>
                      <MaterialIcons name={getSportIcon(tournament.sport)} size={16} color="#FF9F45" />
                      <Text style={styles.tournamentInfoText}>{tournament.sport}</Text>
                    </View>
                    <View style={styles.tournamentInfo}>
                      <MaterialIcons name="location-on" size={16} color="#FF9F45" />
                      <Text style={styles.tournamentInfoText}>{tournament.location}</Text>
                    </View>
                    <View style={styles.tournamentInfo}>
                      <MaterialIcons name="groups" size={16} color="#FF9F45" />
                      <Text style={styles.tournamentInfoText}>{tournament.currentTeams}/{tournament.teamCount} Teams</Text>
                    </View>
                    {tournament.matchFormat && (
                      <View style={styles.tournamentInfo}>
                        <MaterialIcons name="format-list-numbered" size={16} color="#FF9F45" />
                        <Text style={styles.tournamentInfoText}>Format: {tournament.matchFormat}</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.tournamentFooter}>
                    <View style={styles.prizePool}>
                      <Text style={styles.prizePoolLabel}>Prize Pool</Text>
                      <Text style={styles.prizePoolAmount}>₹{tournament.prizePool.toLocaleString()}</Text>
                    </View>
                    <View style={styles.entryFee}>
                      <Text style={styles.entryFeeLabel}>Entry Fee</Text>
                      <Text style={styles.entryFeeAmount}>₹{tournament.entryFee.toLocaleString()}</Text>
                    </View>
                    {tournament.status === 'Upcoming' ? (
                      <TouchableOpacity 
                        style={styles.joinButton}
                        onPress={() => handleJoinTournament(tournament.id)}
                      >
                        <LinearGradient
                          colors={['#FF9F45', '#D494FF']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.joinButtonGradient}
                        >
                          <Text style={styles.joinButtonText}>Join</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.viewButton}
                        onPress={() => handleTournamentPress(tournament.id)}
                      >
                        <LinearGradient
                          colors={['#FF9F45', '#D494FF']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.viewButtonGradient}
                        >
                          <Text style={styles.viewButtonText}>View</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Join {activeTab}</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconButton}>
            <MaterialIcons name="chat" size={24} color="#FF9F45" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <View style={styles.profilePic} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'games' && styles.activeTab]} 
          onPress={() => setActiveTab('games')}
        >
          <Text style={[styles.tabText, activeTab === 'games' && styles.activeTabText]}>Games</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'tournaments' && styles.activeTab]} 
          onPress={() => setActiveTab('tournaments')}
        >
          <Text style={[styles.tabText, activeTab === 'tournaments' && styles.activeTabText]}>Tournaments</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF9F45"
          />
        }
      >
        {activeTab === 'games' ? (
          <>
            {/* Action Buttons for Games */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.createGameButton}
                onPress={handleCreateGame}
              >
                <LinearGradient
                  colors={['#FF9F45', '#D494FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createGameGradient}
                >
                  <Text style={styles.createGameText}>CREATE GAME</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterButton}>
                <LinearGradient
                  colors={['#FF9F45', '#D494FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.filterGradient}
                >
                  <Text style={styles.filterText}>Sort By</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterButton}>
                <LinearGradient
                  colors={['#FF9F45', '#D494FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.filterGradient}
                >
                  <Text style={styles.filterText}>Filter</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Game Cards */}
            {renderPartyCards()}
          </>
        ) : (
          <>
            {/* Action Buttons for Tournaments */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.createGameButton}
                onPress={handleCreateTournament}
              >
                <LinearGradient
                  colors={['#FF9F45', '#D494FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.createGameGradient}
                >
                  <Text style={styles.createGameText}>CREATE TOURNAMENT</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.filterButton}>
                <LinearGradient
                  colors={['#FF9F45', '#D494FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.filterGradient}
                >
                  <Text style={styles.filterText}>Filter</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Tournament Cards */}
            {renderTournamentCards()}
          </>
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
    color: '#fff',
    marginBottom: 4,
  },
  titleUnderline: {
    height: 2,
    width: 80,
    borderRadius: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF9F45',
  },
  tabText: {
    fontSize: 16,
    color: '#999',
  },
  activeTabText: {
    color: '#FF9F45',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  createGameButton: {
    flex: 2,
  },
  createGameGradient: {
    borderRadius: 24,
    padding: 1,
  },
  createGameText: {
    color: '#FF9F45',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#000',
    margin: 1,
    padding: 12,
    borderRadius: 23,
  },
  filterButton: {
    flex: 1,
  },
  filterGradient: {
    borderRadius: 24,
    padding: 1,
  },
  filterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: '#000',
    margin: 1,
    padding: 12,
    borderRadius: 23,
  },
  gameCards: {
    gap: 16,
  },
  gameCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  gameImage: {
    width: '100%',
    height: 200,
  },
  gameImageStyle: {
    borderRadius: 16,
  },
  gameContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF9F45',
    borderWidth: 2,
    borderColor: '#000',
  },
  playerText: {
    color: '#fff',
    fontSize: 12,
  },
  dateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateTimeText: {
    color: '#fff',
    fontSize: 12,
  },
  bottomRow: {
    gap: 8,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
  },
  levelText: {
    color: '#fff',
    fontSize: 14,
  },
  sportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sportText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  distanceText: {
    color: '#666',
    fontSize: 14,
  },
  detailsButton: {
    alignSelf: 'flex-start',
  },
  detailsGradient: {
    borderRadius: 16,
    padding: 1,
  },
  detailsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: '#000',
    margin: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  // Tournament styles
  tournamentCards: {
    gap: 20,
  },
  tournamentCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 5,
  },
  tournamentImage: {
    width: '100%',
    height: 220,
  },
  tournamentImageStyle: {
    borderRadius: 16,
  },
  tournamentGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  tournamentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9F45',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  tournamentBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tournamentContent: {
    gap: 12,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tournamentName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  tournamentStatus: {
    backgroundColor: '#FF9F4520',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tournamentStatusText: {
    color: '#FF9F45',
    fontSize: 12,
    fontWeight: '600',
  },
  upcomingStatus: {
    backgroundColor: '#FF9F4520',
  },
  upcomingStatusText: {
    color: '#FF9F45',
  },
  ongoingStatus: {
    backgroundColor: '#4BB54320',
  },
  ongoingStatusText: {
    color: '#4BB543',
  },
  completedStatus: {
    backgroundColor: '#A0A0A020',
  },
  completedStatusText: {
    color: '#A0A0A0',
  },
  tournamentDetails: {
    gap: 8,
  },
  tournamentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tournamentInfoText: {
    color: '#fff',
    fontSize: 14,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  prizePool: {
    flex: 1,
  },
  prizePoolLabel: {
    color: '#999',
    fontSize: 12,
  },
  prizePoolAmount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  entryFee: {
    flex: 1,
  },
  entryFeeLabel: {
    color: '#999',
    fontSize: 12,
  },
  entryFeeAmount: {
    color: '#FF9F45',
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  viewButtonGradient: {
    padding: 1,
    borderRadius: 20,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: '#000',
    margin: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 19,
  },
  joinButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  joinButtonGradient: {
    padding: 1,
    borderRadius: 20,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: '#000',
    margin: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 19,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
  },
})
