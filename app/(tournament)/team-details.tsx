import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import React, { useState, useEffect } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, addDoc, serverTimestamp } from 'firebase/firestore'
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

enum EventType {
  CASUAL = 'CASUAL',
  TOURNAMENT = 'TOURNAMENT',
  TRAINING = 'TRAINING'
}

enum SkillLevel {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced'
}

// Define interfaces based on schema
interface User {
  id: string
  name: string
  profilePic?: string
  skillLevel: string
  age?: number
  bio?: string
}

interface Location {
  address: string
  latitude: number
  longitude: number
  virtualServer?: string
}

interface Team {
  id: string
  name: string
  players: string[]
  playerDetails?: User[]
  captainId: string
  isOpen: boolean
  tournamentId: string
  createdAt?: any
  game?: string
  eventType?: EventType
  maxPlayers?: number
  requiredSkillLevel?: SkillLevel
  isPrivate?: boolean
  logo?: string
}

interface TournamentTeam {
  teamId: string
  players: string[]
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
  id: string
  name: string
  game: string
  entryFee: number
  createdById?: string
  createdByType?: CreatedByType
  location?: string
  prizePool?: number
  matchFormat?: MatchFormat
  status?: TournamentStatus
  schedule?: TournamentSchedule[]
  createdAt?: Date
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

export default function TeamDetails() {
  const router = useRouter()
  const { teamId, tournamentId, action } = useLocalSearchParams()
  const { currentUser } = useAuth()
  const [team, setTeam] = useState<Team | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [players, setPlayers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAction, setLoadingAction] = useState(false)
  const [isCaptain, setIsCaptain] = useState(false)
  const [isTeamMember, setIsTeamMember] = useState(false)

  useEffect(() => {
    if (teamId) {
      fetchTeam(teamId.toString())
    } else if (tournamentId && action === 'join') {
      // If coming from tournament details with join action
      fetchOpenTeams(tournamentId.toString())
    }
  }, [teamId, tournamentId, action])

  const fetchTeam = async (id: string) => {
    setLoading(true)
    try {
      const db = getFirestore()
      const teamRef = doc(db, 'teams', id)
      const teamSnap = await getDoc(teamRef)
      
      if (teamSnap.exists()) {
        const data = teamSnap.data() as Team
        const teamData = {
          ...data,
          id: teamSnap.id
        }
        
        setTeam(teamData)
        
        // Check if current user is captain or team member
        if (currentUser) {
          setIsCaptain(data.captainId === currentUser.uid)
          setIsTeamMember(data.players.includes(currentUser.uid))
        }
        
        // Fetch tournament details
        if (data.tournamentId) {
          fetchTournament(data.tournamentId)
        }
        
        // Fetch player details
        if (data.players && data.players.length > 0) {
          fetchPlayers(data.players)
        }
      } else {
        Alert.alert('Error', 'Team not found')
        router.back()
      }
    } catch (error) {
      console.error('Error fetching team:', error)
      Alert.alert('Error', 'Failed to load team details')
    } finally {
      setLoading(false)
    }
  }
  
  const fetchOpenTeams = async (tournamentId: string) => {
    setLoading(true)
    try {
      const db = getFirestore()
      const teamsRef = collection(db, 'teams')
      const teamsQuery = query(
        teamsRef, 
        where('tournamentId', '==', tournamentId),
        where('isOpen', '==', true)
      )
      
      const teamsSnap = await getDocs(teamsQuery)
      
      if (!teamsSnap.empty) {
        // Get the first open team
        const teamDoc = teamsSnap.docs[0]
        const teamData = {
          id: teamDoc.id,
          ...teamDoc.data()
        } as Team
        
        setTeam(teamData)
        
        // Check if current user is captain or team member
        if (currentUser) {
          setIsCaptain(teamData.captainId === currentUser.uid)
          setIsTeamMember(teamData.players.includes(currentUser.uid))
        }
        
        // Fetch tournament details
        fetchTournament(tournamentId)
        
        // Fetch player details
        if (teamData.players && teamData.players.length > 0) {
          fetchPlayers(teamData.players)
        }
      } else {
        // No open teams found, redirect to create team
        Alert.alert(
          'No Open Teams',
          'There are no open teams to join. Would you like to create a new team?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => router.back()
            },
            {
              text: 'Create Team',
              onPress: () => router.push({
                pathname: '/(tournament)/create-team',
                params: { tournamentId }
              })
            }
          ]
        )
      }
    } catch (error) {
      console.error('Error fetching open teams:', error)
      Alert.alert('Error', 'Failed to find open teams')
      router.back()
    } finally {
      setLoading(false)
    }
  }
  
  const fetchTournament = async (id: string) => {
    try {
      const db = getFirestore()
      const tournamentRef = doc(db, 'tournaments', id)
      const tournamentSnap = await getDoc(tournamentRef)
      
      if (tournamentSnap.exists()) {
        const data = tournamentSnap.data()
        setTournament({
          id: tournamentSnap.id,
          name: data.name || 'Unknown Tournament',
          game: data.game || data.sport || 'Unknown',
          entryFee: data.entryFee || 0
        })
      }
    } catch (error) {
      console.error('Error fetching tournament:', error)
    }
  }
  
  const fetchPlayers = async (playerIds: string[]) => {
    try {
      const db = getFirestore()
      const playersData: User[] = []
      
      // For each player ID, fetch user details
      for (const playerId of playerIds) {
        const userRef = doc(db, 'users', playerId)
        const userSnap = await getDoc(userRef)
        
        if (userSnap.exists()) {
          const userData = userSnap.data()
          playersData.push({
            id: userSnap.id,
            name: userData.name || userData.fullName || 'Unknown User',
            profilePic: userData.profilePic,
            skillLevel: userData.skillLevel || 'Intermediate',
            age: userData.age,
            bio: userData.bio
          })
        } else {
          // If user not found, add placeholder
          playersData.push({
            id: playerId,
            name: 'Unknown User',
            skillLevel: 'Intermediate'
          })
        }
      }
      
      setPlayers(playersData)
    } catch (error) {
      console.error('Error fetching players:', error)
    }
  }

  const handleJoinRequest = async () => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please login to join this team')
      return
    }
    
    if (!team) return
    
    setLoadingAction(true)
    try {
      const db = getFirestore()
      
      if (team.isOpen) {
        // If team is open, directly add user to team
        const teamRef = doc(db, 'teams', team.id)
        await updateDoc(teamRef, {
          players: arrayUnion(currentUser.uid)
        })
        
        Alert.alert(
          'Success',
          'You have joined the team!',
          [{ text: 'OK', onPress: () => fetchTeam(team.id) }]
        )
      } else {
        // If team is invite-only, create a join request
        await addDoc(collection(db, 'teamJoinRequests'), {
          teamId: team.id,
          teamName: team.name,
          tournamentId: team.tournamentId,
          userId: currentUser.uid,
          status: 'pending',
          createdAt: serverTimestamp()
        })
        
        Alert.alert(
          'Request Sent',
          'Your request to join the team has been sent to the captain.',
          [{ text: 'OK' }]
        )
      }
    } catch (error) {
      console.error('Error joining team:', error)
      Alert.alert('Error', 'Failed to join team. Please try again.')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleLeaveTeam = async () => {
    if (!currentUser || !team) return
    
    Alert.alert(
      'Leave Team',
      'Are you sure you want to leave this team?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction(true)
            try {
              const db = getFirestore()
              const teamRef = doc(db, 'teams', team.id)
              
              // Remove user from players array
              await updateDoc(teamRef, {
                players: team.players.filter(id => id !== currentUser.uid)
              })
              
              Alert.alert(
                'Success',
                'You have left the team',
                [{ text: 'OK', onPress: () => router.back() }]
              )
            } catch (error) {
              console.error('Error leaving team:', error)
              Alert.alert('Error', 'Failed to leave team. Please try again.')
            } finally {
              setLoadingAction(false)
            }
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9F45" />
        <Text style={styles.loadingText}>Loading team details...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Team Details</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Team Info */}
        <View style={styles.teamCard}>
          <Text style={styles.teamName}>{team?.name}</Text>
          
          {tournament && (
            <View style={styles.tournamentInfo}>
              <MaterialIcons name="emoji-events" size={16} color="#FF9F45" />
              <Text style={styles.tournamentName}>{tournament.name}</Text>
            </View>
          )}
          
          <View style={styles.teamStats}>
            <View style={styles.statItem}>
              <MaterialIcons name="group" size={24} color="#FF9F45" />
              <Text style={styles.statValue}>{players.length}</Text>
              <Text style={styles.statLabel}>Players</Text>
                </View>
            
            <View style={styles.statItem}>
              <MaterialIcons name={team?.isOpen ? 'lock-open' : 'lock'} size={24} color="#FF9F45" />
              <Text style={styles.statValue}>{team?.isOpen ? 'Open' : 'Invite Only'}</Text>
              <Text style={styles.statLabel}>Joining</Text>
            </View>
          </View>
          
          {!isTeamMember && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinRequest}
              disabled={loadingAction}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.joinButtonGradient}
              >
                {loadingAction ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.joinButtonText}>JOIN TEAM</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {isTeamMember && !isCaptain && (
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={handleLeaveTeam}
              disabled={loadingAction}
            >
              <Text style={styles.leaveButtonText}>LEAVE TEAM</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Players List */}
        <View style={styles.playersSection}>
          <Text style={styles.sectionTitle}>Players</Text>
          
          {players.map((player, index) => {
            const isCaptainPlayer = team?.captainId === player.id
            
            return (
              <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerInfo}>
                  <View style={styles.playerAvatar}>
                    {player.profilePic ? (
                      <Image source={{ uri: player.profilePic }} style={styles.avatarImage} />
                    ) : (
                      <MaterialIcons name="person" size={24} color="#333" />
                    )}
                </View>
                <View style={styles.playerDetails}>
                    <View style={styles.playerNameRow}>
                      <Text style={styles.playerName}>{player.name}</Text>
                      {isCaptainPlayer && (
                        <View style={styles.captainBadge}>
                          <Text style={styles.captainBadgeText}>Captain</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.playerSkill}>{player.skillLevel}</Text>
                  </View>
                </View>
              </View>
            )
          })}
          
          {players.length === 0 && (
            <View style={styles.emptyPlayersContainer}>
              <MaterialIcons name="people" size={48} color="#666" />
              <Text style={styles.emptyPlayersText}>No players have joined yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
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
  content: {
    flex: 1,
    padding: 16,
  },
  teamCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tournamentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  tournamentName: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  teamStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    color: '#999999',
    fontSize: 12,
  },
  joinButton: {
    marginTop: 16,
  },
  joinButtonGradient: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leaveButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FF4545',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#FF4545',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playersSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  playerCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  playerDetails: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  captainBadge: {
    backgroundColor: '#FF9F4520',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  captainBadgeText: {
    color: '#FF9F45',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playerSkill: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  emptyPlayersContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyPlayersText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
  },
}) 