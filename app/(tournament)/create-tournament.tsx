import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native'
import React, { useState, useEffect } from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Picker } from '@react-native-picker/picker'
import DateTimePicker from '@react-native-community/datetimepicker'
import { getFirestore, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
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
interface Location {
  address: string
  latitude: number
  longitude: number
  virtualServer?: string
}

interface Turf {
  id: string
  name: string
  location: Location
  gamesAvailable: string[]
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
  name: string
  game: string
  location: string
  entryFee: number
  prizePool: number
  matchFormat: MatchFormat
  status: TournamentStatus
  teamCount: number
  currentTeams: number
  createdById: string
  createdByType: CreatedByType
  schedule?: TournamentSchedule[]
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

// Sports list
const sportsList = [
  'Football',
  'Cricket',
  'Basketball',
  'Volleyball',
  'Badminton',
  'Tennis',
]

export default function CreateTournament() {
  const router = useRouter()
  const { currentUser } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [availableTurfs, setAvailableTurfs] = useState<Turf[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [activeDateInput, setActiveDateInput] = useState<'registration' | 'start' | 'end' | null>(null)
  const [isLoadingTurfs, setIsLoadingTurfs] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const [tournament, setTournament] = useState<Tournament>({
    name: '',
    game: sportsList[0],
    location: '',
    entryFee: 0,
    prizePool: 0,
    matchFormat: MatchFormat.Knockout,
    status: TournamentStatus.Upcoming,
    teamCount: 8,
    currentTeams: 0,
    createdById: currentUser?.uid || '',
    createdByType: CreatedByType.USER,
    description: '',
    startDate: undefined,
    endDate: undefined,
    registrationDeadline: undefined,
    rules: '',
    isPrivate: false,
    minTeamSize: 1,
    maxTeamSize: 11,
    ageRestriction: 0,
    skillLevel: '',
    sponsors: [],
    streamingLink: '',
    contactEmail: '',
    contactPhone: '',
    tags: [],
  })

  useEffect(() => {
    // Fetch available turfs from Firestore
    fetchTurfs()
  }, [])

  const fetchTurfs = async () => {
    setIsLoadingTurfs(true)
    try {
      const db = getFirestore()
      const turfsRef = collection(db, 'gamingArenas')
      const querySnapshot = await getDocs(turfsRef)
      
      const turfsData: Turf[] = []
      querySnapshot.forEach(doc => {
        const data = doc.data()
        turfsData.push({
          id: doc.id,
          name: data.name,
          location: data.location,
          gamesAvailable: data.gamesAvailable || []
        })
      })
      
      // If no turfs found in Firestore, use mock data
      if (turfsData.length === 0) {
        setAvailableTurfs([
          {
            id: '1',
            name: 'Green Field Arena',
            location: {
              address: '123 Sports St, City',
              latitude: 12.9716,
              longitude: 77.5946,
            },
            gamesAvailable: ['Football', 'Cricket'],
          },
          {
            id: '2',
            name: 'Sports Hub',
            location: {
              address: '456 Game Ave, Town',
              latitude: 12.9716,
              longitude: 77.5946,
            },
            gamesAvailable: ['Basketball', 'Volleyball'],
          },
        ])
      } else {
        setAvailableTurfs(turfsData)
      }
    } catch (error) {
      console.error('Error fetching turfs:', error)
      // Fallback to mock data
      setAvailableTurfs([
        {
          id: '1',
          name: 'Green Field Arena',
          location: {
            address: '123 Sports St, City',
            latitude: 12.9716,
            longitude: 77.5946,
          },
          gamesAvailable: ['Football', 'Cricket'],
        },
        {
          id: '2',
          name: 'Sports Hub',
          location: {
            address: '456 Game Ave, Town',
            latitude: 12.9716,
            longitude: 77.5946,
          },
          gamesAvailable: ['Basketball', 'Volleyball'],
        },
      ])
    } finally {
      setIsLoadingTurfs(false)
    }
  }

  const handleCreateTournament = async () => {
    if (!validateForm()) return
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to create a tournament')
      return
    }

    setIsLoading(true)
    try {
      const db = getFirestore()
      const tournamentsRef = collection(db, 'tournaments')
      
      // Find the selected turf to get its name
      const selectedTurf = availableTurfs.find(turf => turf.id === tournament.location)
      const locationName = selectedTurf ? selectedTurf.name : tournament.location
      
      // Prepare tournament data
      const tournamentData = {
        ...tournament,
        location: locationName,
        createdById: currentUser.uid,
        createdByType: CreatedByType.USER,
        status: TournamentStatus.Upcoming,
        currentTeams: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
      
      // Add to Firestore
      const docRef = await addDoc(tournamentsRef, tournamentData)
      
      Alert.alert(
        'Success',
        'Tournament created successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      )
    } catch (error) {
      console.error('Error creating tournament:', error)
      Alert.alert('Error', 'Failed to create tournament. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = () => {
    if (!tournament.name.trim()) {
      Alert.alert('Error', 'Please enter tournament name')
      return false
    }
    if (!tournament.location) {
      Alert.alert('Error', 'Please select a venue')
      return false
    }
    if (tournament.entryFee < 0) {
      Alert.alert('Error', 'Entry fee cannot be negative')
      return false
    }
    if (tournament.prizePool <= 0) {
      Alert.alert('Error', 'Prize pool must be greater than 0')
      return false
    }
    if (tournament.teamCount < 2) {
      Alert.alert('Error', 'Maximum teams must be at least 2')
      return false
    }
    if ((tournament.minTeamSize ?? 1) < 1) {
      Alert.alert('Error', 'Minimum team size must be at least 1')
      return false
    }
    if ((tournament.maxTeamSize ?? 11) < (tournament.minTeamSize ?? 1)) {
      Alert.alert('Error', 'Maximum team size must be greater than or equal to minimum team size')
      return false
    }
    return true
  }

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false)
    if (selectedDate && activeDateInput) {
      setSelectedDate(selectedDate)
      
      switch (activeDateInput) {
        case 'registration':
          setTournament(prev => ({ ...prev, registrationDeadline: selectedDate }))
          break
        case 'start':
          setTournament(prev => ({ ...prev, startDate: selectedDate }))
          break
        case 'end':
          setTournament(prev => ({ ...prev, endDate: selectedDate }))
          break
      }
    }
    setActiveDateInput(null)
  }

  const showDatePickerFor = (inputType: 'registration' | 'start' | 'end') => {
    setActiveDateInput(inputType)
    setShowDatePicker(true)
  }

  const formatDate = (date?: Date) => {
    if (!date) return 'Select date'
    return format(date, 'dd/MM/yyyy')
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Create Tournament</Text>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleUnderline}
          />
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tournament Details Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Basic Details</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Tournament Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter tournament name"
              placeholderTextColor="#666666"
              value={tournament.name}
              onChangeText={(text) => setTournament(prev => ({ ...prev, name: text }))}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Sport</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={tournament.game}
                onValueChange={(value) => setTournament(prev => ({ ...prev, game: value }))}
                style={styles.picker}
                dropdownIconColor="#FFFFFF"
              >
                {sportsList.map((sport) => (
                  <Picker.Item key={sport} label={sport} value={sport} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Venue</Text>
            {isLoadingTurfs ? (
              <ActivityIndicator size="small" color="#FF9F45" />
            ) : (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={tournament.location}
                  onValueChange={(value) => setTournament(prev => ({ ...prev, location: value }))}
                  style={styles.picker}
                  dropdownIconColor="#FFFFFF"
                >
                  <Picker.Item label="Select venue" value="" />
                  {availableTurfs.map((turf) => (
                    <Picker.Item key={turf.id} label={turf.name} value={turf.id} />
                  ))}
                </Picker>
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Registration Deadline</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => showDatePickerFor('registration')}
            >
              <Text style={styles.datePickerText}>
                {tournament.registrationDeadline 
                  ? formatDate(tournament.registrationDeadline) 
                  : 'Select registration deadline'}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => showDatePickerFor('start')}
            >
              <Text style={styles.datePickerText}>
                {tournament.startDate 
                  ? formatDate(tournament.startDate) 
                  : 'Select start date'}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>End Date</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => showDatePickerFor('end')}
            >
              <Text style={styles.datePickerText}>
                {tournament.endDate 
                  ? formatDate(tournament.endDate) 
                  : 'Select end date'}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Private Tournament</Text>
            <View style={styles.switchContainer}>
              <Switch
                trackColor={{ false: "#767577", true: "#FF9F45" }}
                thumbColor={tournament.isPrivate ? "#D494FF" : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                onValueChange={(value) => setTournament(prev => ({ ...prev, isPrivate: value }))}
                value={tournament.isPrivate}
              />
              <Text style={styles.switchLabel}>
                {tournament.isPrivate ? 'Private' : 'Public'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Tournament Format</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Match Format</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={tournament.matchFormat}
                onValueChange={(value) => setTournament(prev => ({ ...prev, matchFormat: value }))}
                style={styles.picker}
                dropdownIconColor="#FFFFFF"
              >
                <Picker.Item label="Knockout" value={MatchFormat.Knockout} />
                <Picker.Item label="League" value={MatchFormat.League} />
                <Picker.Item label="Round Robin" value={MatchFormat.RoundRobin} />
              </Picker>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Maximum Teams</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter max teams"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={tournament.teamCount.toString()}
              onChangeText={(text) => {
                const value = parseInt(text) || 0
                setTournament(prev => ({ ...prev, teamCount: value }))
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Minimum Team Size</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter minimum team size"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={tournament.minTeamSize?.toString() || '1'}
              onChangeText={(text) => {
                const value = parseInt(text) || 1
                setTournament(prev => ({ ...prev, minTeamSize: value }))
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Maximum Team Size</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter maximum team size"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={tournament.maxTeamSize?.toString() || '11'}
              onChangeText={(text) => {
                const value = parseInt(text) || 11
                setTournament(prev => ({ ...prev, maxTeamSize: value }))
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Age Restriction (0 for none)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter age restriction"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={tournament.ageRestriction?.toString() || '0'}
              onChangeText={(text) => {
                const value = parseInt(text) || 0
                setTournament(prev => ({ ...prev, ageRestriction: value }))
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Skill Level</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter skill level (e.g., Beginner, Intermediate, Advanced)"
              placeholderTextColor="#666666"
              value={tournament.skillLevel || ''}
              onChangeText={(text) => setTournament(prev => ({ ...prev, skillLevel: text }))}
            />
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Financial Details</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Entry Fee (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter entry fee"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={tournament.entryFee.toString()}
              onChangeText={(text) => {
                const value = parseFloat(text) || 0
                setTournament(prev => ({ ...prev, entryFee: value }))
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Prize Pool (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter prize pool"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={tournament.prizePool.toString()}
              onChangeText={(text) => {
                const value = parseFloat(text) || 0
                setTournament(prev => ({ ...prev, prizePool: value }))
              }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Sponsors (comma separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter sponsors"
              placeholderTextColor="#666666"
              value={tournament.sponsors?.join(', ') || ''}
              onChangeText={(text) => {
                const sponsors = text.split(',').map(s => s.trim()).filter(s => s)
                setTournament(prev => ({ ...prev, sponsors }))
              }}
            />
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Additional Information</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter tournament description"
              placeholderTextColor="#666666"
              multiline
              numberOfLines={4}
              value={tournament.description}
              onChangeText={(text) => setTournament(prev => ({ ...prev, description: text }))}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Rules</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter tournament rules"
              placeholderTextColor="#666666"
              multiline
              numberOfLines={4}
              value={tournament.rules || ''}
              onChangeText={(text) => setTournament(prev => ({ ...prev, rules: text }))}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Streaming Link</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter streaming link"
              placeholderTextColor="#666666"
              value={tournament.streamingLink || ''}
              onChangeText={(text) => setTournament(prev => ({ ...prev, streamingLink: text }))}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contact Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact email"
              placeholderTextColor="#666666"
              keyboardType="email-address"
              value={tournament.contactEmail || ''}
              onChangeText={(text) => setTournament(prev => ({ ...prev, contactEmail: text }))}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Contact Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact phone"
              placeholderTextColor="#666666"
              keyboardType="phone-pad"
              value={tournament.contactPhone || ''}
              onChangeText={(text) => setTournament(prev => ({ ...prev, contactPhone: text }))}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Tags (comma separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter tags"
              placeholderTextColor="#666666"
              value={tournament.tags?.join(', ') || ''}
              onChangeText={(text) => {
                const tags = text.split(',').map(t => t.trim()).filter(t => t)
                setTournament(prev => ({ ...prev, tags }))
              }}
            />
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateTournament}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButtonGradient}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.createButtonText}>CREATE TOURNAMENT</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
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
  content: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: '#FFFFFF',
  },
  datePickerButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    color: '#FFFFFF',
    marginLeft: 10,
    fontSize: 16,
  },
  createButton: {
    marginVertical: 24,
  },
  createButtonGradient: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}) 