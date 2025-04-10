import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  stats: {
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    saves?: number;
  };
}

interface Team {
  id: string;
  name: string;
  players: Player[];
  formation: string;
  stats: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  };
}

interface Match {
  id: string;
  team1: Team;
  team2: Team;
  date: Date;
  venue: string;
  result?: {
    team1Score: number;
    team2Score: number;
    winner?: string;
  };
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  round: number;
  matchNumber: number;
}

interface Tournament {
  id: string;
  name: string;
  format: 'KNOCKOUT' | 'LEAGUE' | 'GROUP_STAGE';
  teams: Team[];
  matches: Match[];
  startDate: Date;
  endDate: Date;
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
  maxTeams: number;
  currentRound: number;
  rules: string[];
  prizePool: number;
  organizer: string;
  venue: string;
  groups?: {
    name: string;
    teams: string[];
  }[];
}

export default function FootballTournament() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTournament, setNewTournament] = useState<Partial<Tournament>>({
    name: '',
    format: 'KNOCKOUT',
    maxTeams: 16,
    rules: [],
    prizePool: 0,
    venue: '',
  });
  const { currentUser } = useAuth();
  const router = useRouter();
  const db = getFirestore();

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      const tournamentsRef = collection(db, 'tournaments');
      const q = query(tournamentsRef, where('type', '==', 'FOOTBALL'));
      const querySnapshot = await getDocs(q);
      
      const tournamentsData: Tournament[] = [];
      querySnapshot.forEach((doc) => {
        tournamentsData.push({ id: doc.id, ...doc.data() } as Tournament);
      });
      
      setTournaments(tournamentsData);
    } catch (error) {
      console.error('Error loading tournaments:', error);
      Alert.alert('Error', 'Failed to load tournaments');
    }
  };

  const handleCreateTournament = async () => {
    try {
      if (!newTournament.name || !newTournament.venue) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      const tournament = {
        ...newTournament,
        type: 'FOOTBALL',
        status: 'UPCOMING',
        teams: [],
        matches: [],
        currentRound: 0,
        organizer: currentUser?.uid,
        startDate: new Date(),
        endDate: new Date(),
      };

      await addDoc(collection(db, 'tournaments'), tournament);
      setShowCreateForm(false);
      loadTournaments();
    } catch (error) {
      console.error('Error creating tournament:', error);
      Alert.alert('Error', 'Failed to create tournament');
    }
  };

  const generateSchedule = async (tournamentId: string, teams: Team[]) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return;

    const matches: Match[] = [];
    let matchNumber = 1;

    if (tournament.format === 'KNOCKOUT') {
      // Generate knockout matches
      let round = 1;
      let roundTeams = [...teams];
      
      while (roundTeams.length > 1) {
        for (let i = 0; i < roundTeams.length; i += 2) {
          if (i + 1 < roundTeams.length) {
            matches.push({
              id: `${tournamentId}_${matchNumber}`,
              team1: roundTeams[i],
              team2: roundTeams[i + 1],
              date: new Date(),
              venue: tournament.venue,
              status: 'SCHEDULED',
              round,
              matchNumber,
            });
            matchNumber++;
          }
        }
        roundTeams = roundTeams.filter((_, index) => index % 2 === 0);
        round++;
      }
    } else if (tournament.format === 'LEAGUE') {
      // Generate league matches (home and away)
      for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams.length; j++) {
          if (i !== j) {
            matches.push({
              id: `${tournamentId}_${matchNumber}`,
              team1: teams[i],
              team2: teams[j],
              date: new Date(),
              venue: tournament.venue,
              status: 'SCHEDULED',
              round: 1,
              matchNumber,
            });
            matchNumber++;
          }
        }
      }
    } else if (tournament.format === 'GROUP_STAGE') {
      // Generate group stage matches
      const groupCount = Math.ceil(teams.length / 4);
      const groups: { name: string; teams: string[] }[] = [];

      // Create groups
      for (let i = 0; i < groupCount; i++) {
        const groupTeams = teams.slice(i * 4, (i + 1) * 4).map(t => t.id);
        groups.push({
          name: String.fromCharCode(65 + i), // A, B, C, etc.
          teams: groupTeams,
        });
      }

      // Generate matches within each group
      groups.forEach(group => {
        const groupTeams = teams.filter(t => group.teams.includes(t.id));
        for (let i = 0; i < groupTeams.length; i++) {
          for (let j = i + 1; j < groupTeams.length; j++) {
            matches.push({
              id: `${tournamentId}_${matchNumber}`,
              team1: groupTeams[i],
              team2: groupTeams[j],
              date: new Date(),
              venue: tournament.venue,
              status: 'SCHEDULED',
              round: 1,
              matchNumber,
            });
            matchNumber++;
          }
        }
      });

      // Update tournament with groups
      await updateDoc(doc(db, 'tournaments', tournamentId), { groups });
    }

    // Update tournament with generated matches
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      matches,
      status: 'IN_PROGRESS',
    });

    loadTournaments();
  };

  const startMatch = (matchId: string) => {
    router.push({
      pathname: "/(tournament)/football-match",
      params: { matchId }
    });
  };

  const viewTeams = (tournamentId: string) => {
    router.push({
      pathname: "/(tournament)/football-team",
      params: { tournamentId }
    });
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => setShowCreateForm(true)}
      >
        <Text style={styles.createButtonText}>Create Tournament</Text>
      </TouchableOpacity>

      {showCreateForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Tournament Name"
            value={newTournament.name}
            onChangeText={(text) => setNewTournament({ ...newTournament, name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Venue"
            value={newTournament.venue}
            onChangeText={(text) => setNewTournament({ ...newTournament, venue: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Prize Pool"
            value={newTournament.prizePool?.toString()}
            keyboardType="numeric"
            onChangeText={(text) => setNewTournament({ ...newTournament, prizePool: parseInt(text) || 0 })}
          />
          <View style={styles.formatButtons}>
            {['KNOCKOUT', 'LEAGUE', 'GROUP_STAGE'].map((format) => (
              <TouchableOpacity
                key={format}
                style={[
                  styles.formatButton,
                  newTournament.format === format && styles.formatButtonActive,
                ]}
                onPress={() => setNewTournament({ ...newTournament, format: format as Tournament['format'] })}
              >
                <Text>{format.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.submitButton} onPress={handleCreateTournament}>
            <Text style={styles.submitButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      )}

      {tournaments.map((tournament) => (
        <View key={tournament.id} style={styles.tournamentCard}>
          <Text style={styles.tournamentName}>{tournament.name}</Text>
          <Text>Format: {tournament.format.replace('_', ' ')}</Text>
          <Text>Teams: {tournament.teams.length}/{tournament.maxTeams}</Text>
          <Text>Status: {tournament.status}</Text>
          
          <View style={styles.tournamentActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => viewTeams(tournament.id)}
            >
              <MaterialIcons name="group" size={24} color="white" />
              <Text style={styles.actionButtonText}>Teams</Text>
            </TouchableOpacity>

            {tournament.status === 'UPCOMING' && tournament.teams.length >= 2 && (
              <TouchableOpacity
                style={[styles.actionButton, styles.startButton]}
                onPress={() => generateSchedule(tournament.id, tournament.teams)}
              >
                <MaterialIcons name="play-arrow" size={24} color="white" />
                <Text style={styles.actionButtonText}>Start</Text>
              </TouchableOpacity>
            )}
          </View>

          {tournament.status === 'IN_PROGRESS' && (
            <View style={styles.matchesList}>
              <Text style={styles.matchesTitle}>Matches</Text>
              {tournament.matches.map((match) => (
                <TouchableOpacity
                  key={match.id}
                  style={styles.matchCard}
                  onPress={() => startMatch(match.id)}
                >
                  <Text style={styles.matchTeams}>
                    {match.team1.name} vs {match.team2.name}
                  </Text>
                  <Text style={styles.matchInfo}>
                    Round {match.round} - Match {match.matchNumber}
                  </Text>
                  <Text style={styles.matchStatus}>{match.status}</Text>
                  {match.result && (
                    <Text style={styles.matchResult}>
                      {typeof match.result === 'string' 
                        ? match.result 
                        : `${match.result.team1Score} - ${match.result.team2Score}${match.result.winner ? ` (${match.result.winner})` : ''}`
                      }
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  createButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  form: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
  },
  formatButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  formatButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  formatButtonActive: {
    backgroundColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
  },
  submitButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tournamentCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  tournamentName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tournamentActions: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  actionButtonText: {
    color: 'white',
    marginLeft: 8,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  matchesList: {
    marginTop: 16,
  },
  matchesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  matchCard: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  matchTeams: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  matchInfo: {
    color: '#666',
    marginTop: 4,
  },
  matchStatus: {
    color: '#2196F3',
    marginTop: 4,
  },
  matchResult: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
}); 