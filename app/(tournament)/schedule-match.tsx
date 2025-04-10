import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

/* 
 * This function handles the cricket format for overs
 * In cricket, 1.1 means 1 over and 1 ball (not 1.1 overs)
 * In Firestore, overs are stored as decimal values:
 * 1.0 = 1 over 0 balls
 * 1.1666... = 1 over 1 ball
 * 1.3333... = 1 over 2 balls
 * 1.5 = 1 over 3 balls
 * 1.6666... = 1 over 4 balls
 * 1.8333... = 1 over 5 balls
 */
const formatOvers = (value: number): string => {
  if (value === undefined || value === null || value === 0) return "0.0";
  
  // Get the whole number part (full overs)
  const fullOvers = Math.floor(value);
  
  // Get the decimal part and convert to balls (with appropriate rounding)
  const decimalPart = value - fullOvers;
  
  // Map common Firestore decimal values to actual balls
  if (decimalPart < 0.01) return `${fullOvers}.0`;
  if (decimalPart >= 0.16 && decimalPart < 0.25) return `${fullOvers}.1`;
  if (decimalPart >= 0.25 && decimalPart < 0.41) return `${fullOvers}.2`;
  if (decimalPart >= 0.41 && decimalPart < 0.58) return `${fullOvers}.3`;
  if (decimalPart >= 0.58 && decimalPart < 0.75) return `${fullOvers}.4`;
  if (decimalPart >= 0.75 && decimalPart < 0.99) return `${fullOvers}.5`;
  
  // Default calculation for any other values
  const balls = Math.floor(decimalPart * 6);
  return `${fullOvers}.${balls}`;
};

interface Team {
  id: string;
  name: string;
  game: string;
  players?: Player[];
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
  firstInningsTeam?: string;
  secondInningsTeam?: string;
  result?: {
    winner?: string;
    team1Score?: number | string;
    team2Score?: number | string;
    summary?: string;
    firstInningsScore?: number;
    firstInningsWickets?: number;
    firstInningsOvers?: number;
    secondInningsScore?: number;
    secondInningsWickets?: number;
    secondInningsOvers?: number;
    winningMargin?: string;
    winningMethod?: string;
  };
  team1?: {
    score: number;
    wickets: number;
    overs: number;
    extras?: {
      wides: number;
      noBalls: number;
      byes: number;
      legByes: number;
    };
    possession: number;
    shots: number;
    shotsOnTarget: number;
    fouls: number;
    yellowCards: number;
    redCards: number;
    players?: Player[];
  };
  team2?: {
    score: number;
    wickets: number;
    overs: number;
    extras?: {
      wides: number;
      noBalls: number;
      byes: number;
      legByes: number;
    };
    possession: number;
    shots: number;
    shotsOnTarget: number;
    fouls: number;
    yellowCards: number;
    redCards: number;
    players?: Player[];
  };
}

interface BattingStats {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dismissalType?: string;
  dismissalBowler?: string;
  dismissalFielder?: string;
}

interface BowlingStats {
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
  deliveries: number;
}

interface Player {
  id: string;
  name: string;
  battingStats: BattingStats;
  bowlingStats: BowlingStats;
}

