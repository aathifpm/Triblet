import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { getFirestore, doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';

// Enums and Interfaces
enum DismissalType {
  BOWLED = 'BOWLED',
  CAUGHT = 'CAUGHT',
  RUN_OUT = 'RUN_OUT',
  LBW = 'LBW',
  STUMPED = 'STUMPED',
}

interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

interface BattingStats {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dismissalType?: DismissalType;
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
  authId?: string;
  name: string;
  battingStats: BattingStats;
  bowlingStats: BowlingStats;
}

interface Team {
  id: string;
  name: string;
  players: Player[];
  score: number;
  wickets: number;
  overs: number;
  extras: Extras;
}

interface CricketMatch {
  id: string;
  tournamentId: string;
  team1: Team;
  team2: Team;
  date: Date;
  venue: string;
  tossWinner: string;
  battingFirst: string;
  status: 'NOT_STARTED' | 'TOSS' | 'IN_PROGRESS' | 'COMPLETED';
  currentInnings: 1 | 2;
  result?: string;
  firstInningsTeam: string;
  firstInningsScore: number;
  firstInningsWickets: number;
  firstInningsOvers: number;
  firstInningsExtras: Extras;
  secondInningsTeam: string;
  secondInningsScore: number;
  secondInningsWickets: number;
  secondInningsOvers: number;
  secondInningsExtras: Extras;
  currentBatsmen: { striker: string; nonStriker: string };
  currentBowler: string;
  currentOver: number;
  ballsInOver: number;
  requiredRunRate?: number;
  requiredRuns?: number;
  matchType: 'T20';
  maxOvers: number;
}

type Status = 'NOT_STARTED' | 'TOSS' | 'IN_PROGRESS' | 'COMPLETED';

interface MatchUpdateData {
  team1?: Team;
  team2?: Team;
  status?: Status;
  currentInnings?: number;
  battingFirst?: string;
  firstInningsTeam?: string;
  firstInningsScore?: number;
  firstInningsWickets?: number;
  firstInningsOvers?: number;
  firstInningsExtras?: Extras;
  secondInningsTeam?: string;
  secondInningsScore?: number;
  secondInningsWickets?: number;
  secondInningsOvers?: number;
  secondInningsExtras?: Extras;
  currentBatsmen?: { striker: string; nonStriker: string };
  currentBowler?: string;
  ballsInOver?: number;
  currentOver?: number;
  requiredRuns?: number;
  requiredRunRate?: number;
  result?: string;
}

// Add this utility function at the top level
const formatOvers = (deliveries: number): string => {
  if (deliveries === 0) return "0.0";
  const overs = Math.floor(deliveries / 6);
  const balls = deliveries % 6;
  return `${overs}.${balls}`;
};

// Add new component for match completion popup
const MatchCompletionModal = ({ match, visible, onClose }: { match: CricketMatch; visible: boolean; onClose: () => void }) => {
  // Add debug log
  console.log('RENDERING MATCH COMPLETION MODAL - visible:', visible);
  console.log('RENDERING MATCH COMPLETION MODAL - result:', match.result);
  
  // Use result from prop, defaulting to "Match Completed" if not available
  const resultText = match.result || "Match Completed";
  
  return (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalContainer}>
      <View style={[styles.modal, styles.matchCompletionModal]}>
        <Text style={styles.modalTitle}>Match Complete</Text>
        <Text style={styles.resultText}>{resultText}</Text>
        
        <View style={styles.matchSummary}>
          <Text style={styles.summaryTitle}>First Innings</Text>
          <Text style={styles.summaryText}>
            {match.team1.id === match.firstInningsTeam ? match.team1.name : match.team2.name}
            {': '}
            {match.firstInningsScore}/{match.firstInningsWickets}
            {' ('}
            {formatOvers(Math.floor(match.firstInningsOvers * 6))}
            {' overs)'}
          </Text>
          
          <Text style={styles.summaryTitle}>Second Innings</Text>
          <Text style={styles.summaryText}>
            {match.team1.id === match.secondInningsTeam ? match.team1.name : match.team2.name}
            {': '}
            {match.secondInningsScore}/{match.secondInningsWickets}
            {' ('}
            {formatOvers(Math.floor(match.secondInningsOvers * 6))}
            {' overs)'}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
          <Text style={styles.modalCloseButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
  );
};

// Main Component
export default function CricketMatch() {
  const [match, setMatch] = useState<CricketMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [showWicketTypeSelection, setShowWicketTypeSelection] = useState(false);
  const [showExtrasSelection, setShowExtrasSelection] = useState(false);
  const [selectionType, setSelectionType] = useState<'STRIKER' | 'NON_STRIKER' | 'BOWLER' | null>(null);
  const [showMatchCompletion, setShowMatchCompletion] = useState(false);
  const [runOutBatsman, setRunOutBatsman] = useState<'STRIKER' | 'NON_STRIKER' | 'BOTH' | null>(null);
  const { matchId } = useLocalSearchParams();
  const db = getFirestore();

  // Fetch and Initialize Match Data
  useEffect(() => {
    let unsubscribe: () => void;

    const fetchTeamDetails = async (teamId: string, existingTeam?: Team): Promise<Team | null> => {
      try {
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (!teamDoc.exists()) {
          console.error('Team not found:', teamId);
          return null;
        }

        const teamData = teamDoc.data();
        console.log('Team data:', teamData);

        // Ensure playersIds exists and is an array
        const playersIds = teamData.playersIds || [];
        if (!Array.isArray(playersIds)) {
          console.error('Invalid playersIds format:', playersIds);
          return null;
        }

        const players = await Promise.all(
          playersIds.map(async (playerId: string) => {
            const playerDoc = await getDoc(doc(db, 'users', playerId));
            const playerData = playerDoc.exists() ? playerDoc.data() : null;
            
            // Find existing player stats if available
            const existingPlayer = existingTeam?.players?.find(p => p.id === playerId);
            
            return {
              id: playerId,
              authId: playerData?.authId || undefined,
              name: playerData?.name || 'Unknown Player',
              battingStats: existingPlayer?.battingStats || {
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0,
                strikeRate: 0,
              },
              bowlingStats: existingPlayer?.bowlingStats || {
                overs: 0,
                maidens: 0,
                runs: 0,
                wickets: 0,
                economy: 0,
                wides: 0,
                noBalls: 0,
                deliveries: 0,
              },
            };
          })
        );

        // Create team object with preserved stats or default values
        return {
          id: teamDoc.id,
          name: teamData.name || 'Unknown Team',
          players,
          score: existingTeam?.score || 0,
          wickets: existingTeam?.wickets || 0,
          overs: existingTeam?.overs || 0,
          extras: existingTeam?.extras || {
            wides: 0,
            noBalls: 0,
            byes: 0,
            legByes: 0,
          },
        };
      } catch (error) {
        console.error('Error fetching team:', error);
        return null;
      }
    };

    const loadMatch = async () => {
      if (!matchId) {
        setLoading(false);
        return;
      }

      try {
        const matchRef = doc(db, 'matches', matchId as string);
        const docSnap = await getDoc(matchRef);
        
        if (!docSnap.exists()) {
          console.error('Match not found');
          setLoading(false);
          return;
        }

        unsubscribe = onSnapshot(matchRef, async (snapshot) => {
          if (snapshot.exists()) {
            const matchData = snapshot.data();
            console.log('Match data:', matchData);

            // Ensure we have team IDs
            if (!matchData.team1Id || !matchData.team2Id) {
              console.error('Missing team IDs:', matchData);
              setLoading(false);
              return;
            }

            // Fetch teams with existing data
            const team1 = await fetchTeamDetails(matchData.team1Id, matchData.team1);
            const team2 = await fetchTeamDetails(matchData.team2Id, matchData.team2);

            if (!team1 || !team2) {
              console.error('Failed to load teams');
              setLoading(false);
              return;
            }

            const initializedMatch: CricketMatch = {
              id: snapshot.id,
              tournamentId: matchData.tournamentId || '',
              team1,
              team2,
              date: matchData.date?.toDate() || new Date(),
              venue: matchData.venue || '',
              tossWinner: matchData.tossWinner || '',
              battingFirst: matchData.battingFirst || '',
              status: matchData.status || 'NOT_STARTED',
              currentInnings: matchData.currentInnings || 1,
              firstInningsTeam: matchData.firstInningsTeam || '',
              firstInningsScore: matchData.firstInningsScore || 0,
              firstInningsWickets: matchData.firstInningsWickets || 0,
              firstInningsOvers: matchData.firstInningsOvers || 0,
              firstInningsExtras: matchData.firstInningsExtras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
              secondInningsTeam: matchData.secondInningsTeam || '',
              secondInningsScore: matchData.secondInningsScore || 0,
              secondInningsWickets: matchData.secondInningsWickets || 0,
              secondInningsOvers: matchData.secondInningsOvers || 0,
              secondInningsExtras: matchData.secondInningsExtras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
              currentBatsmen: matchData.currentBatsmen || { striker: '', nonStriker: '' },
              currentBowler: matchData.currentBowler || '',
              currentOver: matchData.currentOver || 0,
              ballsInOver: matchData.ballsInOver || 0,
              requiredRunRate: matchData.requiredRunRate,
              requiredRuns: matchData.requiredRuns,
              matchType: 'T20',
              maxOvers: 20,
              result: matchData.result,
            };

            console.log('Initialized match:', initializedMatch);
            setMatch(initializedMatch);
            setLoading(false);

            // Show appropriate selection modal
            if (initializedMatch.status === 'NOT_STARTED') {
              setShowTeamSelection(true);
              setShowPlayerSelection(false);
            } else if (!initializedMatch.currentBatsmen.striker) {
              setShowPlayerSelection(true);
              setSelectionType('STRIKER');
            }
          }
        }, (error) => {
          console.error('Error listening to match updates:', error);
          Alert.alert('Error', 'Failed to load match data');
          setLoading(false);
        });
      } catch (error) {
        console.error('Error loading match:', error);
        Alert.alert('Error', 'Failed to load match');
        setLoading(false);
      }
    };

    loadMatch();
    return () => unsubscribe && unsubscribe();
  }, [matchId]);

  // Helper Functions
  const isPlayerOut = (player: Player) => player.battingStats.dismissalType !== undefined;

  const getAvailableBatsmen = (team: Team, striker?: string, nonStriker?: string) =>
    team.players.filter((p) => !isPlayerOut(p) && p.id !== striker && p.id !== nonStriker);

  const canChangeBowler = (match: CricketMatch, isInjured: boolean = false) =>
    isInjured || !match.currentBowler || match.ballsInOver === 0;

  // Core Logic Functions
  const handleTeamSelection = async (battingTeamId: string) => {
    if (!match) return;

    try {
      const battingTeam = battingTeamId === match.team1.id ? match.team1 : match.team2;
      const bowlingTeam = battingTeamId === match.team1.id ? match.team2 : match.team1;

      const updateData: MatchUpdateData = {
        team1: battingTeam,
        team2: bowlingTeam,
        status: 'IN_PROGRESS',
        currentInnings: 1,
        battingFirst: battingTeamId,
        firstInningsTeam: battingTeamId,
        currentBatsmen: { striker: '', nonStriker: '' },
        currentBowler: '',
        ballsInOver: 0,
        currentOver: 0,
      };

      console.log('Updating match with team selection:', updateData);
      await updateDoc(doc(db, 'matches', matchId as string), updateData as any);
      setShowTeamSelection(false);
      setShowPlayerSelection(true);
      setSelectionType('STRIKER');
    } catch (error) {
      console.error('Error selecting teams:', error);
      Alert.alert('Error', 'Failed to select teams');
    }
  };

  const isInningsComplete = (match: CricketMatch, battingTeam: Team) => {
    const maxWickets = battingTeam.players.length - 1;
    if (battingTeam.wickets >= maxWickets) return { complete: true, reason: 'ALL_OUT' };
    if (Math.floor(battingTeam.overs) >= match.maxOvers) return { complete: true, reason: 'OVERS_COMPLETE' };

    if (match.currentInnings === 2) {
      const currentScore = match.secondInningsScore;
      console.log('INNINGS COMPLETE CHECK - currentScore:', currentScore);
      console.log('INNINGS COMPLETE CHECK - firstInningsScore:', match.firstInningsScore);
      console.log('INNINGS COMPLETE CHECK - Checking if target achieved:', currentScore > match.firstInningsScore);
      
      if (currentScore > match.firstInningsScore) {
        console.log('INNINGS COMPLETE CHECK - TARGET ACHIEVED!');
        return { complete: true, reason: 'TARGET_ACHIEVED' };
      }
      
      const remainingBalls = match.maxOvers * 6 - (Math.floor(match.secondInningsOvers * 6));
      const maxPossibleScore = currentScore + remainingBalls * 6;
      if (maxPossibleScore < match.firstInningsScore) return { complete: true, reason: 'TARGET_IMPOSSIBLE' };
      if (currentScore === match.firstInningsScore && Math.floor(match.secondInningsOvers) >= match.maxOvers)
        return { complete: true, reason: 'MATCH_TIED' };
    }

    return { complete: false, reason: null };
  };

  const handleInningsCompletion = async (match: CricketMatch, battingTeam: Team, bowlingTeam: Team, preCalculatedResult?: string) => {
    try {
      const updateData: MatchUpdateData = {};

      if (match.currentInnings === 1) {
        // Store first innings details
        updateData.firstInningsTeam = battingTeam.id;
        updateData.firstInningsScore = battingTeam.score;
        updateData.firstInningsWickets = battingTeam.wickets;
        updateData.firstInningsOvers = battingTeam.overs + match.ballsInOver / 6;
        updateData.firstInningsExtras = battingTeam.extras;
        
        // Set up second innings
        updateData.currentInnings = 2;
        updateData.secondInningsTeam = bowlingTeam.id;
        
        // Critical Fix: Explicitly initialize secondInningsScore to 0
        updateData.secondInningsScore = 0;
        updateData.secondInningsWickets = 0;
        updateData.secondInningsOvers = 0;
        updateData.secondInningsExtras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
        
        // Calculate target and required run rate
        const target = battingTeam.score + 1;
        const requiredRunRate = Number((target / match.maxOvers).toFixed(2));
        updateData.requiredRuns = target;
        updateData.requiredRunRate = requiredRunRate;
        
        // Reset match state for second innings
        updateData.currentBatsmen = { striker: '', nonStriker: '' };
        updateData.currentBowler = '';
        updateData.ballsInOver = 0;
        updateData.currentOver = 0;
        
        // COMPLETE REWRITE: Properly swap teams for second innings
        // Make deep copies of both teams to ensure no shared references
        const firstInningsBattingTeamCopy = JSON.parse(JSON.stringify(battingTeam));
        const firstInningsBowlingTeamCopy = JSON.parse(JSON.stringify(bowlingTeam));
        
        // Reset second innings batting team stats (the team that was bowling in first innings)
        const secondInningsBattingTeam = {
          id: firstInningsBowlingTeamCopy.id,
          name: firstInningsBowlingTeamCopy.name,
          players: firstInningsBowlingTeamCopy.players,
          score: 0,  // Explicitly set to 0
          wickets: 0,
          overs: 0,
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }
        };
        
        // The first innings batting team becomes the second innings bowling team
        const secondInningsBowlingTeam = {
          id: firstInningsBattingTeamCopy.id,
          name: firstInningsBattingTeamCopy.name,
          players: firstInningsBattingTeamCopy.players,
          score: firstInningsBattingTeamCopy.score,
          wickets: firstInningsBattingTeamCopy.wickets,
          overs: firstInningsBattingTeamCopy.overs,
          extras: firstInningsBattingTeamCopy.extras
        };
        
        // The critical change: swap the teams for second innings
        // In the first innings: team1 = batting, team2 = bowling
        // In the second innings: team1 = bowling (from first innings), team2 = batting (from first innings)
        updateData.team1 = secondInningsBattingTeam;  // Was bowling in first innings, now batting
        updateData.team2 = secondInningsBowlingTeam;  // Was batting in first innings, now bowling
        
        console.log('SECOND INNINGS TEAMS SWAP:');
        console.log('First innings batting team (now bowling):', secondInningsBowlingTeam.name);
        console.log('First innings bowling team (now batting):', secondInningsBattingTeam.name);
        console.log('SECOND INNINGS TEAM SCORE:', secondInningsBattingTeam.score);
        console.log('SECOND INNINGS SCORE IN MATCH:', updateData.secondInningsScore);
      } else {
        // Second innings completion - Match result
        const inningsStatus = isInningsComplete(match, battingTeam);
        let result = '';
        
        // First update all match stats before setting completion status
        updateData.team1 = battingTeam;
        updateData.team2 = bowlingTeam;
        updateData.secondInningsScore = battingTeam.score;
        updateData.secondInningsWickets = battingTeam.wickets;
        updateData.secondInningsOvers = battingTeam.overs + match.ballsInOver / 6;
        updateData.secondInningsExtras = battingTeam.extras;
        
        // Use pre-calculated result if provided, otherwise calculate based on innings status
        if (preCalculatedResult) {
          result = preCalculatedResult;
          console.log('Using pre-calculated result:', result);
        } else {
          switch (inningsStatus.reason) {
            case 'TARGET_ACHIEVED':
              const wicketsRemaining = battingTeam.players.length - 1 - battingTeam.wickets;
              const ballsRemaining = match.maxOvers * 6 - (Math.floor(battingTeam.overs) * 6 + match.ballsInOver);
              result = `${battingTeam.name} won by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''} with ${ballsRemaining} ball${ballsRemaining !== 1 ? 's' : ''} remaining`;
              break;
            case 'ALL_OUT':
            case 'OVERS_COMPLETE':
            case 'TARGET_IMPOSSIBLE':
              if (battingTeam.score < match.firstInningsScore) {
                const runDifference = match.firstInningsScore - battingTeam.score;
                result = `${bowlingTeam.name} won by ${runDifference} run${runDifference !== 1 ? 's' : ''}`;
              }
              break;
            case 'MATCH_TIED':
              result = 'Match Tied';
              break;
          }
        }

        // Set completion status after updating all stats
        updateData.status = 'COMPLETED';
        
        // Only set result if it hasn't been set already
        if (!updateData.result) {
          updateData.result = result;
        }
        
        // Add debug logs to track result message
        console.log('MATCH COMPLETED - Result set to:', updateData.result || result);
        console.log('MATCH COMPLETED - battingTeam:', battingTeam.name);
        console.log('MATCH COMPLETED - bowlingTeam:', bowlingTeam.name);
        console.log('MATCH COMPLETED - scores:', `${battingTeam.name}: ${updateData.secondInningsScore}/${updateData.secondInningsWickets}, ${bowlingTeam.name}: ${match.firstInningsScore}/${match.firstInningsWickets}`);
        
        // Update Firestore and show completion modal
        console.log('Final result being saved to Firestore:', updateData.result);
        
        // First, explicitly save the result to ensure it's in Firestore
        // This is a critical fix to make sure the result appears in the modal
        await updateDoc(doc(db, 'matches', matchId as string), { 
          result: updateData.result,
          status: 'COMPLETED'
        });
        
        // Then update the rest of the match data
        await updateDoc(doc(db, 'matches', matchId as string), updateData as any);
        
        // Add a small delay to ensure Firestore updates are reflected before showing modal
        setTimeout(() => {
          console.log('Showing match completion modal after delay');
          setShowMatchCompletion(true);
        }, 1000); // 1 second delay
        
        return;
      }

      await updateDoc(doc(db, 'matches', matchId as string), updateData as any);
    } catch (error) {
      console.error('Error completing innings:', error);
      Alert.alert('Error', 'Failed to complete innings');
    }
  };

  const handleRuns = async (runs: number) => {
    if (!match || !match.currentBatsmen.striker || !match.currentBowler) {
      Alert.alert('Error', 'Select striker and bowler first');
      return;
    }

    if (match.status === 'COMPLETED') {
      Alert.alert('Match Completed', 'Cannot update scores after match completion');
      return;
    }

    // CRITICAL FIX: Determine current batting and bowling teams based on current innings
    let battingTeam, bowlingTeam;
    
    if (match.currentInnings === 1) {
      // First innings: team1 is batting, team2 is bowling
      battingTeam = match.team1;
      bowlingTeam = match.team2;
    } else {
      // Second innings: teams have swapped roles
      if (match.team1.id === match.secondInningsTeam) {
        battingTeam = match.team1; 
        bowlingTeam = match.team2;
      } else {
        battingTeam = match.team2;
        bowlingTeam = match.team1;
      }
    }

    const updatedBattingTeam = JSON.parse(JSON.stringify(battingTeam));
    const updatedBowlingTeam = JSON.parse(JSON.stringify(bowlingTeam));

    const currentBallsInOver = match.ballsInOver + 1;
    const newBallsInOver = currentBallsInOver % 6;
    const isOverComplete = currentBallsInOver >= 6;

    // Update striker's batting stats
    const strikerIndex = updatedBattingTeam.players.findIndex((p: Player) => p.id === match.currentBatsmen.striker);
    if (strikerIndex !== -1) {
      const striker = updatedBattingTeam.players[strikerIndex];
      striker.battingStats.runs += runs;
      striker.battingStats.balls += 1;
      if (runs === 4) striker.battingStats.fours += 1;
      if (runs === 6) striker.battingStats.sixes += 1;
      striker.battingStats.strikeRate = Number(((striker.battingStats.runs / striker.battingStats.balls) * 100).toFixed(2));
    }

    // Update bowler's stats
    const bowlerIndex = updatedBowlingTeam.players.findIndex((p: Player) => p.id === match.currentBowler);
    if (bowlerIndex !== -1) {
      const bowler = updatedBowlingTeam.players[bowlerIndex];
      bowler.bowlingStats.runs += runs;
      bowler.bowlingStats.deliveries += 1;
      const oversBowled = bowler.bowlingStats.deliveries / 6;
      bowler.bowlingStats.overs = Math.floor(oversBowled) + (bowler.bowlingStats.deliveries % 6) / 10;
      bowler.bowlingStats.economy = Number((bowler.bowlingStats.runs / oversBowled).toFixed(2));
    }

    // Update team score and overs
    updatedBattingTeam.score += runs;
    updatedBattingTeam.overs = Math.floor(battingTeam.overs) + (isOverComplete ? 1 : 0);

    // Update match data - critical fix to ensure teams are in correct positions
    const updateData: MatchUpdateData = {
      ballsInOver: newBallsInOver,
    };
    
    // Maintain correct team positions based on current innings
    if (match.currentInnings === 1) {
      updateData.team1 = updatedBattingTeam;
      updateData.team2 = updatedBowlingTeam;
    } else {
      if (match.team1.id === match.secondInningsTeam) {
        updateData.team1 = updatedBattingTeam;
        updateData.team2 = updatedBowlingTeam;
      } else {
        updateData.team1 = updatedBowlingTeam;
        updateData.team2 = updatedBattingTeam;
      }
    }

    // Update striker/non-striker if needed
    if ((runs % 2 === 1 || isOverComplete) && match.currentBatsmen.nonStriker) {
      updateData.currentBatsmen = {
        striker: match.currentBatsmen.nonStriker,
        nonStriker: match.currentBatsmen.striker,
      };
    }

    // Update innings-specific stats
    if (match.currentInnings === 1) {
      updateData.firstInningsScore = updatedBattingTeam.score;
      updateData.firstInningsWickets = updatedBattingTeam.wickets;
      updateData.firstInningsOvers = updatedBattingTeam.overs + newBallsInOver / 6;
      updateData.firstInningsExtras = updatedBattingTeam.extras;
    } else {
      // FIXED: Calculate new second innings score by adding current runs to existing secondInningsScore
      const updatedSecondInningsScore = runs;
      updateData.secondInningsScore = (match.secondInningsScore || 0) + updatedSecondInningsScore;
      updateData.secondInningsWickets = updatedBattingTeam.wickets;
      updateData.secondInningsOvers = updatedBattingTeam.overs + newBallsInOver / 6;
      updateData.secondInningsExtras = updatedBattingTeam.extras;
      
      const remainingBalls = match.maxOvers * 6 - (Math.floor(match.secondInningsOvers * 6) + newBallsInOver);
      updateData.requiredRuns = match.firstInningsScore + 1 - updateData.secondInningsScore;
      updateData.requiredRunRate = remainingBalls > 0 ? Number(((updateData.requiredRuns * 6) / remainingBalls).toFixed(2)) : 0;
      
      // Check if target has been achieved with this run
      if (updateData.secondInningsScore > match.firstInningsScore) {
        console.log('TARGET ACHIEVED! Setting up result before completing innings');
        // Calculate result message here to ensure it's set properly
        const wicketsRemaining = updatedBattingTeam.players.length - 1 - updatedBattingTeam.wickets;
        const ballsRemaining = match.maxOvers * 6 - (Math.floor(updatedBattingTeam.overs) * 6 + match.ballsInOver);
        
        // Set result directly on the updateData
        updateData.result = `${updatedBattingTeam.name} won by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''} with ${ballsRemaining} ball${ballsRemaining !== 1 ? 's' : ''} remaining`;
        console.log('Setting result to:', updateData.result);
        
        // If the target has been achieved, complete the innings
        await handleInningsCompletion(match, updatedBattingTeam, updatedBowlingTeam, updateData.result);
        return;
      }
    }

    // Check innings completion after updating all stats
    const inningsStatus = isInningsComplete(match, updatedBattingTeam);
    if (inningsStatus.complete) {
      await handleInningsCompletion(match, updatedBattingTeam, updatedBowlingTeam, updateData.result);
    } else {
      await updateDoc(doc(db, 'matches', matchId as string), updateData as any);
      if (isOverComplete) {
        setShowPlayerSelection(true);
        setSelectionType('BOWLER');
      }
    }
  };

  const handleWicket = async (wicketType: DismissalType) => {
    if (!match || !match.currentBatsmen.striker || !match.currentBowler) {
      Alert.alert('Error', 'Select striker and bowler first');
      return;
    }

    if (match.status === 'COMPLETED') {
      Alert.alert('Match Completed', 'Cannot update wickets after match completion');
      return;
    }

    if (wicketType === DismissalType.RUN_OUT) {
      Alert.alert(
        'Run Out',
        'Select which batsman was run out',
        [
          { text: 'Striker', onPress: () => handleRunOut('STRIKER') },
          { text: 'Non-Striker', onPress: () => handleRunOut('NON_STRIKER') },
          { text: 'Both', onPress: () => handleRunOut('BOTH') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    // CRITICAL FIX: Determine current batting and bowling teams based on current innings
    let battingTeam, bowlingTeam;
    
    if (match.currentInnings === 1) {
      // First innings: team1 is batting, team2 is bowling
      battingTeam = match.team1;
      bowlingTeam = match.team2;
    } else {
      // Second innings: teams have swapped roles
      if (match.team1.id === match.secondInningsTeam) {
        battingTeam = match.team1; 
        bowlingTeam = match.team2;
      } else {
        battingTeam = match.team2;
        bowlingTeam = match.team1;
      }
    }

    const updatedBattingTeam = JSON.parse(JSON.stringify(battingTeam));
    const updatedBowlingTeam = JSON.parse(JSON.stringify(bowlingTeam));

    const currentBallsInOver = match.ballsInOver + 1;
    const newBallsInOver = currentBallsInOver % 6;
    const isOverComplete = currentBallsInOver >= 6;

    const strikerIndex = updatedBattingTeam.players.findIndex((p: Player) => p.id === match.currentBatsmen.striker);
    if (strikerIndex !== -1) {
      const striker = updatedBattingTeam.players[strikerIndex];
      striker.battingStats.balls += 1;
      striker.battingStats.dismissalType = wicketType;
      striker.battingStats.dismissalBowler = match.currentBowler;
    }

    const bowlerIndex = updatedBowlingTeam.players.findIndex((p: Player) => p.id === match.currentBowler);
    if (bowlerIndex !== -1) {
      const bowler = updatedBowlingTeam.players[bowlerIndex];
      bowler.bowlingStats.wickets += 1;
      bowler.bowlingStats.deliveries += 1;
      const oversBowled = bowler.bowlingStats.deliveries / 6;
      bowler.bowlingStats.overs = Math.floor(oversBowled) + (bowler.bowlingStats.deliveries % 6) / 10;
      bowler.bowlingStats.economy = Number((bowler.bowlingStats.runs / oversBowled).toFixed(2));
    }

    updatedBattingTeam.wickets += 1;
    updatedBattingTeam.overs = Math.floor(battingTeam.overs) + (isOverComplete ? 1 : 0);

    // Update match data - critical fix to ensure teams are in correct positions
    const updateData: MatchUpdateData = {
      ballsInOver: newBallsInOver,
      currentBatsmen: {
        striker: '',
        nonStriker: match.currentBatsmen.nonStriker
      },
      currentBowler: match.currentBowler
    };
    
    // Maintain correct team positions based on current innings
    if (match.currentInnings === 1) {
      updateData.team1 = updatedBattingTeam;
      updateData.team2 = updatedBowlingTeam;
    } else {
      if (match.team1.id === match.secondInningsTeam) {
        updateData.team1 = updatedBattingTeam;
        updateData.team2 = updatedBowlingTeam;
      } else {
        updateData.team1 = updatedBowlingTeam;
        updateData.team2 = updatedBattingTeam;
      }
    }

    await updateMatchAfterWicket(updateData, updatedBattingTeam, updatedBowlingTeam, isOverComplete);
  };

  const handleRunOut = async (outBatsman: 'STRIKER' | 'NON_STRIKER' | 'BOTH') => {
    if (!match) return;

    // CRITICAL FIX: Determine current batting and bowling teams based on current innings
    let battingTeam, bowlingTeam;
    
    if (match.currentInnings === 1) {
      // First innings: team1 is batting, team2 is bowling
      battingTeam = match.team1;
      bowlingTeam = match.team2;
    } else {
      // Second innings: teams have swapped roles
      if (match.team1.id === match.secondInningsTeam) {
        battingTeam = match.team1; 
        bowlingTeam = match.team2;
      } else {
        battingTeam = match.team2;
        bowlingTeam = match.team1;
      }
    }

    const updatedBattingTeam = JSON.parse(JSON.stringify(battingTeam));
    const updatedBowlingTeam = JSON.parse(JSON.stringify(bowlingTeam));

    const currentBallsInOver = match.ballsInOver + 1;
    const newBallsInOver = currentBallsInOver % 6;
    const isOverComplete = currentBallsInOver >= 6;

    // Mark the appropriate batsman(s) as out
    if (outBatsman === 'STRIKER' || outBatsman === 'BOTH') {
      const strikerIndex = updatedBattingTeam.players.findIndex((p: Player) => p.id === match.currentBatsmen.striker);
      if (strikerIndex !== -1) {
        const striker = updatedBattingTeam.players[strikerIndex];
        striker.battingStats.balls += 1;
        striker.battingStats.dismissalType = DismissalType.RUN_OUT;
      }
    }

    if (outBatsman === 'NON_STRIKER' || outBatsman === 'BOTH') {
      const nonStrikerIndex = updatedBattingTeam.players.findIndex((p: Player) => p.id === match.currentBatsmen.nonStriker);
      if (nonStrikerIndex !== -1) {
        const nonStriker = updatedBattingTeam.players[nonStrikerIndex];
        nonStriker.battingStats.dismissalType = DismissalType.RUN_OUT;
      }
    }

    // Update bowler's stats
    const bowlerIndex = updatedBowlingTeam.players.findIndex((p: Player) => p.id === match.currentBowler);
    if (bowlerIndex !== -1) {
      const bowler = updatedBowlingTeam.players[bowlerIndex];
      bowler.bowlingStats.deliveries += 1;
      const oversBowled = bowler.bowlingStats.deliveries / 6;
      bowler.bowlingStats.overs = Math.floor(oversBowled) + (bowler.bowlingStats.deliveries % 6) / 10;
      bowler.bowlingStats.economy = Number((bowler.bowlingStats.runs / oversBowled).toFixed(2));
    }

    // Update team stats
    updatedBattingTeam.wickets += (outBatsman === 'BOTH' ? 2 : 1);
    updatedBattingTeam.overs = Math.floor(battingTeam.overs) + (isOverComplete ? 1 : 0);

    // Update match data - critical fix to ensure teams are in correct positions
    const updateData: MatchUpdateData = {
      ballsInOver: newBallsInOver,
      currentBatsmen: {
        striker: outBatsman === 'STRIKER' || outBatsman === 'BOTH' ? '' : match.currentBatsmen.striker,
        nonStriker: outBatsman === 'NON_STRIKER' || outBatsman === 'BOTH' ? '' : match.currentBatsmen.nonStriker
      },
      currentBowler: match.currentBowler
    };
    
    // Maintain correct team positions based on current innings
    if (match.currentInnings === 1) {
      updateData.team1 = updatedBattingTeam;
      updateData.team2 = updatedBowlingTeam;
    } else {
      if (match.team1.id === match.secondInningsTeam) {
        updateData.team1 = updatedBattingTeam;
        updateData.team2 = updatedBowlingTeam;
      } else {
        updateData.team1 = updatedBowlingTeam;
        updateData.team2 = updatedBattingTeam;
      }
    }

    await updateMatchAfterWicket(updateData, updatedBattingTeam, updatedBowlingTeam, isOverComplete);
  };

  const updateMatchAfterWicket = async (
    updateData: Partial<MatchUpdateData>,
    updatedBattingTeam: Team,
    updatedBowlingTeam: Team,
    isOverComplete: boolean
  ) => {
    const inningsStatus = isInningsComplete(match!, updatedBattingTeam);
    if (inningsStatus.complete) {
      await handleInningsCompletion(match!, updatedBattingTeam, updatedBowlingTeam, updateData.result);
    } else {
      if (match!.currentInnings === 1) {
        updateData.firstInningsScore = updatedBattingTeam.score;
        updateData.firstInningsWickets = updatedBattingTeam.wickets;
        updateData.firstInningsOvers = updatedBattingTeam.overs + (updateData.ballsInOver || 0) / 6;
        updateData.firstInningsExtras = updatedBattingTeam.extras;
      } else {
        // CRITICAL FIX: Update secondInningsScore with the current batting team score
        updateData.secondInningsScore = updatedBattingTeam.score;
        updateData.secondInningsWickets = updatedBattingTeam.wickets;
        updateData.secondInningsOvers = updatedBattingTeam.overs + (updateData.ballsInOver || 0) / 6;
        updateData.secondInningsExtras = updatedBattingTeam.extras;
        const remainingBalls = match!.maxOvers * 6 - (updatedBattingTeam.overs * 6 + (updateData.ballsInOver || 0));
        // FIXED: Use updatedBattingTeam.score directly instead of match!.secondInningsScore
        updateData.requiredRuns = match!.firstInningsScore + 1 - updatedBattingTeam.score;
        updateData.requiredRunRate = remainingBalls > 0 ? Number(((updateData.requiredRuns * 6) / remainingBalls).toFixed(2)) : 0;
      }
      await updateDoc(doc(db, 'matches', matchId as string), updateData as any);
      
      // Show player selection modal for new batsman(s)
      setShowPlayerSelection(true);
      setSelectionType('STRIKER');
      
      if (isOverComplete) {
        setTimeout(() => {
          setShowPlayerSelection(true);
          setSelectionType('BOWLER');
        }, 100);
      }
    }
  };

  const handleExtras = async (type: keyof Extras, runs: number = 1) => {
    if (!match || !match.currentBowler) {
      Alert.alert('Error', 'Select bowler first');
      return;
    }

    if (match.status === 'COMPLETED') {
      Alert.alert('Match Completed', 'Cannot update extras after match completion');
      return;
    }

    // CRITICAL FIX: Determine current batting and bowling teams based on current innings
    let battingTeam, bowlingTeam;
    
    if (match.currentInnings === 1) {
      // First innings: team1 is batting, team2 is bowling
      battingTeam = match.team1;
      bowlingTeam = match.team2;
    } else {
      // Second innings: teams have swapped roles
      if (match.team1.id === match.secondInningsTeam) {
        battingTeam = match.team1; 
        bowlingTeam = match.team2;
      } else {
        battingTeam = match.team2;
        bowlingTeam = match.team1;
      }
    }

    const updatedBattingTeam = JSON.parse(JSON.stringify(battingTeam));
    const updatedBowlingTeam = JSON.parse(JSON.stringify(bowlingTeam));

    // Update extras and total score
    updatedBattingTeam.extras[type] += runs;
    updatedBattingTeam.score += runs;

    // For wides and no-balls, update bowler's stats
    if (type === 'wides' || type === 'noBalls') {
      const bowlerIndex = updatedBowlingTeam.players.findIndex((p: Player) => p.id === match.currentBowler);
      if (bowlerIndex !== -1) {
        const bowler = updatedBowlingTeam.players[bowlerIndex];
        if (type === 'wides') bowler.bowlingStats.wides += runs;
        if (type === 'noBalls') bowler.bowlingStats.noBalls += runs;
        bowler.bowlingStats.runs += runs;
        const oversBowled = bowler.bowlingStats.deliveries / 6;
        bowler.bowlingStats.economy = Number((bowler.bowlingStats.runs / oversBowled).toFixed(2));
      }
    }

    // Update match data - critical fix to ensure teams are in correct positions
    const updateData: MatchUpdateData = {};
    
    // Maintain correct team positions based on current innings
    if (match.currentInnings === 1) {
      updateData.team1 = updatedBattingTeam;
      updateData.team2 = updatedBowlingTeam;
    } else {
      if (match.team1.id === match.secondInningsTeam) {
        updateData.team1 = updatedBattingTeam;
        updateData.team2 = updatedBowlingTeam;
      } else {
        updateData.team1 = updatedBowlingTeam;
        updateData.team2 = updatedBattingTeam;
      }
    }

    // Update innings-specific stats
    if (match.currentInnings === 1) {
      updateData.firstInningsScore = updatedBattingTeam.score;
      updateData.firstInningsExtras = updatedBattingTeam.extras;
    } else {
      // FIXED: Calculate new second innings score by adding current extras to existing secondInningsScore
      const updatedSecondInningsScore = runs;
      updateData.secondInningsScore = (match.secondInningsScore || 0) + updatedSecondInningsScore;
      updateData.secondInningsExtras = updatedBattingTeam.extras;
      
      const remainingBalls = match.maxOvers * 6 - (Math.floor(match.secondInningsOvers * 6));
      updateData.requiredRuns = match.firstInningsScore + 1 - updateData.secondInningsScore;
      updateData.requiredRunRate = remainingBalls > 0 ? Number(((updateData.requiredRuns * 6) / remainingBalls).toFixed(2)) : 0;

      // Check if target has been achieved with these extras
      if (updateData.secondInningsScore > match.firstInningsScore) {
        console.log('TARGET ACHIEVED through extras! Setting up result before completing innings');
        // Calculate result message here to ensure it's set properly
        const wicketsRemaining = updatedBattingTeam.players.length - 1 - updatedBattingTeam.wickets;
        const ballsRemaining = match.maxOvers * 6 - (Math.floor(updatedBattingTeam.overs) * 6 + match.ballsInOver);
        
        // Set result directly on the updateData
        updateData.result = `${updatedBattingTeam.name} won by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''} with ${ballsRemaining} ball${ballsRemaining !== 1 ? 's' : ''} remaining`;
        console.log('Setting result to:', updateData.result);
        
        // If the target has been achieved, complete the innings
        await handleInningsCompletion(match, updatedBattingTeam, updatedBowlingTeam, updateData.result);
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'matches', matchId as string), updateData as any);
    } catch (error) {
      console.error('Error updating extras:', error);
      Alert.alert('Error', 'Failed to update extras');
    }
  };

  const handlePlayerSelection = async (player: Player) => {
    if (!match) return;

    const updateData: MatchUpdateData = { status: 'IN_PROGRESS' };
    switch (selectionType) {
      case 'STRIKER':
        if (isPlayerOut(player) || player.id === match.currentBatsmen.nonStriker) {
          Alert.alert('Invalid Selection', 'Player is out or already batting');
          return;
        }
        updateData.currentBatsmen = { ...match.currentBatsmen, striker: player.id };
        // Only prompt for non-striker if it's not set (initial selection)
        if (!match.currentBatsmen.nonStriker) {
          setSelectionType('NON_STRIKER');
        } else {
          // If non-striker exists, we're replacing a wicketed batsman, so close the selection
          setShowPlayerSelection(false);
          setSelectionType(null);
        }
        break;
      case 'NON_STRIKER':
        if (isPlayerOut(player) || player.id === match.currentBatsmen.striker) {
          Alert.alert('Invalid Selection', 'Player is out or already batting');
          return;
        }
        updateData.currentBatsmen = { ...match.currentBatsmen, nonStriker: player.id };
        setSelectionType('BOWLER');
        break;
      case 'BOWLER':
        if (!canChangeBowler(match)) {
          Alert.alert('Invalid Selection', 'Cannot change bowler mid-over');
          return;
        }
        if (player.id === match.currentBowler && match.ballsInOver === 0) {
          Alert.alert('Invalid Selection', 'Same bowler cannot bowl consecutive overs');
          return;
        }
        updateData.currentBowler = player.id;
        setShowPlayerSelection(false);
        setSelectionType(null);
        break;
    }

    try {
      await updateDoc(doc(db, 'matches', matchId as string), updateData as any);
    } catch (error) {
      Alert.alert('Error', 'Failed to select player');
    }
  };

  // Render UI
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9F45" />
        <Text style={styles.loadingText}>Loading match...</Text>
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Match not found</Text>
      </View>
    );
  }

  // CRITICAL FIX: Determine current batting and bowling teams based on current innings
  let battingTeam: Team, bowlingTeam: Team;
  
  if (match.currentInnings === 1) {
    // First innings: team1 is batting, team2 is bowling (default setup)
    battingTeam = match.team1;
    bowlingTeam = match.team2;
  } else {
    // Second innings: teams have swapped roles
    // Check if proper team swap was done based on firstInningsTeam ID
    if (match.team1.id === match.secondInningsTeam) {
      // If team1 is now the second innings batting team (proper swap happened)
      battingTeam = match.team1;
      bowlingTeam = match.team2;
    } else if (match.team2.id === match.secondInningsTeam) {
      // If team2 is the second innings batting team (might happen if swap didn't work)
      battingTeam = match.team2;
      bowlingTeam = match.team1;
    } else {
      // Fallback based on innings team IDs if nothing matches
      battingTeam = match.team1.id === match.secondInningsTeam ? match.team1 : match.team2;
      bowlingTeam = match.team1.id === match.secondInningsTeam ? match.team2 : match.team1;
    }
  }

  // After we determine the batting and bowling teams, add diagnostic logs
  console.log(`UI RENDERING - Current Innings: ${match.currentInnings}`);
  console.log(`UI RENDERING - Batting Team: ${battingTeam.name} (ID: ${battingTeam.id})`);
  console.log(`UI RENDERING - Bowling Team: ${bowlingTeam.name} (ID: ${bowlingTeam.id})`); 
  console.log(`UI RENDERING - First Innings Team: ${match.firstInningsTeam}`);
  console.log(`UI RENDERING - Second Innings Team: ${match.secondInningsTeam}`);
  console.log(`UI RENDERING - Batting Team Score: ${battingTeam.score}`);
  console.log(`UI RENDERING - Second Innings Score: ${match.secondInningsScore}`);
  
  // CRITICAL DEBUGGING: Force battingTeam.score to match secondInningsScore in second innings
  if (match.currentInnings === 2) {
    console.log('CRITICAL DEBUGGING - Second innings detected');
    console.log(`CRITICAL DEBUGGING - Before fix: battingTeam.score = ${battingTeam.score}, match.secondInningsScore = ${match.secondInningsScore}`);
    
    // This is a temporary solution to ensure the UI displays correctly
    // The proper fix would be to ensure these values are correctly synchronized in all functions
    if (battingTeam.score !== match.secondInningsScore) {
      console.log('CRITICAL DEBUGGING - Fixing battingTeam.score to match secondInningsScore');
      battingTeam.score = match.secondInningsScore;
      battingTeam.wickets = match.secondInningsWickets;
      battingTeam.overs = match.secondInningsOvers;
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.scorecard}>
          <Text style={styles.teamScore}>
            {battingTeam.name}: {
              // CRITICAL FIX: Show the correct innings score based on current innings
              match.currentInnings === 1 
                ? battingTeam.score 
                : match.secondInningsScore
            }/{
              match.currentInnings === 1 
                ? battingTeam.wickets 
                : match.secondInningsWickets
            } ({
              formatOvers(
                match.currentInnings === 1 
                  ? Math.floor(battingTeam.overs * 6) + match.ballsInOver
                  : Math.floor(match.secondInningsOvers * 6)
              )
            } overs)
          </Text>
          {match.currentInnings === 2 && (
            <View style={styles.targetInfo}>
              <Text style={styles.target}>
                Target: {match.firstInningsScore + 1} from {match.maxOvers * 6} balls
              </Text>
              <Text style={styles.target}>
                Need {match.requiredRuns} runs from {match.maxOvers * 6 - (
                  Math.floor(match.secondInningsOvers * 6)
                )} balls
              </Text>
              <Text style={styles.target}>
                RRR: {match.requiredRunRate?.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.batsmen}>
          <TouchableOpacity
            style={styles.playerInfo}
            onPress={() => !match.currentBatsmen.striker && (setShowPlayerSelection(true), setSelectionType('STRIKER'))}
          >
            <Text style={styles.batsmanInfo}>
              {battingTeam.players.find((p) => p.id === match.currentBatsmen.striker)?.name || 'Select Striker'}*: {battingTeam.players.find((p) => p.id === match.currentBatsmen.striker)?.battingStats.runs || 0} ({battingTeam.players.find((p) => p.id === match.currentBatsmen.striker)?.battingStats.balls || 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.playerInfo}
            onPress={() => !match.currentBatsmen.nonStriker && (setShowPlayerSelection(true), setSelectionType('NON_STRIKER'))}
          >
            <Text style={styles.batsmanInfo}>
              {battingTeam.players.find((p) => p.id === match.currentBatsmen.nonStriker)?.name || 'Select Non-Striker'}: {battingTeam.players.find((p) => p.id === match.currentBatsmen.nonStriker)?.battingStats.runs || 0} ({battingTeam.players.find((p) => p.id === match.currentBatsmen.nonStriker)?.battingStats.balls || 0})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bowler}>
          <TouchableOpacity
            style={styles.playerInfo}
            onPress={() => !match.currentBowler && (setShowPlayerSelection(true), setSelectionType('BOWLER'))}
          >
            <Text style={styles.bowlerInfo}>
              {bowlingTeam.players.find((p) => p.id === match.currentBowler)?.name || 'Select Bowler'}: {bowlingTeam.players.find((p) => p.id === match.currentBowler)?.bowlingStats.wickets || 0}/{bowlingTeam.players.find((p) => p.id === match.currentBowler)?.bowlingStats.runs || 0} ({formatOvers(bowlingTeam.players.find((p) => p.id === match.currentBowler)?.bowlingStats.deliveries || 0)})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>{battingTeam.name} Batting</Text>
          <View style={styles.statsHeader}>
            <Text style={[styles.statsHeaderText, styles.playerNameCol]}>Batter</Text>
            <Text style={styles.statsHeaderText}>R</Text>
            <Text style={styles.statsHeaderText}>B</Text>
            <Text style={styles.statsHeaderText}>4s</Text>
            <Text style={styles.statsHeaderText}>6s</Text>
            <Text style={styles.statsHeaderText}>SR</Text>
          </View>
          {battingTeam.players.map((player) => (
            <View key={player.id} style={styles.statsRow}>
              <Text style={[styles.statsText, styles.playerNameCol]}>
                {player.name}{player.id === match.currentBatsmen.striker ? '*' : player.id === match.currentBatsmen.nonStriker ? '†' : ''}{isPlayerOut(player) ? ` (${player.battingStats.dismissalType})` : ''}
              </Text>
              <Text style={styles.statsText}>{player.battingStats.runs}</Text>
              <Text style={styles.statsText}>{player.battingStats.balls}</Text>
              <Text style={styles.statsText}>{player.battingStats.fours}</Text>
              <Text style={styles.statsText}>{player.battingStats.sixes}</Text>
              <Text style={styles.statsText}>{player.battingStats.balls > 0 ? (player.battingStats.runs / player.battingStats.balls * 100).toFixed(1) : '0.0'}</Text>
            </View>
          ))}
          <View style={styles.extrasRow}>
            <Text style={[styles.statsText, styles.playerNameCol]}>Extras</Text>
            <Text style={styles.statsText}>{Object.values(battingTeam.extras).reduce((a, b) => a + b, 0)}</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>{bowlingTeam.name} Bowling</Text>
          <View style={styles.statsHeader}>
            <Text style={[styles.statsHeaderText, styles.playerNameCol]}>Bowler</Text>
            <Text style={styles.statsHeaderText}>O</Text>
            <Text style={styles.statsHeaderText}>M</Text>
            <Text style={styles.statsHeaderText}>R</Text>
            <Text style={styles.statsHeaderText}>W</Text>
            <Text style={styles.statsHeaderText}>Econ</Text>
          </View>
          {bowlingTeam.players.filter((p) => p.bowlingStats.deliveries > 0).map((player) => (
            <View key={player.id} style={styles.statsRow}>
              <Text style={[styles.statsText, styles.playerNameCol]}>
                {player.name}{player.id === match.currentBowler ? '*' : ''}
              </Text>
              <Text style={styles.statsText}>{formatOvers(player.bowlingStats.deliveries)}</Text>
              <Text style={styles.statsText}>{player.bowlingStats.maidens}</Text>
              <Text style={styles.statsText}>{player.bowlingStats.runs}</Text>
              <Text style={styles.statsText}>{player.bowlingStats.wickets}</Text>
              <Text style={styles.statsText}>{player.bowlingStats.deliveries > 0 ? (player.bowlingStats.runs / (player.bowlingStats.deliveries / 6)).toFixed(1) : '0.0'}</Text>
            </View>
          ))}
        </View>

        <View style={styles.controls}>
          {[0, 1, 2, 4, 6].map((runs) => (
            <TouchableOpacity 
              key={runs} 
              style={[
                styles.button,
                match?.status === 'COMPLETED' && styles.disabledButton
              ]} 
              onPress={() => handleRuns(runs)}
              disabled={match?.status === 'COMPLETED'}
            >
              <Text style={styles.buttonText}>{runs}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.button, 
              styles.wicketButton,
              match?.status === 'COMPLETED' && styles.disabledButton
            ]}
            onPress={() => setShowWicketTypeSelection(true)}
            disabled={match?.status === 'COMPLETED'}
          >
            <Text style={styles.buttonText}>W</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.extrasButton,
              match?.status === 'COMPLETED' && styles.disabledButton
            ]}
            onPress={() => setShowExtrasSelection(true)}
            disabled={match?.status === 'COMPLETED'}
          >
            <Text style={styles.buttonText}>E</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showTeamSelection} animationType="slide" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Select Batting Team</Text>
              <View style={styles.teamSelectionContainer}>
                <TouchableOpacity style={styles.teamButton} onPress={() => handleTeamSelection(match.team1.id)}>
                  <Text style={styles.teamButtonText}>{match.team1.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.teamButton} onPress={() => handleTeamSelection(match.team2.id)}>
                  <Text style={styles.teamButtonText}>{match.team2.name}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showPlayerSelection} animationType="slide" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Select {selectionType?.toLowerCase().replace('_', ' ')}</Text>
              <ScrollView style={styles.playerList}>
                {selectionType === 'BOWLER'
                  ? bowlingTeam.players.map((player) => (
                      <TouchableOpacity
                        key={player.id}
                        style={[
                          styles.playerButton,
                          player.id === match.currentBowler && match.ballsInOver === 0 && styles.disabledButton,
                        ]}
                        onPress={() => handlePlayerSelection(player)}
                        disabled={player.id === match.currentBowler && match.ballsInOver === 0}
                      >
                        <Text style={styles.playerButtonText}>{player.name}</Text>
                      </TouchableOpacity>
                    ))
                  : getAvailableBatsmen(battingTeam, match.currentBatsmen.striker, match.currentBatsmen.nonStriker).map((player) => (
                      <TouchableOpacity key={player.id} style={styles.playerButton} onPress={() => handlePlayerSelection(player)}>
                        <Text style={styles.playerButtonText}>{player.name}</Text>
                      </TouchableOpacity>
                    ))}
              </ScrollView>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowPlayerSelection(false)}>
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Wicket Type Selection Modal */}
        <Modal visible={showWicketTypeSelection} animationType="slide" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Select Wicket Type</Text>
              {Object.values(DismissalType).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.playerButton}
                  onPress={() => {
                    setShowWicketTypeSelection(false);
                    handleWicket(type);
                  }}
                >
                  <Text style={styles.playerButtonText}>{type.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowWicketTypeSelection(false)}
              >
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Extras Selection Modal */}
        <Modal visible={showExtrasSelection} animationType="slide" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Select Extras Type</Text>
              <ScrollView style={styles.extrasList}>
                {/* Wide */}
                <View style={styles.extrasTypeContainer}>
                  <Text style={styles.extrasTypeTitle}>Wide</Text>
                  <View style={styles.extrasButtonsRow}>
                    {[1, 2, 3, 4].map((runs) => (
                      <TouchableOpacity
                        key={`wide${runs}`}
                        style={styles.extrasRunButton}
                        onPress={() => {
                          handleExtras('wides', runs);
                          setShowExtrasSelection(false);
                        }}
                      >
                        <Text style={styles.extrasRunButtonText}>{runs}W</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                {/* No Ball */}
                <View style={styles.extrasTypeContainer}>
                  <Text style={styles.extrasTypeTitle}>No Ball</Text>
                  <View style={styles.extrasButtonsRow}>
                    {[1, 2, 3, 4].map((runs) => (
                      <TouchableOpacity
                        key={`noball${runs}`}
                        style={styles.extrasRunButton}
                        onPress={() => {
                          handleExtras('noBalls', runs);
                          setShowExtrasSelection(false);
                        }}
                      >
                        <Text style={styles.extrasRunButtonText}>{runs}NB</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Byes */}
                <View style={styles.extrasTypeContainer}>
                  <Text style={styles.extrasTypeTitle}>Byes</Text>
                  <View style={styles.extrasButtonsRow}>
                    {[1, 2, 3, 4].map((runs) => (
                      <TouchableOpacity
                        key={`byes${runs}`}
                        style={styles.extrasRunButton}
                        onPress={() => {
                          handleExtras('byes', runs);
                          setShowExtrasSelection(false);
                        }}
                      >
                        <Text style={styles.extrasRunButtonText}>{runs}B</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Leg Byes */}
                <View style={styles.extrasTypeContainer}>
                  <Text style={styles.extrasTypeTitle}>Leg Byes</Text>
                  <View style={styles.extrasButtonsRow}>
                    {[1, 2, 3, 4].map((runs) => (
                      <TouchableOpacity
                        key={`legbye${runs}`}
                        style={styles.extrasRunButton}
                        onPress={() => {
                          handleExtras('legByes', runs);
                          setShowExtrasSelection(false);
                        }}
                      >
                        <Text style={styles.extrasRunButtonText}>{runs}LB</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowExtrasSelection(false)}
              >
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <MatchCompletionModal
          match={match}
          visible={showMatchCompletion}
          onClose={() => setShowMatchCompletion(false)}
        />
      </ScrollView>
    </View>
  );
}

// Styles (unchanged from original)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { color: '#FFFFFF', marginTop: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  errorText: { color: '#FF4545', fontSize: 16 },
  scorecard: { backgroundColor: '#1A1A1A', padding: 16, borderRadius: 8, marginBottom: 16 },
  teamScore: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  targetInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
  },
  target: {
    color: '#FF9F45',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 2,
  },
  batsmen: { backgroundColor: '#1A1A1A', padding: 16, borderRadius: 8, marginBottom: 16 },
  batsmanInfo: { color: '#FFFFFF', fontSize: 16, marginBottom: 8 },
  bowler: { backgroundColor: '#1A1A1A', padding: 16, borderRadius: 8, marginBottom: 16 },
  bowlerInfo: { color: '#FFFFFF', fontSize: 16 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  button: { backgroundColor: '#1A1A1A', padding: 16, borderRadius: 8, flex: 1, minWidth: 80, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  wicketButton: { backgroundColor: '#FF4545' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { backgroundColor: '#1A1A1A', borderRadius: 8, padding: 16, width: '90%', maxHeight: '80%' },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  playerList: { maxHeight: 300 },
  playerButton: { backgroundColor: '#000', padding: 12, borderRadius: 8, marginBottom: 8 },
  playerButtonText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
  modalCloseButton: { backgroundColor: '#333', padding: 12, borderRadius: 8, marginTop: 16 },
  modalCloseButtonText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
  playerInfo: { backgroundColor: '#1A1A1A', padding: 12, borderRadius: 8, marginBottom: 8 },
  teamSelectionContainer: { gap: 16 },
  teamButton: { backgroundColor: '#000', padding: 16, borderRadius: 8, alignItems: 'center' },
  teamButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  statsContainer: { backgroundColor: '#1A1A1A', padding: 16, borderRadius: 8, marginBottom: 16 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  statsHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#333', marginBottom: 8 },
  statsHeaderText: { color: '#FF9F45', width: 40, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  playerNameCol: { flex: 1, textAlign: 'left' },
  statsRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  statsText: { color: '#FFFFFF', width: 40, textAlign: 'center', fontSize: 14 },
  extrasRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#333', marginTop: 8 },
  disabledButton: { opacity: 0.5, backgroundColor: '#333' },
  matchCompletionModal: {
    backgroundColor: '#1A1A1A',
    padding: 24,
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  resultText: {
    color: '#FF9F45',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
  },
  matchSummary: {
    marginVertical: 16,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  summaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  extrasButton: {
    backgroundColor: '#4A90E2',
  },
  extrasList: {
    maxHeight: 400,
  } as any,
  extrasTypeContainer: {
    marginBottom: 16,
  } as any,
  extrasTypeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  } as any,
  extrasButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  } as any,
  extrasRunButton: {
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  } as any,
  extrasRunButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  } as any,
});
