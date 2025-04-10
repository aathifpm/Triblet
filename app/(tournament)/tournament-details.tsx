import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ImageBackground,
  Image,
} from 'react-native'
import React, { useState, useEffect } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { format } from 'date-fns'
import { getFirestore, doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
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

// Define interfaces based on schema
interface User {
  id: string
  name: string
  profilePic?: string
  skillLevel: string
}

interface Location {
  address: string
  latitude: number
  longitude: number
  virtualServer?: string
}

interface TournamentTeam {
  teamId: string
  players: string[]
}

interface TournamentSchedule {
  matchId: string
  team1: string
  team2: string
  time: Date | Timestamp
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

interface Match {
  id: string;
  tournamentId: string;
  team1Id: string;
  team2Id: string;
  date: Date;
  time: string;
  venue: string;
  status: 'SCHEDULED' | 'LIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  game: 'Cricket' | 'Football';
  result?: {
    winner?: string;
    team1Score?: number | string;
    team2Score?: number | string;
    summary?: string;
  };
}

interface Tournament {
  id: string
  createdById: string
  createdByType: CreatedByType
  name: string
  game: string
  location: string
  entryFee: number
  prizePool: number
  matchFormat: MatchFormat
  status: TournamentStatus
  schedule?: TournamentSchedule[]
  createdAt: Date | Timestamp
  updatedAt: Date | Timestamp
  teamCount: number
  currentTeams: number
  description?: string
  image?: string
  teams?: TournamentTeam[]
  startDate?: Date | Timestamp
  endDate?: Date | Timestamp
  registrationDeadline?: Date | Timestamp
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

export default function TournamentDetails() {
  const router = useRouter()
  const { id, action } = useLocalSearchParams()
  const { currentUser } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'teams' | 'schedule' | 'leaderboard'>('info')
  const [teams, setTeams] = useState<any[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)

  useEffect(() => {
    if (id) {
      fetchTournament(id.toString())
      fetchMatches(id.toString())
    }
    
    // If action is 'join', show the registration dialog
    if (action === 'join' && id) {
      setTimeout(() => {
        handleRegisterTeam()
      }, 1000)
    }
  }, [id, action])

  const fetchTournament = async (tournamentId: string) => {
    setLoading(true)
    try {
      const db = getFirestore()
      const tournamentRef = doc(db, 'tournaments', tournamentId)
      const tournamentSnap = await getDoc(tournamentRef)
      
      if (tournamentSnap.exists()) {
        const data = tournamentSnap.data()
        
        // Convert Firestore Timestamp to Date if needed
        const createdAt = data.createdAt instanceof Timestamp 
          ? new Date(data.createdAt.seconds * 1000) 
          : data.createdAt
          
        const updatedAt = data.updatedAt instanceof Timestamp 
          ? new Date(data.updatedAt.seconds * 1000) 
          : data.updatedAt
          
        const scheduleWithDates = data.schedule ? data.schedule.map((match: any) => ({
          ...match,
          time: match.time instanceof Timestamp ? 
            new Date(match.time.seconds * 1000) : 
            match.time
        })) : []
        
        setTournament({
          id: tournamentSnap.id,
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
          // Add required fields with defaults if not in data
          createdById: data.createdById || '',
          createdByType: data.createdByType || 'USER',
          name: data.name || 'Unknown Tournament',
          location: data.location || 'Unknown Location',
          entryFee: data.entryFee || 0,
          prizePool: data.prizePool || 0
        })
        
        // Fetch teams for this tournament
        fetchTeams(tournamentId)
      } else {
        Alert.alert('Error', 'Tournament not found')
        router.back()
      }
    } catch (error) {
      console.error('Error fetching tournament:', error)
      Alert.alert('Error', 'Failed to load tournament details')
    } finally {
      setLoading(false)
    }
  }
  
  const fetchTeams = async (tournamentId: string) => {
    setLoadingTeams(true)
    try {
      const db = getFirestore()
      const teamsRef = collection(db, 'teams')
      const teamsQuery = query(teamsRef, where('tournamentId', '==', tournamentId))
      const teamsSnap = await getDocs(teamsQuery)
      
      const teamsData: any[] = []
      teamsSnap.forEach(doc => {
        teamsData.push({
          id: doc.id,
          ...doc.data()
        })
      })
      
      setTeams(teamsData)
    } catch (error) {
      console.error('Error fetching teams:', error)
    } finally {
      setLoadingTeams(false)
    }
  }

  const fetchMatches = async (tournamentId: string) => {
    try {
      setLoadingMatches(true)
      const db = getFirestore()
      const matchesRef = collection(db, 'matches')
      const q = query(matchesRef, where('tournamentId', '==', tournamentId))
      const querySnapshot = await getDocs(q)
      
      const matchesData: Match[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        const matchDate = data.date?.toDate() || new Date()
        
        matchesData.push({
          id: doc.id,
          tournamentId: data.tournamentId,
          team1Id: data.team1Id,
          team2Id: data.team2Id,
          date: matchDate,
          time: data.time,
          venue: data.venue,
          status: data.status || 'SCHEDULED',
          game: data.game,
          result: data.result,
        })
      })
      
      // Sort matches by date and status
      const sortedMatches = matchesData.sort((a, b) => {
        if (a.status === 'LIVE' && b.status !== 'LIVE') return -1
        if (b.status === 'LIVE' && a.status !== 'LIVE') return 1
        
        if (a.status === 'SCHEDULED' && b.status === 'SCHEDULED') {
          return a.date.getTime() - b.date.getTime()
        }
        
        if (a.status === 'COMPLETED' && b.status === 'COMPLETED') {
          return b.date.getTime() - a.date.getTime()
        }
        
        return a.date.getTime() - b.date.getTime()
      })
      
      setMatches(sortedMatches)
    } catch (error) {
      console.error('Error fetching matches:', error)
      Alert.alert('Error', 'Failed to load matches')
    } finally {
      setLoadingMatches(false)
    }
  }

  const handleRegisterTeam = () => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to join this tournament')
      return
    }
    
    Alert.alert(
      'Register Team',
      'Would you like to register a new team or join an existing one?',
      [
        {
          text: 'New Team',
          onPress: () => router.push({
            pathname: '/create-team',
            params: { tournamentId: id }
          })
        },
        {
          text: 'Join Team',
          onPress: () => router.push({
            pathname: '/(tournament)/team-details',
            params: { tournamentId: id, action: 'join' }
          })
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    )
  }

  const getTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team?.name || 'Unknown Team';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9F45" />
        <Text style={styles.loadingText}>Loading tournament details...</Text>
      </View>
    )
  }

  const renderInfoTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Tournament Details</Text>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <MaterialIcons name="emoji-events" size={24} color="#FF9F45" />
            <Text style={styles.infoLabel}>Prize Pool</Text>
            <Text style={styles.infoValue}>₹{tournament?.prizePool.toLocaleString()}</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="payments" size={24} color="#FF9F45" />
            <Text style={styles.infoLabel}>Entry Fee</Text>
            <Text style={styles.infoValue}>₹{tournament?.entryFee.toLocaleString()}</Text>
          </View>
          <View style={styles.infoItem}>
            <MaterialIcons name="group" size={24} color="#FF9F45" />
            <Text style={styles.infoLabel}>Teams</Text>
            <Text style={styles.infoValue}>{tournament?.currentTeams}/{tournament?.teamCount}</Text>
          </View>
        </View>
        
        {tournament?.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{tournament.description}</Text>
          </View>
        )}
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Venue</Text>
        <View style={styles.venueCard}>
          <MaterialIcons name="location-on" size={24} color="#FF9F45" />
          <View style={styles.venueInfo}>
            <Text style={styles.venueName}>{tournament?.location}</Text>
          </View>
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => {
              // Open maps with location
              Alert.alert('Map', 'Map functionality will be implemented soon')
            }}
          >
            <MaterialIcons name="map" size={24} color="#FF9F45" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Format</Text>
        <View style={styles.formatCard}>
          <View style={styles.formatHeader}>
            <MaterialIcons name="sports" size={24} color="#FF9F45" />
            <Text style={styles.formatTitle}>{tournament?.matchFormat}</Text>
          </View>
          <Text style={styles.formatDescription}>
            {tournament?.matchFormat === 'Knockout' 
              ? 'Single elimination tournament where losing teams are eliminated.'
              : tournament?.matchFormat === 'League'
                ? 'Teams play against each other in a round-robin format for points.'
                : 'Each team plays against every other team once.'}
          </Text>
        </View>
      </View>
    </View>
  )

  const renderTeamsTab = () => (
    <View style={styles.tabContent}>
      {loadingTeams ? (
        <View style={styles.loadingTeamsContainer}>
          <ActivityIndicator size="small" color="#FF9F45" />
          <Text style={styles.loadingText}>Loading teams...</Text>
        </View>
      ) : teams.length > 0 ? (
        teams.map((team, index) => (
          <View key={team.id} style={styles.teamCard}>
            <View style={styles.teamHeader}>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{team.name || `Team ${index + 1}`}</Text>
                <Text style={styles.playerCount}>{team.playersIds?.length || 0} Players</Text>
              </View>
              <TouchableOpacity 
                style={styles.viewTeamButton}
                onPress={() => {
                  if (tournament?.game.toLowerCase() === 'cricket') {
                    router.push({
                      pathname: '/(tournament)/cricket-team',
                      params: { teamId: team.id, tournamentId: id }
                    });
                  } else if (tournament?.game.toLowerCase() === 'football') {
                    router.push({
                      pathname: '/(tournament)/football-team',
                      params: { teamId: team.id, tournamentId: id }
                    });
                  }
                }}
              >
                <LinearGradient
                  colors={['#FF9F45', '#D494FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.viewTeamGradient}
                >
                  <Text style={styles.viewTeamText}>View</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <View style={styles.teamPlayers}>
              <View style={styles.playerAvatars}>
                {Array(Math.min(team.playersIds?.length || 0, 3)).fill(0).map((_, i) => (
                  <View key={i} style={[styles.playerAvatar, { marginLeft: i > 0 ? -10 : 0 }]} />
                ))}
                {(team.playersIds?.length || 0) > 3 && (
                  <View style={styles.morePlayersCircle}>
                    <Text style={styles.morePlayersText}>+{(team.playersIds?.length || 0) - 3}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyTeamsContainer}>
          <MaterialIcons name="groups" size={48} color="#666" />
          <Text style={styles.emptyTeamsText}>No teams have joined yet</Text>
        </View>
      )}
      
      {tournament?.status === 'Upcoming' && (
        <TouchableOpacity 
          style={styles.registerTeamButton}
          onPress={() => {
            if (tournament?.game.toLowerCase() === 'cricket') {
              router.push({
                pathname: '/(tournament)/cricket-team',
                params: { tournamentId: id, action: 'create' }
              });
            } else if (tournament?.game.toLowerCase() === 'football') {
              router.push({
                pathname: '/(tournament)/football-team',
                params: { tournamentId: id, action: 'create' }
              });
            }
          }}
        >
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.registerTeamGradient}
          >
            <Text style={styles.registerTeamText}>REGISTER TEAM</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  )

  const renderScheduleTab = () => (
    <View style={styles.tabContent}>
      {loadingMatches ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9F45" />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      ) : matches.length > 0 ? (
        <>
          {/* Live Matches */}
          {matches.filter(match => match.status === 'LIVE' || match.status === 'IN_PROGRESS').length > 0 && (
            <View style={styles.matchesSection}>
              <Text style={styles.matchesSectionTitle}>Live Matches</Text>
              {matches
                .filter(match => match.status === 'LIVE' || match.status === 'IN_PROGRESS')
                .map((match) => (
                  <TouchableOpacity
                    key={match.id}
                    style={styles.matchCard}
                    onPress={() => {
                      const path = match.game === 'Cricket' ? '/(tournament)/cricket-match' : '/(tournament)/football-match';
                      router.push({
                        pathname: path,
                        params: { matchId: match.id }
                      });
                    }}
                  >
                    <View style={styles.matchHeader}>
                      <View style={styles.matchDateTime}>
                        <MaterialIcons name="event" size={16} color="#FF9F45" />
                        <Text style={styles.matchDate}>{format(match.date, 'EEE, MMM d')}</Text>
                        <MaterialIcons name="access-time" size={16} color="#FF9F45" />
                        <Text style={styles.matchTime}>{match.time}</Text>
                      </View>
                      <View style={styles.matchVenue}>
                        <MaterialIcons name="location-on" size={16} color="#FF9F45" />
                        <Text style={styles.venueText}>{match.venue}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.matchTeams}>
                      <View style={styles.teamSide}>
                        <View style={styles.teamLogo} />
                        <Text style={styles.teamName}>{getTeamName(match.team1Id)}</Text>
                      </View>
                      <View style={styles.vsContainer}>
                        <Text style={styles.vsText}>VS</Text>
                      </View>
                      <View style={styles.teamSide}>
                        <View style={styles.teamLogo} />
                        <Text style={styles.teamName}>{getTeamName(match.team2Id)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.liveIndicatorContainer}>
                      <Text style={styles.liveIndicator}>LIVE</Text>
                      <Text style={styles.updateScoreText}>Tap to view match</Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          )}

          {/* Upcoming Matches */}
          {matches.filter(match => match.status === 'SCHEDULED').length > 0 && (
            <View style={styles.matchesSection}>
              <Text style={styles.matchesSectionTitle}>Upcoming Matches</Text>
              {matches
                .filter(match => match.status === 'SCHEDULED')
                .map((match) => (
                  <View key={match.id} style={styles.matchCard}>
                    <View style={styles.matchHeader}>
                      <View style={styles.matchDateTime}>
                        <MaterialIcons name="event" size={16} color="#FF9F45" />
                        <Text style={styles.matchDate}>{format(match.date, 'EEE, MMM d')}</Text>
                        <MaterialIcons name="access-time" size={16} color="#FF9F45" />
                        <Text style={styles.matchTime}>{match.time}</Text>
                      </View>
                      <View style={styles.matchVenue}>
                        <MaterialIcons name="location-on" size={16} color="#FF9F45" />
                        <Text style={styles.venueText}>{match.venue}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.matchTeams}>
                      <View style={styles.teamSide}>
                        <View style={styles.teamLogo} />
                        <Text style={styles.teamName}>{getTeamName(match.team1Id)}</Text>
                      </View>
                      <View style={styles.vsContainer}>
                        <Text style={styles.vsText}>VS</Text>
                      </View>
                      <View style={styles.teamSide}>
                        <View style={styles.teamLogo} />
                        <Text style={styles.teamName}>{getTeamName(match.team2Id)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
            </View>
          )}

          {/* Completed Matches */}
          {matches.filter(match => match.status === 'COMPLETED').length > 0 && (
            <View style={styles.matchesSection}>
              <Text style={styles.matchesSectionTitle}>Completed Matches</Text>
              {matches
                .filter(match => match.status === 'COMPLETED')
                .map((match) => (
                  <TouchableOpacity
                    key={match.id}
                    style={styles.matchCard}
                    onPress={() => {
                      const path = match.game === 'Cricket' ? '/(tournament)/cricket-match' : '/(tournament)/football-match';
                      router.push({
                        pathname: path,
                        params: { matchId: match.id }
                      });
                    }}
                  >
                    <View style={styles.matchHeader}>
                      <View style={styles.matchDateTime}>
                        <MaterialIcons name="event" size={16} color="#FF9F45" />
                        <Text style={styles.matchDate}>{format(match.date, 'EEE, MMM d')}</Text>
                        <MaterialIcons name="access-time" size={16} color="#FF9F45" />
                        <Text style={styles.matchTime}>{match.time}</Text>
                      </View>
                      <View style={styles.matchVenue}>
                        <MaterialIcons name="location-on" size={16} color="#FF9F45" />
                        <Text style={styles.venueText}>{match.venue}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.matchTeams}>
                      <View style={styles.teamSide}>
                        <View style={styles.teamLogo} />
                        <Text style={styles.teamName}>{getTeamName(match.team1Id)}</Text>
                        {match.result && (
                          <Text style={styles.teamScore}>{match.result.team1Score}</Text>
                        )}
                      </View>
                      <View style={styles.vsContainer}>
                        <Text style={styles.vsText}>VS</Text>
                      </View>
                      <View style={styles.teamSide}>
                        <View style={styles.teamLogo} />
                        <Text style={styles.teamName}>{getTeamName(match.team2Id)}</Text>
                        {match.result && (
                          <Text style={styles.teamScore}>{match.result.team2Score}</Text>
                        )}
                      </View>
                    </View>

                    {match.result && match.result.winner && (
                      <View style={styles.resultContainer}>
                        <Text style={styles.resultText}>
                          {getTeamName(match.result.winner)}
                          {match.result.summary ? ` (${match.result.summary})` : ''}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyScheduleContainer}>
          <MaterialIcons name="event-busy" size={48} color="#666" />
          <Text style={styles.emptyScheduleText}>
            {tournament?.status === 'Upcoming' 
              ? 'Schedule will be announced once all teams have registered' 
              : 'No matches scheduled'}
          </Text>
        </View>
      )}

      {tournament?.status === 'Upcoming' && (
        <TouchableOpacity
          style={styles.scheduleManageButton}
          onPress={() => {
            if (tournament?.game) {
              router.push({
                pathname: './schedule-match',
                params: { 
                  tournamentId: tournament.id,
                  game: tournament.game
                }
              });
            }
          }}
        >
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.scheduleManageGradient}
          >
            <Text style={styles.scheduleManageText}>Manage Schedule</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Tournament Header */}
      <ImageBackground
        source={tournament?.image ? { uri: tournament.image } : require('@/assets/images/turf-cricket.png')}
        style={styles.headerImage}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
          style={styles.headerGradient}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.tournamentInfo}>
            <View style={styles.tournamentHeader}>
              <Text style={styles.tournamentName}>{tournament?.name}</Text>
              <View style={[
                styles.statusBadge,
                tournament?.status === 'Ongoing' ? styles.ongoingBadge :
                tournament?.status === 'Completed' ? styles.completedBadge : styles.upcomingBadge
              ]}>
                <Text style={[
                  styles.statusText,
                  tournament?.status === 'Ongoing' ? styles.ongoingText :
                  tournament?.status === 'Completed' ? styles.completedText : styles.upcomingText
                ]}>{tournament?.status}</Text>
              </View>
            </View>
            
            <View style={styles.tournamentMeta}>
              <View style={styles.metaItem}>
                <MaterialIcons name={getSportIcon(tournament?.game || '')} size={16} color="#FF9F45" />
                <Text style={styles.metaText}>{tournament?.game}</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="calendar-today" size={16} color="#FF9F45" />
                <Text style={styles.metaText}>
                  {tournament?.createdAt instanceof Date 
                    ? format(tournament.createdAt, 'MMM d, yyyy') 
                    : 'Date not available'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'info' && styles.activeTab]} 
          onPress={() => setActiveTab('info')}
        >
          <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>Info</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'teams' && styles.activeTab]} 
          onPress={() => setActiveTab('teams')}
        >
          <Text style={[styles.tabText, activeTab === 'teams' && styles.activeTabText]}>Teams</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'schedule' && styles.activeTab]} 
          onPress={() => setActiveTab('schedule')}
        >
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.activeTabText]}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'leaderboard' && styles.activeTab]} 
          onPress={() => {
            const path = tournament?.game === 'Cricket' ? '/(tournament)/cricket-leaderboard' : '/(tournament)/football-leaderboard';
            router.push({
              pathname: path,
              params: { tournamentId: tournament?.id }
            });
          }}
        >
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.activeTabText]}>Leaderboard</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'info' && renderInfoTab()}
        {activeTab === 'teams' && renderTeamsTab()}
        {activeTab === 'schedule' && renderScheduleTab()}
      </ScrollView>
    </View>
  )
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
  },
  headerImage: {
    width: '100%',
    height: 200,
  },
  headerGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tournamentInfo: {
    gap: 8,
  },
  tournamentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tournamentName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  upcomingBadge: {
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
  },
  ongoingBadge: {
    backgroundColor: 'rgba(75, 181, 67, 0.2)',
  },
  completedBadge: {
    backgroundColor: 'rgba(160, 160, 160, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  upcomingText: {
    color: '#FF9F45',
  },
  ongoingText: {
    color: '#4BB543',
  },
  completedText: {
    color: '#A0A0A0',
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
    color: '#FFFFFF',
    fontSize: 14,
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
    padding: 16,
  },
  tabContent: {
    gap: 20,
  },
  infoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  descriptionContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  descriptionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  descriptionText: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
  },
  venueInfo: {
    flex: 1,
    marginLeft: 12,
  },
  venueName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  venueAddress: {
    color: '#999',
    fontSize: 14,
  },
  mapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
  },
  formatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  formatTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  formatDescription: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 20,
  },
  teamCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  playerCount: {
    color: '#999',
    fontSize: 12,
  },
  viewTeamButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  viewTeamGradient: {
    padding: 1,
    borderRadius: 16,
  },
  viewTeamText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: '#000',
    margin: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  teamPlayers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF9F45',
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  morePlayersCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  morePlayersText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  loadingTeamsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTeamsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTeamsText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
  },
  registerTeamButton: {
    marginTop: 20,
  },
  registerTeamGradient: {
    borderRadius: 24,
    padding: 1,
  },
  registerTeamText: {
    color: '#FF9F45',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#000',
    margin: 1,
    padding: 12,
    borderRadius: 23,
  },
  matchCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchDate: {
    color: '#FFFFFF',
    fontSize: 12,
    marginRight: 8,
  },
  matchTime: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  matchTeams: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamSide: {
    alignItems: 'center',
    flex: 2,
  },
  teamLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    marginBottom: 8,
  },
  vsContainer: {
    flex: 1,
    alignItems: 'center',
  },
  vsText: {
    color: '#FF9F45',
    fontSize: 18,
    fontWeight: 'bold',
  },
  matchVenue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueText: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  emptyScheduleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyScheduleText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  scheduleManageButton: {
    marginBottom: 16,
  },
  scheduleManageGradient: {
    borderRadius: 24,
    padding: 1,
  },
  scheduleManageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#000',
    margin: 1,
    padding: 12,
    borderRadius: 23,
  },
  leaderboardButton: {
    marginTop: 20,
  },
  leaderboardButtonText: {
    color: '#FF9F45',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#000',
    margin: 1,
    padding: 12,
    borderRadius: 23,
  },
  matchesSection: {
    marginBottom: 24,
  },
  matchesSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  liveIndicatorContainer: {
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(75, 181, 67, 0.1)',
    padding: 8,
    borderRadius: 12,
  },
  liveIndicator: {
    color: '#4BB543',
    fontWeight: 'bold',
    fontSize: 16,
  },
  updateScoreText: {
    color: '#CCCCCC',
    fontSize: 13,
    marginTop: 4,
  },
  resultContainer: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 12,
    paddingTop: 12,
  },
  resultText: {
    color: '#4BB543',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  teamScore: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}) 