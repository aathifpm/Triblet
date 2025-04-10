import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ImageBackground,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { format, parseISO } from 'date-fns'
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'

// Define interfaces based on schema
interface Location {
  address: string
  latitude: number
  longitude: number
}

interface User {
  id: string
  name: string
  profilePic?: string
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced'
}

interface Turf {
  id: string
  name: string
  location: Location
  sportsAvailable: string[]
  pricing: {
    peakHours: number
    offPeakHours: number
  }
  amenities: string[]
  images: string[]
  ratings: {
    totalReviews: number
    averageRating: number
  }
}

interface Party {
  id: string
  leaderId: string
  sport: string
  eventType: 'Casual' | 'Tournament' | 'Training'
  date: Date | string
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
  matchFormat: 'Knockout' | 'League' | 'Round-Robin'
  status: 'Upcoming' | 'Ongoing' | 'Completed'
  image?: string
}

export default function Index() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'Sports' | 'Esports'>('Sports')
  const [parties, setParties] = useState<Party[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [isLoadingParties, setIsLoadingParties] = useState(true)
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true)

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
      const partiesQuery = query(
        partiesRef,
        // Removed orderBy to avoid index requirement
        limit(5)
      )
      
      /* If you need ordering, create the required index in Firebase console first:
      const partiesQuery = query(
        partiesRef,
        orderBy('date', 'asc'),
        limit(5)
      )
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
          // You could fetch leader details here
          // For now, creating a placeholder
          leaderData = {
            id: data.leaderId,
            name: "Party Leader",
            skillLevel: "Intermediate"
          }
        }
        
        if (data.players && data.players.length > 0) {
          // For simplicity, just creating placeholder player details
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
      Alert.alert('Error', 'Failed to load parties. Please try again.')
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
        where('status', '==', 'Upcoming'),
        limit(5)
      )
      
      const querySnapshot = await getDocs(tournamentsQuery)
      const tournamentsData: Tournament[] = []
      
      querySnapshot.forEach(doc => {
        const data = doc.data() as Tournament
        tournamentsData.push({
          ...data,
          id: doc.id
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
      await Promise.all([fetchParties(), fetchTournaments()])
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setRefreshing(false)
    }
  }, [])

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

  const renderPartyCard = (party: Party) => {
    const partyDate = party.date instanceof Date ? party.date : new Date(party.date);
    
    return (
      <TouchableOpacity 
        key={party.id}
        style={styles.gameCard}
        onPress={() => router.push({
          pathname: '/GameDetailsScreen',
          params: { id: party.id }
        })}
      >
        <ImageBackground
          source={party.image ? { uri: party.image } : require('@/assets/images/turf-cricket.png')}
          style={styles.gameImage}
          imageStyle={{ borderRadius: 16 }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.gameGradient}
          >
            <View style={styles.playerCount}>
              <View style={styles.avatarStack}>
                {party.playerDetails?.slice(0, 3).map((player, index) => (
                  <View
                    key={player.id}
                    style={[styles.avatar, { marginLeft: index > 0 ? -10 : 0 }]}
                  />
                ))}
              </View>
              <Text style={styles.playerText}>
                {party.players.length}/{party.maxPlayers} Are in
              </Text>
            </View>

            <Text style={styles.gameSport}>{party.sport}</Text>
            <Text style={styles.gameLocation}>{party.location || '20 km/s'}</Text>

            <View style={styles.gameDetails}>
              <View style={styles.gameInfo}>
                <MaterialIcons name="person" size={16} color="#666" />
                <Text style={styles.gameInfoText}>
                  Hosted by {party.leader?.name || 'Unknown Host'}
                </Text>
              </View>

              <View style={styles.gameInfo}>
                <MaterialIcons name="event" size={16} color="#666" />
                <Text style={styles.gameInfoText}>
                  {format(partyDate, 'EEE d MMM')}
                </Text>
                <MaterialIcons name="access-time" size={16} color="#666" />
                <Text style={styles.gameInfoText}>{party.time}</Text>
              </View>

              <View style={styles.gameInfo}>
                <MaterialIcons name="location-on" size={16} color="#666" />
                <Text style={styles.gameInfoText}>{party.location || 'Location not specified'}</Text>
              </View>

              <View style={styles.gameInfo}>
                <MaterialIcons name="trending-up" size={16} color="#666" />
                <Text style={styles.gameInfoText}>{party.requiredSkillLevel} level</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.detailsButton}
              onPress={() => router.push({
                pathname: '/GameDetailsScreen',
                params: { id: party.id }
              })}
            >
              <Text style={styles.detailsButtonText}>Details</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    )
  }

  const renderTournamentCard = (tournament: Tournament) => (
    <TouchableOpacity 
      key={tournament.id}
      style={styles.tournamentCard}
      onPress={() => router.push({
        pathname: '/tournaments',
        params: { id: tournament.id }
      })}
    >
      <ImageBackground
        source={tournament.image ? { uri: tournament.image } : require('@/assets/images/tournament.png')}
        style={styles.tournamentImage}
        imageStyle={{ borderRadius: 16 }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.tournamentGradient}
        >
          <View style={styles.tournamentContent}>
            <View style={styles.tournamentHeader}>
              <View style={styles.tournamentStatus}>
                <MaterialIcons name="event" size={16} color="#FF9F45" />
                <Text style={styles.statusText}>{tournament.status}</Text>
              </View>
              <View style={styles.prizePool}>
                <Text style={styles.prizeLabel}>Prize Pool</Text>
                <Text style={styles.prizeAmount}>₹{tournament.prizePool}</Text>
              </View>
            </View>

            <View style={styles.tournamentInfo}>
              <Text style={styles.tournamentName}>{tournament.name}</Text>
              <View style={styles.tournamentDetails}>
                <View style={styles.detailRow}>
                  <MaterialIcons name="sports" size={16} color="#666" />
                  <Text style={styles.detailText}>{tournament.sport}</Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="location-on" size={16} color="#666" />
                  <Text style={styles.detailText}>{tournament.location}</Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="payment" size={16} color="#666" />
                  <Text style={styles.detailText}>Entry Fee: ₹{tournament.entryFee}</Text>
                </View>
                <View style={styles.detailRow}>
                  <MaterialIcons name="emoji-events" size={16} color="#666" />
                  <Text style={styles.detailText}>{tournament.matchFormat} Format</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.registerButton}
              onPress={() => router.push({
                pathname: '/tournaments',
                params: { id: tournament.id }
              })}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.registerGradient}
              >
                <View style={styles.registerInner}>
                  <Text style={styles.registerText}>Register Now</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  )

  const renderLoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF9F45" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  )

  const renderEmptyParties = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="sports" size={48} color="#666" />
      <Text style={styles.emptyText}>No parties available</Text>
    </View>
  )

  const renderEmptyTournaments = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="emoji-events" size={48} color="#666" />
      <Text style={styles.emptyText}>No tournaments available</Text>
    </View>
  )
  
  return (
    <View style={styles.container}>
      <Header />

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
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => setActiveTab('Sports')}
          >
            {activeTab === 'Sports' ? (
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activeTabWrapper}
          >
            <View style={styles.activeTab}>
              <Text style={styles.activeTabText}>Sports</Text>
              <View style={styles.dotIndicator} />
            </View>
          </LinearGradient>
            ) : (
              <View style={styles.inactiveTab}>
                <Text style={styles.inactiveTabText}>Sports</Text>
                <View style={styles.inactiveDotIndicator} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('Esports')}
          >
            {activeTab === 'Esports' ? (
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activeTabWrapper}
              >
                <View style={styles.activeTab}>
                  <Text style={styles.activeTabText}>Esports</Text>
                  <View style={styles.dotIndicator} />
                </View>
              </LinearGradient>
            ) : (
              <View style={styles.inactiveTab}>
            <Text style={styles.inactiveTabText}>Esports</Text>
            <View style={styles.inactiveDotIndicator} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Join, Book & Form Triblets</Text>

        <View style={styles.cardContainer}>
          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/parties')}
          >
            <ImageBackground
              source={require('@/assets/images/join.png')}
              style={styles.cardImage}
              imageStyle={{ borderRadius: 12 }}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.cardGradient}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Join</Text>
                  <Text style={styles.cardDescription}>
                    Find player parties nearby and join them
                  </Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/book')}
          >
            <ImageBackground
              source={require('@/assets/images/book.png')}
              style={styles.cardImage}
              imageStyle={{ borderRadius: 12 }}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.cardGradient}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Book</Text>
                  <Text style={styles.cardDescription}>
                    Book venue slots and let others join & play
                  </Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/create-game')}
          >
            <ImageBackground
              source={require('@/assets/images/form.png')}
              style={styles.cardImage}
              imageStyle={{ borderRadius: 12 }}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.cardGradient}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Form</Text>
                  <Text style={styles.cardDescription}>
                    Create a party without booking
                  </Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.buttonWrapper}
            onPress={() => router.push('/GameDetailsScreen')}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.buttonDescription}>Know your games</Text>
                <Text style={styles.buttonText}>Schedule</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.buttonWrapper}
            onPress={() => router.push('/tournament')}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.buttonDescription}>
                  Create or join local
                </Text>
                <Text style={styles.buttonText}>Tournaments</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.buttonWrapper}
            onPress={() => router.push('/bookings')}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.buttonDescription}>
                  Your current & past
                </Text>
                <Text style={styles.buttonText}>Bookings</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Image
          source={require('@/assets/images/sale-banner.png')}
          style={styles.banner}
        />

        <Text style={styles.sectionTitle}>Choose your sport</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sportsContainer}
        >
          {[
            'Cricket',
            'Football',
            'Basketball',
            'Tennis',
            'Badminton',
            'Table Tennis',
            'Volleyball',
            'Swimming',
          ].map(sport => (
            <TouchableOpacity 
              key={sport} 
              style={styles.sportItem}
              onPress={() => router.push(`/(tabs)/book?sport=${sport}`)}
            >
              <View style={styles.sportIconContainer}>
                <MaterialIcons name={getSportIcon(sport)} size={24} color="#FF9F45" />
              </View>
              <Text style={styles.sportText}>{sport}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Join games</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>

        {isLoadingParties ? (
          renderLoadingIndicator()
        ) : (
          parties.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.gamesContainer}
            >
              {parties.map(party => renderPartyCard(party))}
            </ScrollView>
          ) : (
            renderEmptyParties()
          )
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tournaments</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>

        {isLoadingTournaments ? (
          renderLoadingIndicator()
        ) : (
          tournaments.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tournamentsContainer}
            >
              {tournaments.map(tournament => renderTournamentCard(tournament))}
            </ScrollView>
          ) : (
            renderEmptyTournaments()
          )
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
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
  },
  sectionHeader: {
    marginVertical: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  titleUnderline: {
    height: 2,
    width: 40,
    borderRadius: 1,
    marginTop: 4,
  },
  cardContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardGradient: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  cardContent: {
    alignItems: 'flex-start',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDescription: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  buttonWrapper: {
    flex: 1,
  },
  buttonGradient: {
    borderRadius: 20,
    padding: 1,
  },
  buttonInner: {
    backgroundColor: '#000',
    borderRadius: 19,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  buttonDescription: {
    color: '#666',
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  banner: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    marginBottom: 24,
  },
  sportsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  sportItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  sportIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  sportText: {
    color: '#fff',
    fontSize: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 24,
  },
  activeTabWrapper: {
    borderRadius: 20,
    padding: 1,
  },
  activeTab: {
    backgroundColor: '#000',
    borderRadius: 19,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  activeTabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  inactiveTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  inactiveTabText: {
    color: '#666',
    fontSize: 16,
  },
  dotIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF9F45',
    marginTop: 4,
  },
  inactiveDotIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
    marginTop: 4,
  },
  gamesContainer: {
    marginBottom: 24,
  },
  gameCard: {
    width: 300,
    height: 200,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gameImage: {
    width: '100%',
    height: '100%',
  },
  gameGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
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
  gameSport: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameLocation: {
    color: '#666',
    fontSize: 12,
  },
  gameDetails: {
    gap: 4,
  },
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameInfoText: {
    color: '#666',
    fontSize: 12,
  },
  detailsButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF9F45',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  detailsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  tournamentsContainer: {
    marginBottom: 24,
  },
  tournamentCard: {
    width: 300,
    height: 200,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tournamentImage: {
    width: '100%',
    height: '100%',
  },
  tournamentGradient: {
    flex: 1,
    padding: 16,
  },
  tournamentContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tournamentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    color: '#FF9F45',
    fontSize: 12,
    fontWeight: '500',
  },
  prizePool: {
    alignItems: 'flex-end',
  },
  prizeLabel: {
    color: '#666',
    fontSize: 10,
  },
  prizeAmount: {
    color: '#FF9F45',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tournamentInfo: {
    gap: 12,
  },
  tournamentName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tournamentDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    color: '#666',
    fontSize: 12,
  },
  registerButton: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 16,
  },
  registerGradient: {
    borderRadius: 16,
    padding: 1,
  },
  registerInner: {
    backgroundColor: '#000',
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  registerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