export default function ScheduleMatch() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [newMatch, setNewMatch] = useState<Partial<Match>>({
    status: 'SCHEDULED',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showMatchStats, setShowMatchStats] = useState(false);

  const { currentUser } = useAuth();
  const router = useRouter();
  const { tournamentId, game } = useLocalSearchParams();
  const db = getFirestore();

  useEffect(() => {

    if (!tournamentId) {
      setError('No tournament ID provided');
      setLoading(false);
      return;
    }

      loadTeams();
      loadMatches();
  }, [tournamentId]);

  const loadTeams = async () => {
    try {
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('tournamentId', '==', tournamentId));
      const querySnapshot = await getDocs(q);
      
      const teamsData: Team[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        teamsData.push({
          id: doc.id,
          name: data.name,
          game: data.game,
        });
      });
      
      setTeams(teamsData);
    } catch (error) {
      console.error('Error loading teams:', error);
      Alert.alert('Error', 'Failed to load teams');
    }
  };

  const loadMatches = async () => {
    try {

      const matchesRef = collection(db, 'matches');
      const q = query(matchesRef, where('tournamentId', '==', tournamentId));
      const querySnapshot = await getDocs(q);
      
      const matchesData: Match[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        
        const matchDate = data.date?.toDate() || new Date();
        
        const mapPlayerStats = (player: any) => {
          
          return {
            id: player.id,
            name: player.name,
            battingStats: {
              runs: player.battingStats?.runs || 0,
              balls: player.battingStats?.balls || 0,
              fours: player.battingStats?.fours || 0,
              sixes: player.battingStats?.sixes || 0,
              strikeRate: player.battingStats?.strikeRate || 0,
              dismissalType: player.battingStats?.dismissalType,
              dismissalBowler: player.battingStats?.dismissalBowler,
              dismissalFielder: player.battingStats?.dismissalFielder,
            },
            bowlingStats: {
              overs: player.bowlingStats?.overs || 0,
              maidens: player.bowlingStats?.maidens || 0,
              runs: player.bowlingStats?.runs || 0,
              wickets: player.bowlingStats?.wickets || 0,
              economy: player.bowlingStats?.economy || 0,
              wides: player.bowlingStats?.wides || 0,
              noBalls: player.bowlingStats?.noBalls || 0,
              deliveries: player.bowlingStats?.deliveries || 0,
            },
          };
        };

        const team1 = {
          score: data.team1?.score || 0,
          wickets: data.team1?.wickets || 0,
          overs: data.team1?.overs || 0,
          extras: data.team1?.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
          possession: data.team1?.possession || 0,
          shots: data.team1?.shots || 0,
          shotsOnTarget: data.team1?.shotsOnTarget || 0,
          fouls: data.team1?.fouls || 0,
          yellowCards: data.team1?.yellowCards || 0,
          redCards: data.team1?.redCards || 0,
          players: data.team1?.players?.map(mapPlayerStats) || [],
        };

        const team2 = {
          score: data.team2?.score || 0,
          wickets: data.team2?.wickets || 0,
          overs: data.team2?.overs || 0,
          extras: data.team2?.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
          possession: data.team2?.possession || 0,
          shots: data.team2?.shots || 0,
          shotsOnTarget: data.team2?.shotsOnTarget || 0,
          fouls: data.team2?.fouls || 0,
          yellowCards: data.team2?.yellowCards || 0,
          redCards: data.team2?.redCards || 0,
          players: data.team2?.players?.map(mapPlayerStats) || [],
        };

        const match: Match = {
          id: doc.id,
          tournamentId: data.tournamentId,
          team1Id: data.team1Id,
          team2Id: data.team2Id,
          date: matchDate,
          time: data.time,
          venue: data.venue,
          status: data.status || 'SCHEDULED',
          game: data.game,
          firstInningsTeam: data.firstInningsTeam,
          secondInningsTeam: data.secondInningsTeam,
          result: data.result || undefined,
          team1,
          team2,
        };
        
        matchesData.push(match);
      });
      
      
      const sortedMatches = matchesData.sort((a, b) => {
        if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
        if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
        
        if (a.status === 'SCHEDULED' && b.status === 'SCHEDULED') {
          return a.date.getTime() - b.date.getTime();
        }
        
        if (a.status === 'COMPLETED' && b.status === 'COMPLETED') {
          return b.date.getTime() - a.date.getTime();
        }
        
        return a.date.getTime() - b.date.getTime();
      });
      
      setMatches(sortedMatches);
    } catch (error) {
      console.error('Error loading matches:', error);
      Alert.alert('Error', 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMatch = async () => {
    try {
      if (!newMatch.team1Id || !newMatch.team2Id || !newMatch.date || !newMatch.time || !newMatch.venue) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      if (newMatch.team1Id === newMatch.team2Id) {
        Alert.alert('Error', 'Please select different teams');
        return;
      }

      if (newMatch.date && newMatch.date < new Date()) {
        Alert.alert('Error', 'Match date cannot be in the past');
        return;
      }

      const match = {
        ...newMatch,
        tournamentId,
        game,
        status: 'SCHEDULED',
      };

      await addDoc(collection(db, 'matches'), match);
      setShowScheduleForm(false);
      setNewMatch({
        status: 'SCHEDULED',
      });
      loadMatches();
      Alert.alert('Success', 'Match scheduled successfully');
    } catch (error) {
      console.error('Error scheduling match:', error);
      Alert.alert('Error', 'Failed to schedule match');
    }
  };

  const handleCancelMatch = async (matchId: string) => {
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        status: 'CANCELLED'
      });
      loadMatches();
      Alert.alert('Success', 'Match cancelled successfully');
    } catch (error) {
      console.error('Error cancelling match:', error);
      Alert.alert('Error', 'Failed to cancel match');
    }
  };

  const handleStartMatch = async (matchId: string) => {
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        status: 'IN_PROGRESS',
        startTime: new Date(),
        currentInnings: 1,
        currentTime: 0,
        period: 'FIRST_HALF',
        team1: {
          score: 0,
          wickets: 0,
          overs: 0,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
          possession: 0,
          shots: 0,
          shotsOnTarget: 0,
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
        },
        team2: {
          score: 0,
          wickets: 0,
          overs: 0,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
          possession: 0,
          shots: 0,
          shotsOnTarget: 0,
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
        }
      });

      const path = game === 'Cricket' ? '/(tournament)/cricket-match' : '/(tournament)/football-match';
      router.push({
        pathname: path,
        params: { matchId }
      });
    } catch (error) {
      console.error('Error starting match:', error);
      Alert.alert('Error', 'Failed to start match');
    }
  };

  const getTeamName = (teamId: string) => {
    return teams.find(team => team.id === teamId)?.name || 'Unknown Team';
  };

  const formatDate = (date: Date) => {
    return format(date, 'EEE, MMM d, yyyy');
  };

  const MatchStatsModal = ({ match, visible, onClose }: { match: Match; visible: boolean; onClose: () => void }) => {
    if (!match) return null;

    // Get the team objects based on firstInningsTeam and secondInningsTeam IDs
    const firstInningsTeamId = match.firstInningsTeam;
    const secondInningsTeamId = match.secondInningsTeam;

    // Get the batting teams for each innings
    const firstInningsTeam = match.team1Id === firstInningsTeamId ? match.team1 : match.team2;
    const secondInningsTeam = match.team1Id === secondInningsTeamId ? match.team1 : match.team2;

    // Get the bowling teams for each innings
    const firstInningsBowlingTeam = match.team1Id === firstInningsTeamId ? match.team2 : match.team1;
    const secondInningsBowlingTeam = match.team1Id === secondInningsTeamId ? match.team2 : match.team1;

    // Get the result data for each innings
    const firstInningsScore = match.result?.firstInningsScore || firstInningsTeam?.score || 69;
    const firstInningsWickets = match.result?.firstInningsWickets || firstInningsTeam?.wickets || 5;
    const firstInningsOvers = match.result?.firstInningsOvers || firstInningsTeam?.overs || 5.4;

    const secondInningsScore = match.result?.secondInningsScore || secondInningsTeam?.score || 29;
    const secondInningsWickets = match.result?.secondInningsWickets || secondInningsTeam?.wickets || 4;
    const secondInningsOvers = match.result?.secondInningsOvers || secondInningsTeam?.overs || 2.2;



    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.statsModalTitle}>Match Statistics</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.matchSummary}>
                <Text style={styles.teamScoreContainer}>
                  <Text style={styles.teamName}>{getTeamName(firstInningsTeamId || '')}</Text>
                  <Text style={styles.summaryText}>
                    {` ${firstInningsScore}/${firstInningsWickets} (${formatOvers(firstInningsOvers)})`}
                  </Text>
                </Text>
                <Text style={styles.teamScoreContainer}>
                  <Text style={styles.teamName}>{getTeamName(secondInningsTeamId || '')}</Text>
                  <Text style={styles.summaryText}>
                    {` ${secondInningsScore}/${secondInningsWickets} (${formatOvers(secondInningsOvers)})`}
                  </Text>
                </Text>
              </View>

              <View style={styles.inningsSection}>
                <Text style={styles.inningsTitle}>First Innings - {getTeamName(firstInningsTeamId || '')}</Text>
                
                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Batting</Text>
                  <View style={styles.statsTable}>
                    <View style={styles.statsHeader}>
                      <Text style={[styles.statsHeaderText, { flex: 2 }]}>Batter</Text>
                      <Text style={styles.statsHeaderText}>R</Text>
                      <Text style={styles.statsHeaderText}>B</Text>
                      <Text style={styles.statsHeaderText}>4s</Text>
                      <Text style={styles.statsHeaderText}>6s</Text>
                      <Text style={styles.statsHeaderText}>SR</Text>
                    </View>
                    {firstInningsTeam?.players?.map((player) => (
                      <View key={player.id} style={styles.statsRow}>
                        <View style={[styles.playerNameContainer, { flex: 2 }]}>
                          <Text style={styles.playerName}>{player.name}</Text>
                          {player.battingStats?.dismissalType && (
                            <Text style={styles.dismissalInfo}>
                              {player.battingStats.dismissalType.toLowerCase()}
                              {player.battingStats.dismissalBowler ? ` b ${player.battingStats.dismissalBowler}` : ''}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.statsText}>{player.battingStats?.runs || 0}</Text>
                        <Text style={styles.statsText}>{player.battingStats?.balls || 0}</Text>
                        <Text style={styles.statsText}>{player.battingStats?.fours || 0}</Text>
                        <Text style={styles.statsText}>{player.battingStats?.sixes || 0}</Text>
                        <Text style={styles.statsText}>{player.battingStats?.strikeRate || 0}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Bowling - {getTeamName(firstInningsTeamId === match.team1Id ? match.team2Id : match.team1Id)}</Text>
                  <View style={styles.statsTable}>
                    <View style={styles.statsHeader}>
                      <Text style={[styles.statsHeaderText, { flex: 2 }]}>Bowler</Text>
                      <Text style={styles.statsHeaderText}>O</Text>
                      <Text style={styles.statsHeaderText}>M</Text>
                      <Text style={styles.statsHeaderText}>R</Text>
                      <Text style={styles.statsHeaderText}>W</Text>
                      <Text style={styles.statsHeaderText}>Econ</Text>
                    </View>
                    {firstInningsBowlingTeam?.players?.map((player) => (
                      <View key={player.id} style={styles.statsRow}>
                        <View style={[styles.playerNameContainer, { flex: 2 }]}>
                          <Text style={styles.playerName}>{player.name}</Text>
                        </View>
                        <Text style={styles.statsText}>{formatOvers(player.bowlingStats?.overs || 0)}</Text>
                        <Text style={styles.statsText}>{player.bowlingStats?.maidens || 0}</Text>
                        <Text style={styles.statsText}>{player.bowlingStats?.runs || 0}</Text>
                        <Text style={styles.statsText}>{player.bowlingStats?.wickets || 0}</Text>
                        <Text style={styles.statsText}>{player.bowlingStats?.economy || 0}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Extras</Text>
                  <View style={styles.extrasContainer}>
                    <View style={styles.extrasRow}>
                      <Text style={styles.extrasLabel}>Wides</Text>
                      <Text style={styles.extrasValue}>{firstInningsTeam?.extras?.wides || 0}</Text>
                    </View>
                    <View style={styles.extrasRow}>
                      <Text style={styles.extrasLabel}>No Balls</Text>
                      <Text style={styles.extrasValue}>{firstInningsTeam?.extras?.noBalls || 0}</Text>
                    </View>
                    <View style={styles.extrasRow}>
                      <Text style={styles.extrasLabel}>Byes</Text>
                      <Text style={styles.extrasValue}>{firstInningsTeam?.extras?.byes || 0}</Text>
                    </View>
                    <View style={styles.extrasRow}>
                      <Text style={styles.extrasLabel}>Leg Byes</Text>
                      <Text style={styles.extrasValue}>{firstInningsTeam?.extras?.legByes || 0}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.inningsSection}>
                <Text style={styles.inningsTitle}>Second Innings - {getTeamName(secondInningsTeamId || '')}</Text>
                
                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Batting</Text>
                  <View style={styles.statsTable}>
                    <View style={styles.statsHeader}>
                      <Text style={[styles.statsHeaderText, { flex: 2 }]}>Batter</Text>
                      <Text style={styles.statsHeaderText}>R</Text>
                      <Text style={styles.statsHeaderText}>B</Text>
                      <Text style={styles.statsHeaderText}>4s</Text>
                      <Text style={styles.statsHeaderText}>6s</Text>
                      <Text style={styles.statsHeaderText}>SR</Text>
                    </View>
                    {secondInningsTeam?.players?.map((player) => (
                      <View key={player.id} style={styles.statsRow}>
                        <View style={[styles.playerNameContainer, { flex: 2 }]}>
                          <Text style={styles.playerName}>{player.name}</Text>
                          {player.battingStats?.dismissalType && (
                            <Text style={styles.dismissalInfo}>
                              {player.battingStats.dismissalType.toLowerCase()}
                              {player.battingStats.dismissalBowler ? ` b ${player.battingStats.dismissalBowler}` : ''}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.statsText}>{player.battingStats?.runs || 0}</Text>
                        <Text style={styles.statsText}>{player.battingStats?.balls || 0}</Text>
                        <Text style={styles.statsText}>{player.battingStats?.fours || 0}</Text>
                        <Text style={styles.statsText}>{player.battingStats?.sixes || 0}</Text>
                        <Text style={styles.statsText}>{player.battingStats?.strikeRate || 0}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Bowling - {getTeamName(secondInningsTeamId === match.team1Id ? match.team2Id : match.team1Id)}</Text>
                  <View style={styles.statsTable}>
                    <View style={styles.statsHeader}>
                      <Text style={[styles.statsHeaderText, { flex: 2 }]}>Bowler</Text>
                      <Text style={styles.statsHeaderText}>O</Text>
                      <Text style={styles.statsHeaderText}>M</Text>
                      <Text style={styles.statsHeaderText}>R</Text>
                      <Text style={styles.statsHeaderText}>W</Text>
                      <Text style={styles.statsHeaderText}>Econ</Text>
                    </View>
                    {secondInningsBowlingTeam?.players?.map((player) => (
                      <View key={player.id} style={styles.statsRow}>
                        <View style={[styles.playerNameContainer, { flex: 2 }]}>
                          <Text style={styles.playerName}>{player.name}</Text>
                        </View>
                        <Text style={styles.statsText}>{formatOvers(player.bowlingStats?.overs || 0)}</Text>
                        <Text style={styles.statsText}>{player.bowlingStats?.maidens || 0}</Text>
                        <Text style={styles.statsText}>{player.bowlingStats?.runs || 0}</Text>
                        <Text style={styles.statsText}>{player.bowlingStats?.wickets || 0}</Text>
                        <Text style={styles.statsText}>{player.bowlingStats?.economy || 0}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Extras</Text>
                  <View style={styles.extrasContainer}>
                    <View style={styles.extrasRow}>
                      <Text style={styles.extrasLabel}>Wides</Text>
                      <Text style={styles.extrasValue}>{secondInningsTeam?.extras?.wides || 0}</Text>
                    </View>
                    <View style={styles.extrasRow}>
                      <Text style={styles.extrasLabel}>No Balls</Text>
                      <Text style={styles.extrasValue}>{secondInningsTeam?.extras?.noBalls || 0}</Text>
                    </View>
                    <View style={styles.extrasRow}>
                      <Text style={styles.extrasLabel}>Byes</Text>
                      <Text style={styles.extrasValue}>{secondInningsTeam?.extras?.byes || 0}</Text>
                    </View>
                    <View style={styles.extrasRow}>
                      <Text style={styles.extrasLabel}>Leg Byes</Text>
                      <Text style={styles.extrasValue}>{secondInningsTeam?.extras?.legByes || 0}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.resultContainer}>
                <Text style={styles.resultText}>
                  {match.result?.winner ? getTeamName(match.result.winner) : ''}
                  {match.game === 'Cricket' && match.result?.winningMethod
                    ? ` by ${match.result?.winningMargin} ${match.result?.winningMethod}`
                    : match.result?.summary ? ` (${match.result?.summary})` : ''}
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9F45" />
        <Text style={styles.loadingText}>Loading matches...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.scheduleButton}
        onPress={() => setShowScheduleForm(true)}
      >
        <LinearGradient
          colors={['#FF9F45', '#D494FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scheduleGradient}
        >
          <Text style={styles.scheduleButtonText}>Schedule New Match</Text>
        </LinearGradient>
      </TouchableOpacity>

      {showScheduleForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Schedule Match</Text>
          
          <View style={styles.teamSelectors}>
            <View style={styles.teamSelector}>
              <Text style={styles.label}>Team 1</Text>
              <ScrollView style={styles.teamList}>
                {teams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[
                      styles.teamOption,
                      newMatch.team1Id === team.id && styles.teamOptionSelected,
                    ]}
                    onPress={() => setNewMatch({ ...newMatch, team1Id: team.id })}
                  >
                    <Text style={[
                      styles.teamOptionText,
                      newMatch.team1Id === team.id && styles.teamOptionTextSelected
                    ]}>{team.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <View style={styles.teamSelector}>
              <Text style={styles.label}>Team 2</Text>
              <ScrollView style={styles.teamList}>
                {teams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[
                      styles.teamOption,
                      newMatch.team2Id === team.id && styles.teamOptionSelected,
                    ]}
                    onPress={() => setNewMatch({ ...newMatch, team2Id: team.id })}
                  >
                    <Text style={[
                      styles.teamOptionText,
                      newMatch.team2Id === team.id && styles.teamOptionTextSelected
                    ]}>{team.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <MaterialIcons name="event" size={20} color="#FF9F45" />
            <Text style={styles.dateButtonText}>
              {newMatch.date ? formatDate(newMatch.date) : 'Select Date'}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={newMatch.date || new Date()}
              mode="date"
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) {
                  setNewMatch({ ...newMatch, date });
                }
              }}
            />
          )}

          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <MaterialIcons name="access-time" size={20} color="#FF9F45" />
            <Text style={styles.timeButtonText}>
              {newMatch.time || 'Select Time'}
            </Text>
          </TouchableOpacity>

          {showTimePicker && (
            <DateTimePicker
              value={new Date()}
              mode="time"
              onChange={(event, date) => {
                setShowTimePicker(false);
                if (date) {
                  setNewMatch({
                    ...newMatch,
                    time: format(date, 'h:mm a'),
                  });
                }
              }}
            />
          )}

          <View style={styles.venueInputContainer}>
            <MaterialIcons name="location-on" size={20} color="#FF9F45" />
            <TextInput
              style={styles.venueInput}
              placeholder="Enter Venue"
              placeholderTextColor="#666"
              value={newMatch.venue}
              onChangeText={(text) => setNewMatch({ ...newMatch, venue: text })}
            />
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleScheduleMatch}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitButtonText}>Schedule Match</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowScheduleForm(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.matchesList}>
        <Text style={styles.sectionTitle}>Scheduled Matches</Text>
        {matches
          .filter(match => match.status === 'SCHEDULED')
          .map((match) => (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <View style={styles.matchDateTime}>
                  <MaterialIcons name="event" size={16} color="#FF9F45" />
                  <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
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

              <View style={styles.matchActions}>
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={() => handleStartMatch(match.id)}
                >
                  <LinearGradient
                    colors={['#4BB543', '#45FF9F']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionGradient}
                  >
                    <Text style={styles.actionButtonText}>Start Match</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelMatchButton}
                  onPress={() => handleCancelMatch(match.id)}
                >
                  <LinearGradient
                    colors={['#FF4545', '#FF9F45']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionGradient}
                  >
                    <Text style={styles.actionButtonText}>Cancel Match</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ))}
      </View>

      <View style={styles.matchesList}>
        <Text style={styles.sectionTitle}>Live Matches</Text>
        {matches
          .filter(match => match.status === 'IN_PROGRESS' || match.status === 'LIVE')
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
                  <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
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
                  {match.game === 'Cricket' ? (
                    <Text style={styles.teamScore}>
                      {match.team1Id === match.firstInningsTeam 
                        ? (match.result?.firstInningsScore || 0) 
                        : (match.result?.secondInningsScore || 0)
                      }/{match.team1Id === match.firstInningsTeam 
                        ? (match.result?.firstInningsWickets || 0) 
                        : (match.result?.secondInningsWickets || 0)
                      }
                      {' ('}
                      {formatOvers(match.team1Id === match.firstInningsTeam 
                        ? (match.result?.firstInningsOvers || 0) 
                        : (match.result?.secondInningsOvers || 0)
                      )}
                      {')'}
                    </Text>
                  ) : (
                  <Text style={styles.teamScore}>{match.team1?.score || 0}</Text>
                  )}
                </View>
                <View style={styles.vsContainer}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
                <View style={styles.teamSide}>
                  <View style={styles.teamLogo} />
                  <Text style={styles.teamName}>{getTeamName(match.team2Id)}</Text>
                  {match.game === 'Cricket' ? (
                    <Text style={styles.teamScore}>
                      {match.team2Id === match.firstInningsTeam 
                        ? (match.result?.firstInningsScore || 0) 
                        : (match.result?.secondInningsScore || 0)
                      }/{match.team2Id === match.firstInningsTeam 
                        ? (match.result?.firstInningsWickets || 0) 
                        : (match.result?.secondInningsWickets || 0)
                      }
                      {' ('}
                      {formatOvers(match.team2Id === match.firstInningsTeam 
                        ? (match.result?.firstInningsOvers || 0) 
                        : (match.result?.secondInningsOvers || 0)
                      )}
                      {')'}
                    </Text>
                  ) : (
                  <Text style={styles.teamScore}>{match.team2?.score || 0}</Text>
                  )}
                </View>
              </View>
              <View style={styles.liveIndicatorContainer}>
                <Text style={styles.liveIndicator}>LIVE</Text>
                <Text style={styles.updateScoreText}>Tap to update scores</Text>
              </View>
            </TouchableOpacity>
          ))}
      </View>

      <View style={styles.matchesList}>
        <Text style={styles.sectionTitle}>Completed Matches</Text>
        {matches
          .filter(match => match.status === 'COMPLETED')
          .map((match) => (
            <TouchableOpacity
              key={match.id}
              style={styles.matchCard}
              onPress={() => {
                setSelectedMatch(match);
                setShowMatchStats(true);
              }}
            >
              <View style={styles.matchHeader}>
                <View style={styles.matchDateTime}>
                  <MaterialIcons name="event" size={16} color="#FF9F45" />
                  <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
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
                  <Text style={styles.teamScore}>
                    {match.game === 'Cricket' 
                      ? `${match.team1Id === match.firstInningsTeam 
                          ? (match.result?.firstInningsScore || 0) 
                          : (match.result?.secondInningsScore || 0)
                        }/${match.team1Id === match.firstInningsTeam 
                          ? (match.result?.firstInningsWickets || 0) 
                          : (match.result?.secondInningsWickets || 0)
                        } (${formatOvers(match.team1Id === match.firstInningsTeam 
                          ? (match.result?.firstInningsOvers || 0) 
                          : (match.result?.secondInningsOvers || 0)
                        )})`
                      : match.result?.team1Score || match.team1?.score || 0
                    }
                  </Text>
                </View>
                <View style={styles.vsContainer}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
                <View style={styles.teamSide}>
                  <View style={styles.teamLogo} />
                  <Text style={styles.teamName}>{getTeamName(match.team2Id)}</Text>
                  <Text style={styles.teamScore}>
                    {match.game === 'Cricket'
                      ? `${match.team2Id === match.firstInningsTeam 
                          ? (match.result?.firstInningsScore || 0) 
                          : (match.result?.secondInningsScore || 0)
                        }/${match.team2Id === match.firstInningsTeam 
                          ? (match.result?.firstInningsWickets || 0) 
                          : (match.result?.secondInningsWickets || 0)
                        } (${formatOvers(match.team2Id === match.firstInningsTeam 
                          ? (match.result?.firstInningsOvers || 0) 
                          : (match.result?.secondInningsOvers || 0)
                        )})`
                      : match.result?.team2Score || match.team2?.score || 0
                    }
                  </Text>
                </View>
              </View>

              {match.result && (
                <View style={styles.result}>
                  <Text style={styles.winner}>
                    {getTeamName(match.result.winner || '')}
                    {match.game === 'Cricket' && match.result.winningMethod
                      ? ` by ${match.result.winningMargin} ${match.result.winningMethod}`                      : match.result.summary ? ` (${match.result.summary})` : ''
                    }
                  </Text>
                  {match.result.summary && match.game === 'Cricket' && (
                    <Text style={styles.summary}>{match.result.summary}</Text>
                  )}
                </View>
              )}

              {match.game === 'Football' && match.team1 && match.team2 && (
                <View style={styles.matchStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Possession</Text>
                    <Text style={styles.statValue}>{match.team1.possession}% - {match.team2.possession}%</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Shots (On Target)</Text>
                    <Text style={styles.statValue}>
                      {match.team1.shots}({match.team1.shotsOnTarget}) - {match.team2.shots}({match.team2.shotsOnTarget})
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}
      </View>

      {selectedMatch && (
        <MatchStatsModal
          match={selectedMatch}
          visible={showMatchStats}
          onClose={() => {
            setShowMatchStats(false);
            setSelectedMatch(null);
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  scheduleButton: {
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#FF9F45',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  scheduleGradient: {
    borderRadius: 28,
    padding: 1,
  },
  scheduleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#121212',
    margin: 1,
    padding: 16,
    borderRadius: 27,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  form: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  teamSelectors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
  },
  teamSelector: {
    flex: 1,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  teamList: {
    maxHeight: 150,
  },
  teamOption: {
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#333',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#121212',
  },
  teamOptionSelected: {
    borderColor: '#FF9F45',
    backgroundColor: 'rgba(255, 159, 69, 0.15)',
  },
  teamOptionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  teamOptionTextSelected: {
    color: '#FF9F45',
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1.5,
    borderColor: '#333',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  dateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1.5,
    borderColor: '#333',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  timeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  venueInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1.5,
    borderColor: '#333',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  venueInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  formActions: {
    gap: 12,
  },
  submitButton: {
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#FF9F45',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  submitGradient: {
    borderRadius: 28,
    padding: 1,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#121212',
    margin: 1,
    padding: 16,
    borderRadius: 27,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  cancelButton: {
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 28,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  matchesList: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  matchCard: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  matchHeader: {
    marginBottom: 16,
    gap: 10,
  },
  matchDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchDate: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  matchTime: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  matchVenue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  venueText: {
    color: '#CCCCCC',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  teamSide: {
    alignItems: 'center',
    flex: 2,
  },
  teamLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2A2A2A',
    marginBottom: 12,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  vsContainer: {
    flex: 1,
    alignItems: 'center',
  },
  vsText: {
    color: '#FF9F45',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  matchActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  startButton: {
    flex: 1,
    elevation: 4,
    shadowColor: '#4BB543',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  cancelMatchButton: {
    flex: 1,
    elevation: 4,
    shadowColor: '#FF4545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  actionGradient: {
    borderRadius: 28,
    padding: 1,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#121212',
    margin: 1,
    padding: 12,
    borderRadius: 27,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  liveIndicator: {
    color: '#4BB543',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  result: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginTop: 16,
    paddingTop: 16,
  },
  winner: {
    color: '#4BB543',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  summary: {
    color: '#CCCCCC',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  teamScore: {
    color: '#FF9F45',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  liveIndicatorContainer: {
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(75, 181, 67, 0.1)',
    padding: 8,
    borderRadius: 12,
  },
  updateScoreText: {
    color: '#CCCCCC',
    fontSize: 13,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  noMatchesContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMatchesText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  matchStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#999',
    fontSize: 13,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsModal: {
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    width: '94%',
    maxHeight: '90%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    padding: 20,
  },
  statsModalTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  matchSummary: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  teamScoreContainer: {
    marginBottom: 12,
  },
  resultContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  resultText: {
    color: '#4BB543',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  inningsSection: {
    marginBottom: 24,
  },
  inningsTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  statsSection: {
    marginBottom: 20,
  },
  statsSectionTitle: {
    color: '#FF9F45',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  statsTable: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
  },
  statsHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  statsHeaderText: {
    color: '#FFFFFF',
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'center',
  },
  playerNameContainer: {
    paddingRight: 8,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  dismissalInfo: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  statsText: {
    color: '#CCCCCC',
    width: 40,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  extrasContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  extrasRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  extrasLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  extrasValue: {
    color: '#FF9F45',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  extrasBreakdown: {
    marginTop: 4,
  },
  extrasBreakdownText: {
    color: '#999',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  summaryText: {
    color: '#FF9F45',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
}); 
