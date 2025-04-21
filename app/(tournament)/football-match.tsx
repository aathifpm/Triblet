import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  FlatList,
  Image,
  AppState
} from 'react-native';
import { 
  getFirestore, doc, updateDoc, arrayUnion, onSnapshot, 
  collection, getDocs, query, where, getDoc, serverTimestamp
} from 'firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { db, realtimeDb } from '../firebase/config'; // Import realtimeDb from config
import { ref, onValue, set, update, get } from 'firebase/database'; // R

// Define match event types
enum MatchEventType {
  GOAL = 'GOAL',
  YELLOW_CARD = 'YELLOW_CARD',
  RED_CARD = 'RED_CARD',
  SUBSTITUTION = 'SUBSTITUTION',
  PERIOD_CHANGE = 'PERIOD_CHANGE',
  ASSIST = 'ASSIST',
  SAVE = 'SAVE',
  FOUL = 'FOUL',
  OFFSIDE = 'OFFSIDE',
  CORNER = 'CORNER',
  PENALTY = 'PENALTY',
  OWN_GOAL = 'OWN_GOAL'
}

// Define match periods
enum MatchPeriod {
  NOT_STARTED = 'NOT_STARTED',
  FIRST_HALF = 'FIRST_HALF',
  HALF_TIME = 'HALF_TIME',
  SECOND_HALF = 'SECOND_HALF',
  FULL_TIME = 'FULL_TIME',
  EXTRA_TIME_FIRST = 'EXTRA_TIME_FIRST',
  EXTRA_TIME_BREAK = 'EXTRA_TIME_BREAK',
  EXTRA_TIME_SECOND = 'EXTRA_TIME_SECOND',
  PENALTIES = 'PENALTIES'
}

// Define match status
enum MatchStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  POSTPONED = 'POSTPONED',
  CANCELED = 'CANCELED'
}

// Player interface
interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  userId?: string; // Link to user if available
  isStarting: boolean;
  isCaptain: boolean;
  stats: {
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    saves?: number;
    minutesPlayed?: number;
    shotsOnTarget?: number;
    shotsOffTarget?: number;
    fouls?: number;
    offsides?: number;
    corners?: number;
    tackles?: number;
    interceptions?: number;
    cleanSheets?: number;
  };
}

// Team interface
interface Team {
  id: string;
  name: string;
  logo?: string;
  score: number;
  possession: number;
  shots: number;
  shotsOnTarget: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  corners: number;
  offsides: number;
  players: Player[]; // Array of players
  formation: string; // Team formation
  substitutes: Player[]; // Players on the bench
}

// Match event interface
interface MatchEvent {
  id?: string;
  time: number;
  type: MatchEventType;
  teamId: string;
  playerId: string;
  playerName?: string;
  secondPlayerId?: string; // For assists, substitutions
  secondPlayerName?: string;
  additionalInfo?: string;
  timestamp: Date | any; // Can be JavaScript Date or Firestore timestamp
}

// Penalty Kick interface
interface PenaltyKick {
  teamId: string;
  scored: boolean;
  playerId?: string;
  playerName?: string;
}

// Football match interface
interface FootballMatch {
  id: string;
  tournamentId?: string;
  team1: Team;
  team2: Team;
  venueId?: string;
  venueName?: string;
  startTime?: any; // Firestore timestamp
  period: MatchPeriod;
  currentTime: number; // Time in minutes
  extraTime: number; // Added time in minutes
  status: MatchStatus; // Changed from matchStatus to status
  events: MatchEvent[];
  periodEndNotified?: boolean; // Tracks if period end notification has been shown
  referee?: string;
  round?: string; // e.g., "Quarter Final", "Group Stage", etc.
  notes?: string;
  attendance?: number;
  weather?: string;
  result?: string; // Match result for display and database storage
  clockRunning: boolean;
  secondHalfContinued?: boolean; // Add this new field
  penaltyKicks?: PenaltyKick[]; // Add this field for tracking penalties
}

export default function FootballMatch() {
  const [match, setMatch] = useState<FootballMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockRunning, setClockRunning] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [eventType, setEventType] = useState<MatchEventType>(MatchEventType.GOAL);
  const [selectedTeam, setSelectedTeam] = useState<'team1' | 'team2' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [secondSelectedPlayer, setSecondSelectedPlayer] = useState<string | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [playersList, setPlayersList] = useState<{ [teamId: string]: Player[] }>({});
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [subOutPlayer, setSubOutPlayer] = useState<string | null>(null);
  const [subInPlayer, setSubInPlayer] = useState<string | null>(null);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);
  const [extraTimeMinutes, setExtraTimeMinutes] = useState<number>(15); // Default extra time is 15 minutes per half
  const [eventsExpanded, setEventsExpanded] = useState(false); // Add back this state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [currentSeconds, setCurrentSeconds] = useState<number>(0); // Add seconds state
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const clockRef = useRef<NodeJS.Timeout | null>(null);
  const { matchId } = useLocalSearchParams();
  const { currentUser } = useAuth();
  const router = useRouter();
  const db = getFirestore();

  // Add a state variable to track how second half was started
  const [secondHalfContinued, setSecondHalfContinued] = useState<boolean>(false);

  useEffect(() => {
    let unsubscribe: () => void;

    if (matchId) {
      setLoading(true);
      const db = getFirestore();
      const matchRef = doc(db, 'matches', matchId as string);

      unsubscribe = onSnapshot(
        matchRef,
        async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            console.log('Match data loaded from Firestore:', data);
            
            // Initialize match data with values from DB
            const matchData: FootballMatch = {
              id: snapshot.id,
              tournamentId: data.tournamentId || null,
              venueId: data.venueId || null,
              venueName: data.venueName || 'Unknown Venue',
              startTime: data.startTime || null,
              team1: {
                id: data.team1Id || '',
                // Try multiple sources for team name
                name: data.team1Name || (data.team1 && data.team1.name) || 'Team 1',
                logo: (data.team1 && data.team1.logo) || data.team1Logo || null,
                score: (data.team1 && data.team1.score) || 0,
                possession: (data.team1 && data.team1.possession) || 50,
                shots: (data.team1 && data.team1.shots) || 0,
                shotsOnTarget: (data.team1 && data.team1.shotsOnTarget) || 0,
                fouls: (data.team1 && data.team1.fouls) || 0,
                yellowCards: (data.team1 && data.team1.yellowCards) || 0,
                redCards: (data.team1 && data.team1.redCards) || 0,
                corners: (data.team1 && data.team1.corners) || 0,
                offsides: (data.team1 && data.team1.offsides) || 0,
                players: (data.team1 && data.team1.players) || [],
                formation: (data.team1 && data.team1.formation) || '4-4-2',
                substitutes: (data.team1 && data.team1.substitutes) || [],
              },
              team2: {
                id: data.team2Id || '',
                // Try multiple sources for team name
                name: data.team2Name || (data.team2 && data.team2.name) || 'Team 2',
                logo: (data.team2 && data.team2.logo) || data.team2Logo || null,
                score: (data.team2 && data.team2.score) || 0,
                possession: (data.team2 && data.team2.possession) || 50,
                shots: (data.team2 && data.team2.shots) || 0,
                shotsOnTarget: (data.team2 && data.team2.shotsOnTarget) || 0,
                fouls: (data.team2 && data.team2.fouls) || 0,
                yellowCards: (data.team2 && data.team2.yellowCards) || 0,
                redCards: (data.team2 && data.team2.redCards) || 0,
                corners: (data.team2 && data.team2.corners) || 0,
                offsides: (data.team2 && data.team2.offsides) || 0,
                players: (data.team2 && data.team2.players) || [],
                formation: (data.team2 && data.team2.formation) || '4-4-2',
                substitutes: (data.team2 && data.team2.substitutes) || [],
              },
              period: data.period || MatchPeriod.NOT_STARTED,
              currentTime: data.currentTime || 0,
              extraTime: data.extraTime || 0,
              status: data.status || MatchStatus.NOT_STARTED,
              events: data.events || [],
              referee: data.referee || null,
              round: data.round || null,
              notes: data.notes || null,
              attendance: data.attendance || null,
              weather: data.weather || null,
              result: data.result || null,
              clockRunning: data.clockRunning || false,
              secondHalfContinued: data.secondHalfContinued || false, // Add this line
              penaltyKicks: data.penaltyKicks || [],
            };

            console.log('Team names from loaded data:', matchData.team1.name, matchData.team2.name);
            setMatch(matchData);
            
            // Auto-start the clock if match is in progress
            if ((matchData.period === MatchPeriod.FIRST_HALF || 
                 matchData.period === MatchPeriod.SECOND_HALF || 
                 matchData.period === MatchPeriod.EXTRA_TIME_FIRST || 
                 matchData.period === MatchPeriod.EXTRA_TIME_SECOND) && 
                matchData.status === MatchStatus.IN_PROGRESS) {
              setClockRunning(true);
            } else {
              setClockRunning(false);
            }
            
            // Check if we need to fetch team data
            const needsFetch = data.team1Id && data.team2Id && (
               matchData.team1.players.length === 0 || 
               matchData.team2.players.length === 0 ||
               matchData.team1.name === 'Team 1' ||  // Default name, need to fetch real name
               matchData.team2.name === 'Team 2' ||  // Default name, need to fetch real name
               !data.team1Name || !data.team2Name     // Missing top-level name field
            );

            if (needsFetch) {
              console.log('Fetching team data due to missing players or team names');
              fetchTeamPlayers(data.team1Id, data.team2Id);
            } else {
              console.log('Using existing team names:', matchData.team1.name, matchData.team2.name);
              // Store players in state for easier access if they're already in the match document
              if (matchData.team1.players.length > 0 || matchData.team2.players.length > 0) {
                const players: {[teamId: string]: Player[]} = {};
                players[matchData.team1.id] = [...matchData.team1.players, ...matchData.team1.substitutes];
                players[matchData.team2.id] = [...matchData.team2.players, ...matchData.team2.substitutes];
                setPlayersList(players);
              }
            }
          } else {
            Alert.alert('Error', 'Match not found');
          }
          setLoading(false);
        },
        (error) => {
          console.error('Error listening to match updates:', error);
          Alert.alert('Error', 'Failed to listen to match updates');
          setLoading(false);
        }
      );

      // Cleanup subscription on unmount
      return () => {
        unsubscribe();
        if (clockRef.current) {
          clearInterval(clockRef.current);
        }
      };
    }
  }, [matchId]);

  // Initialize timer with server time offset when match is loaded
  useEffect(() => {
    // Get server/client time offset for accuracy
    const getServerOffset = () => {
      const offsetRef = ref(realtimeDb, '.info/serverTimeOffset');
      onValue(offsetRef, (snapshot) => {
        const offset = snapshot.val() || 0;
        setServerTimeOffset(offset);
      });
    };

    if (match?.id) {
      getServerOffset();
      // Create timer reference in RTDB
      const timerRef = ref(realtimeDb, `matchTimers/${match.id}`);
      // Initialize timer data if it doesn't exist
      get(timerRef).then((snapshot) => {
        if (!snapshot.exists()) {
          // If timer data doesn't exist, create it
          set(timerRef, {
            running: match.clockRunning || false,
            period: match.period,
            baseTimeSeconds: match.currentTime * 60, // Convert minutes to seconds
            startedAt: match.clockRunning ? Date.now() : null,
            extraTime: match.extraTime,
            secondHalfContinued: match.secondHalfContinued || false
          });
          // Set local state to match
          setClockRunning(match.clockRunning || false);
          setSecondHalfContinued(match.secondHalfContinued || false);
        } else {
          // If timer data exists, sync local state with it
          const timerData = snapshot.val();
          setClockRunning(timerData.running || false);
          setSecondHalfContinued(timerData.secondHalfContinued || false);
        }
      });
    }
  }, [match?.id]);

  // Listen for timer updates
  useEffect(() => {
    if (!match?.id) return;
    
    const timerRef = ref(realtimeDb, `matchTimers/${match.id}`);
    const unsubscribe = onValue(timerRef, (snapshot) => {
      const timerData = snapshot.val();
      if (!timerData) return;
      
      // Clear any existing interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      // Always update clockRunning state to match the timer's running state from the database
      setClockRunning(timerData.running);
      
      // Sync the secondHalfContinued flag
      if (timerData.secondHalfContinued !== undefined) {
        setSecondHalfContinued(timerData.secondHalfContinued);
      }
      
      if (timerData.running) {
        // Create function to calculate and update time
        const calculateAndUpdateTime = () => {
          const now = Date.now() + serverTimeOffset;
          const elapsedSeconds = (now - timerData.startedAt) / 1000;
          const totalSeconds = timerData.baseTimeSeconds + elapsedSeconds;
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = Math.floor(totalSeconds % 60);
          
          // Update both minutes and seconds
          setCurrentTime(minutes);
          setCurrentSeconds(seconds);
          
          // Update local state without firebase updates
          setMatch(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              currentTime: minutes,
              clockRunning: true,
              secondHalfContinued: timerData.secondHalfContinued
            };
          });
        };
        
        // Initial calculation
        calculateAndUpdateTime();
        
        // Set interval for UI updates only
        timerIntervalRef.current = setInterval(calculateAndUpdateTime, 1000);
      } else {
        // Update with the stopped time
        const minutes = Math.floor(timerData.baseTimeSeconds / 60);
        const seconds = Math.floor(timerData.baseTimeSeconds % 60);
        
        // Update both minutes and seconds
        setCurrentTime(minutes);
        setCurrentSeconds(seconds);
        
        setMatch(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            currentTime: minutes,
            clockRunning: false,
            secondHalfContinued: timerData.secondHalfContinued
          };
        });
      }
    });
    
    return () => {
      unsubscribe();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [match?.id, serverTimeOffset]);

  // Update the match time in Firestore with proper timestamp tracking
  const updateMatchTime = async (minutes: number, seconds: number) => {
    if (!match) return;
    
    const totalSeconds = (minutes * 60) + seconds;
    
    // Update time in RTDB
    const timerRef = ref(realtimeDb, `matchTimers/${match.id}`);
    await update(timerRef, {
      baseTimeSeconds: totalSeconds
    });
    
    // Continue with the existing Firestore update logic
    await updateDoc(doc(db, 'matches', matchId as string), {
      currentTime: minutes // Firestore still stores just minutes for compatibility
    });
    
    setMatch(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        currentTime: minutes
      };
    });
  };

  // Fetch team players from Team collection
  const fetchTeamPlayers = async (team1Id: string, team2Id: string) => {
    try {
      console.log('Fetching players for teams:', team1Id, team2Id);
      const teamsRef = collection(db, 'teams');
      
      // Check if team IDs are valid
      if (!team1Id || !team2Id) {
        Alert.alert('Error', 'One or both teams are missing from this match setup.');
        return;
      }
      
      // Get team 1 details
      const team1Doc = await getDoc(doc(teamsRef, team1Id));
      let team1Loaded = false;
      
      if (team1Doc.exists()) {
        const team1Data = team1Doc.data();
        console.log('Team 1 data:', JSON.stringify(team1Data));
        
        // Check different possible property names for player IDs
        const playerIds = team1Data.playersIds || team1Data.playerIds || team1Data.players || [];
        console.log('Team 1 player IDs:', playerIds);
        
        if (playerIds.length > 0) {
          // Get players data from users collection using playersIds
          const team1Players = await fetchPlayersFromUserIds(playerIds, team1Id);
          
          // Update match with team 1 players
          updateTeamPlayers('team1', team1Players);
          
          // Update team name, logo, and formation if available
          const teamInfo = {
            name: team1Data.name || 'Team 1',
            logo: team1Data.logo || null,
            formation: team1Data.formation || '4-4-2'
          };
          
          console.log(`Team 1 info to update: Name=${teamInfo.name}, Formation=${teamInfo.formation}`);
          
          // Also update team1Id and team1Name directly in the document to ensure consistency
          await updateDoc(doc(db, 'matches', matchId as string), {
            team1Id: team1Id,
            team1Name: teamInfo.name,
            team1Logo: teamInfo.logo
          });
          
          updateTeamInfo('team1', teamInfo.name, teamInfo.logo, teamInfo.formation);
          team1Loaded = true;
        } else {
          console.log('No player IDs found for team 1');
        }
      } else {
        console.log('Team 1 document not found');
      }
      
      // Get team 2 details
      const team2Doc = await getDoc(doc(teamsRef, team2Id));
      let team2Loaded = false;
      
      if (team2Doc.exists()) {
        const team2Data = team2Doc.data();
        console.log('Team 2 data:', JSON.stringify(team2Data));
        
        // Check different possible property names for player IDs
        const playerIds = team2Data.playersIds || team2Data.playerIds || team2Data.players || [];
        console.log('Team 2 player IDs:', playerIds);
        
        if (playerIds.length > 0) {
          // Get players data from users collection using playersIds
          const team2Players = await fetchPlayersFromUserIds(playerIds, team2Id);
          
          // Update match with team 2 players
          updateTeamPlayers('team2', team2Players);
          
          // Update team name, logo, and formation if available
          const teamInfo = {
            name: team2Data.name || 'Team 2',
            logo: team2Data.logo || null, 
            formation: team2Data.formation || '4-4-2'
          };
          
          console.log(`Team 2 info to update: Name=${teamInfo.name}, Formation=${teamInfo.formation}`);
          
          // Also update team2Id and team2Name directly in the document to ensure consistency
          await updateDoc(doc(db, 'matches', matchId as string), {
            team2Id: team2Id,
            team2Name: teamInfo.name,
            team2Logo: teamInfo.logo
          });
          
          updateTeamInfo('team2', teamInfo.name, teamInfo.logo, teamInfo.formation);
          team2Loaded = true;
        } else {
          console.log('No player IDs found for team 2');
        }
      } else {
        console.log('Team 2 document not found');
      }

      // Force a reload of the match data
      if (team1Loaded || team2Loaded) {
        const matchDoc = await getDoc(doc(db, 'matches', matchId as string));
        if (matchDoc.exists() && match) {
          const matchData = matchDoc.data();
          console.log('Reloaded match data with team names:', 
            matchData.team1Name || (matchData.team1 && matchData.team1.name), 
            matchData.team2Name || (matchData.team2 && matchData.team2.name));
          
          // Create a deep copy of the current match
          const updatedMatch: FootballMatch = { ...match };
          
          // Update team names if they were loaded
          if (team1Loaded && updatedMatch.team1) {
            const team1Name = matchData.team1Name || (matchData.team1 && matchData.team1.name);
            if (team1Name) {
              updatedMatch.team1.name = team1Name;
            }
          }
          
          if (team2Loaded && updatedMatch.team2) {
            const team2Name = matchData.team2Name || (matchData.team2 && matchData.team2.name);
            if (team2Name) {
              updatedMatch.team2.name = team2Name;
            }
          }
          
          // Update the state with the refreshed match data
          setMatch(updatedMatch);
        }
      }
      
      // Check if both teams were loaded successfully
      if (!team1Loaded || !team2Loaded) {
        let message = '';
        if (!team1Loaded && !team2Loaded) {
          message = 'Both teams are missing player data.';
        } else if (!team1Loaded) {
          message = 'Team 1 is missing player data.';
        } else {
          message = 'Team 2 is missing player data.';
        }
        
        Alert.alert(
          'Team Data Missing',
          `${message} Go to the Teams section to add players.`,
          [
            {
              text: 'OK',
              style: 'default'
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error fetching team players:', error);
      Alert.alert('Error', 'Failed to load team data. Please try again.');
    }
  };

  // Update team info (name and logo)
  const updateTeamInfo = async (teamKey: 'team1' | 'team2', teamName: string, teamLogo?: string, teamFormation?: string) => {
    if (!match) return;

    try {
      console.log(`Updating ${teamKey} name to "${teamName}" in match state`);
      
      // Create a deep copy of the match and fix type issues
      const updatedMatch: FootballMatch = { ...match };
      
      // Update the team name in the nested object
      if (updatedMatch[teamKey]) {
        updatedMatch[teamKey].name = teamName;
        
        // Update other team properties if provided
        if (teamLogo) {
          updatedMatch[teamKey].logo = teamLogo;
        }
        if (teamFormation) {
          updatedMatch[teamKey].formation = teamFormation;
        }
      }
      
      // Apply the updated match to state
      setMatch(updatedMatch);
      
      // Prepare Firestore update with BOTH nested and top-level fields for compatibility
      const updateData: any = {
        [`${teamKey}.name`]: teamName,
        [`${teamKey}Name`]: teamName,
      };
      
      if (teamLogo) {
        updateData[`${teamKey}.logo`] = teamLogo;
        updateData[`${teamKey}Logo`] = teamLogo;
      }
      
      if (teamFormation) {
        updateData[`${teamKey}.formation`] = teamFormation;
      }
      
      console.log(`Updating ${teamKey} in Firestore:`, updateData);
      
      // Update the Firestore document
      await updateDoc(doc(db, 'matches', matchId as string), updateData);
      
      console.log(`Successfully updated ${teamKey} name to "${teamName}" in Firestore`);
    } catch (error) {
      console.error(`Error updating ${teamKey} info:`, error);
      // Don't show an alert for every update error to avoid spamming the user
    }
  };

  // Fetch players from user IDs
  const fetchPlayersFromUserIds = async (playerIds: string[], teamId: string): Promise<Player[]> => {
    const players: Player[] = [];
    
    try {
      console.log(`Fetching ${playerIds.length} players for team ${teamId}`);
      const usersRef = collection(db, 'users');

      // First get team data to know which player is the captain
      const teamRef = doc(collection(db, 'teams'), teamId);
      const teamDoc = await getDoc(teamRef);
      const captainId = teamDoc.exists() ? teamDoc.data().captain : null;
      
      // Process player IDs in batches to avoid exceeding Firestore limits
      const batchSize = 10;
      
      for (let i = 0; i < playerIds.length; i += batchSize) {
        const batch = playerIds.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1}, batch size: ${batch.length}`);
        
        // Create an array of promises for getting user docs
        const userPromises = batch.map(playerId => {
          console.log('Fetching user:', playerId);
          return getDoc(doc(usersRef, playerId));
        });
        
        const userDocs = await Promise.all(userPromises);
        console.log(`Retrieved ${userDocs.filter(doc => doc.exists()).length} valid users from batch`);
        
        userDocs.forEach((userDoc, index) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log(`User data for ${userDoc.id}:`, userData.name);
            
            // Determine position based on skillLevel
            let position = 'Unknown';
            if (userData.skillLevel) {
              const skillLevel = String(userData.skillLevel).toUpperCase();
              if (['GOALKEEPER', 'KEEPER', 'GK'].includes(skillLevel)) {
                position = 'GK';
              } else if (['DEFENDER', 'DEF', 'CENTRE-BACK', 'FULL-BACK'].includes(skillLevel)) {
                position = 'DEF';
              } else if (['MIDFIELDER', 'MID', 'CDM', 'CAM', 'CM'].includes(skillLevel)) {
                position = 'MID';
              } else if (['FORWARD', 'FWD', 'STRIKER', 'STR', 'WINGER'].includes(skillLevel)) {
                position = 'FWD';
              }
            }
            
            const player: Player = {
              id: userDoc.id,
              name: userData.name || 'Unknown Player',
              number: players.length + 1, // Assign number based on index
              position: position,
              userId: userDoc.id,
              isStarting: players.length < 11, // First 11 players are starters
              isCaptain: captainId === userDoc.id, // Check if player is captain
              stats: {
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
                saves: 0,
                minutesPlayed: 0,
                shotsOnTarget: 0,
                shotsOffTarget: 0,
                fouls: 0,
                offsides: 0,
                corners: 0,
                tackles: 0,
                interceptions: 0,
                cleanSheets: 0,
              }
            };
            
            players.push(player);
          } else {
            console.log(`User document not found for ID: ${batch[index]}`);
          }
        });
      }
      
      console.log(`Total players retrieved for team ${teamId}: ${players.length}`);
      
      // Store players in local state
      setPlayersList(prev => ({
        ...prev,
        [teamId]: players
      }));
      
      return players;
    } catch (error) {
      console.error('Error fetching player details:', error);
      return [];
    }
  };

  // Update team players in the match document
  const updateTeamPlayers = async (teamKey: 'team1' | 'team2', players: Player[]) => {
    if (!match) return;

    try {
      // Sort players by position for a more logical lineup
      players.sort((a, b) => {
        const positionOrder: {[key: string]: number} = {
          'GK': 1,
          'DEF': 2,
          'MID': 3,
          'FWD': 4,
          'Unknown': 5
        };
        
        return (positionOrder[a.position] || 5) - (positionOrder[b.position] || 5);
      });
      
      // Mark the first 11 players as starters, the rest as substitutes
      // Make sure there's at least one goalkeeper in the starting lineup
      let hasGoalkeeper = players.slice(0, 11).some(p => p.position === 'GK');
      
      if (!hasGoalkeeper) {
        // Find the first goalkeeper and swap with a field player
        const gkIndex = players.findIndex(p => p.position === 'GK');
        if (gkIndex >= 0 && gkIndex >= 11) {
          // Swap with the last starter
          const temp = players[10];
          players[10] = players[gkIndex];
          players[gkIndex] = temp;
        }
      }
      
      // Update isStarting flag for all players
      players.forEach((player, index) => {
        player.isStarting = index < 11;
      });
      
      const starters = players.filter(p => p.isStarting);
      const substitutes = players.filter(p => !p.isStarting);
      
      const updatedMatch = { ...match };
      updatedMatch[teamKey].players = starters;
      updatedMatch[teamKey].substitutes = substitutes;
      
      // Also update formation from the team if available
      if (match[teamKey].formation) {
        updatedMatch[teamKey].formation = match[teamKey].formation;
      }
      
      setMatch(updatedMatch);
      
      // Update Firestore
      const updateData = {
        [`${teamKey}.players`]: starters,
        [`${teamKey}.substitutes`]: substitutes
      };
      
      await updateDoc(doc(db, 'matches', matchId as string), updateData);
    } catch (error) {
      console.error('Error updating team players:', error);
      Alert.alert('Error', 'Failed to update team players');
    }
  }
  
  // Helper function to check if match updates are allowed
  const isMatchEditable = (): boolean => {
    if (!match) return false;
    return match.status !== MatchStatus.COMPLETED;
  };

  // Replace the existing toggleClock function
  const toggleClock = async () => {
    if (!match) return;
    
    const timerRef = ref(realtimeDb, `matchTimers/${match.id}`);
    const snapshot = await get(timerRef);
    const timerData = snapshot.val() || {
      running: false,
      period: match.period,
      baseTimeSeconds: (match.currentTime * 60) + currentSeconds,
      extraTime: match.extraTime
    };
    
    // Check if we're in half time and trying to start the clock
    if (!timerData.running && match.period === MatchPeriod.HALF_TIME) {
      // Ask user how to proceed to second half
      Alert.alert(
        'Start Second Half',
        'How would you like to start the second half?',
        [
          {
            text: 'Start at 45:00',
            onPress: async () => {
              // Transition to second half with reset time
              const newPeriod = MatchPeriod.SECOND_HALF;
              
              // Set the flag to indicate second half starts fresh at 45:00
              setSecondHalfContinued(false);
              
              // Update period in RTDB
              await update(timerRef, {
                period: newPeriod,
                baseTimeSeconds: 0, // Reset to 0 (will display as 45:00)
                running: true,
                startedAt: Date.now() + serverTimeOffset,
                secondHalfContinued: false // Explicitly mark as not continued
              });
              
              // Update Firestore
              const periodChangeEvent: MatchEvent = {
                type: MatchEventType.PERIOD_CHANGE,
                time: 45, // Start at 45 minutes
                teamId: 'none',
                playerId: 'none',
                additionalInfo: getPeriodDisplayName(newPeriod),
                timestamp: new Date()
              };
              
              await updateDoc(doc(db, 'matches', matchId as string), {
                period: newPeriod,
                currentTime: 0, // Reset to 0 in Firestore
                clockRunning: true,
                events: arrayUnion(periodChangeEvent),
                secondHalfContinued: false // Explicitly mark as not continued
              });
              
              // Update local state
              setCurrentTime(0);
              setCurrentSeconds(0);
              setClockRunning(true);
              
              setMatch(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  period: newPeriod,
                  currentTime: 0,
                  clockRunning: true,
                  events: [...prev.events, periodChangeEvent],
                  secondHalfContinued: false // Explicitly mark as not continued
                };
              });
            }
          },
          {
            text: 'Continue from current time',
            onPress: async () => {
              // Transition to second half keeping current time
              const newPeriod = MatchPeriod.SECOND_HALF;
              
              // Set the flag to indicate second half continues from current time
              setSecondHalfContinued(true);
              
              // Get the exact current time in seconds
              const totalCurrentSeconds = timerData.baseTimeSeconds;
              
              // Update period in RTDB
              await update(timerRef, {
                period: newPeriod,
                running: true,
                baseTimeSeconds: totalCurrentSeconds, // Keep exactly the same time
                startedAt: Date.now() + serverTimeOffset,
                secondHalfContinued: true // Store this info in the database too
              });
              
              // Update Firestore
              const periodChangeEvent: MatchEvent = {
                type: MatchEventType.PERIOD_CHANGE,
                time: currentTime + (currentSeconds / 60),
                teamId: 'none',
                playerId: 'none',
                additionalInfo: getPeriodDisplayName(newPeriod),
                timestamp: new Date()
              };
              
              // Update Firestore with current time in minutes
              const minutes = Math.floor(totalCurrentSeconds / 60);
              await updateDoc(doc(db, 'matches', matchId as string), {
                period: newPeriod,
                clockRunning: true,
                currentTime: minutes, // Keep current time in minutes
                events: arrayUnion(periodChangeEvent),
                secondHalfContinued: true // Store this info in Firestore too
              });
              
              // Update local state
              setClockRunning(true);
              
              setMatch(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  period: newPeriod,
                  currentTime: minutes, // Update with current minutes
                  clockRunning: true,
                  events: [...prev.events, periodChangeEvent],
                  secondHalfContinued: true // Update in match state
                };
              });
            }
          }
        ],
        { cancelable: true }
      );
      return;
    }
    
    // Normal toggle clock logic for other periods
    if (!timerData.running) {
      // Start the clock
      await update(timerRef, {
        running: true,
        startedAt: Date.now() + serverTimeOffset
      });
      
      // Also update Firestore for compatibility with existing code
      await updateDoc(doc(db, 'matches', matchId as string), {
        clockRunning: true
      });
      
      setClockRunning(true);
    } else {
      // Stop the clock and update the base time
      const now = Date.now() + serverTimeOffset;
      const elapsedSeconds = (now - timerData.startedAt) / 1000;
      const newBaseTime = timerData.baseTimeSeconds + elapsedSeconds;
      
      await update(timerRef, {
        running: false,
        baseTimeSeconds: newBaseTime,
        startedAt: null
      });
      
      // Update Firestore with new time and clock state
      const minutes = Math.floor(newBaseTime / 60);
      await updateDoc(doc(db, 'matches', matchId as string), {
        clockRunning: false,
        currentTime: minutes
      });
      
      setClockRunning(false);
    }
  };

  // Add a goal
  const handleGoal = async (teamId: string) => {
    try {
      // Don't allow updates if match is completed
      if (!isMatchEditable()) {
        Alert.alert('Match Completed', 'This match has ended and cannot be updated.');
        return;
      }

      console.log('Adding goal for team:', teamId);
      console.log('Team1 ID:', match?.team1.id);
      console.log('Team2 ID:', match?.team2.id);
      
      if (match?.team1.id === teamId) {
        setSelectedTeam('team1');
      } else if (match?.team2.id === teamId) {
        setSelectedTeam('team2');
      } else {
        console.error('Cannot determine which team this ID belongs to:', teamId);
        Alert.alert('Error', 'Cannot determine which team this ID belongs to');
        return;
      }
      
      setEventType(MatchEventType.GOAL);
      setEventModalVisible(true);
    } catch (error) {
      console.error('Error preparing to add goal:', error);
      Alert.alert('Error', 'Failed to prepare goal form');
    }
  };

  // Add a card (yellow or red)
  const handleCard = async (teamId: string, cardType: 'yellow' | 'red') => {
    try {
      // Don't allow updates if match is completed
      if (!isMatchEditable()) {
        Alert.alert('Match Completed', 'This match has ended and cannot be updated.');
        return;
      }

      console.log('Adding card for team:', teamId);
      console.log('Team1 ID:', match?.team1.id);
      console.log('Team2 ID:', match?.team2.id);
      
      if (match?.team1.id === teamId) {
        setSelectedTeam('team1');
      } else if (match?.team2.id === teamId) {
        setSelectedTeam('team2');
      } else {
        console.error('Cannot determine which team this ID belongs to:', teamId);
        Alert.alert('Error', 'Cannot determine which team this ID belongs to');
        return;
      }
      
      setEventType(cardType === 'yellow' ? MatchEventType.YELLOW_CARD : MatchEventType.RED_CARD);
      setEventModalVisible(true);
    } catch (error) {
      console.error('Error preparing to add card:', error);
      Alert.alert('Error', 'Failed to prepare card form');
    }
  };

  // Helper function to get display name for match periods
  const getPeriodDisplayName = (period: MatchPeriod): string => {
    switch (period) {
      case MatchPeriod.NOT_STARTED:
        return 'Match Not Started';
      case MatchPeriod.FIRST_HALF:
        return 'First Half';
      case MatchPeriod.HALF_TIME:
        return 'Half Time';
      case MatchPeriod.SECOND_HALF:
        return 'Second Half';
      case MatchPeriod.FULL_TIME:
        return 'Full Time';
      case MatchPeriod.EXTRA_TIME_FIRST:
        return 'First Half of Extra Time';
      case MatchPeriod.EXTRA_TIME_BREAK:
        return 'Extra Time Break';
      case MatchPeriod.EXTRA_TIME_SECOND:
        return 'Second Half of Extra Time';
      case MatchPeriod.PENALTIES:
        return 'Penalty Shootout';
      default:
        return period;
    }
  };

  // Update the handlePeriodChange function
  const handlePeriodChange = async (newPeriod: MatchPeriod) => {
    if (!match) return;
    
    // First stop the clock if running
    const timerRef = ref(realtimeDb, `matchTimers/${match.id}`);
    const snapshot = await get(timerRef);
    const timerData = snapshot.val();
    
    if (timerData && timerData.running) {
      // Calculate final time for current period
      const now = Date.now() + serverTimeOffset;
      const elapsedSeconds = (now - timerData.startedAt) / 1000;
      const finalSeconds = timerData.baseTimeSeconds + elapsedSeconds;
      
      // Set the appropriate base time for each period
      let newBaseTime = finalSeconds; // Default to current time
      
      // Set specific times for different period transitions
      // Don't reset for SECOND_HALF since user will decide in toggleClock
      if (newPeriod === MatchPeriod.EXTRA_TIME_FIRST) {
        // First extra time starts at 0 seconds (will display as 90:00)
        newBaseTime = 0;
      } else if (newPeriod === MatchPeriod.EXTRA_TIME_SECOND) {
        // Second extra time starts at 0 seconds (will display as 105:00)
        newBaseTime = 0;
      }
      
      await update(timerRef, {
        running: false,
        period: newPeriod,
        baseTimeSeconds: newBaseTime,
        startedAt: null
      });
      
      // Explicitly set clockRunning state to false
      setClockRunning(false);
    } else if (timerData) {
      // Set the appropriate base time for each period
      let newBaseTime = timerData.baseTimeSeconds; // Default to current time
      
      // Set specific times for different period transitions
      // Don't reset for SECOND_HALF since user will decide in toggleClock
      if (newPeriod === MatchPeriod.EXTRA_TIME_FIRST) {
        // First extra time starts at 0 seconds (will display as 90:00)
        newBaseTime = 0;
      } else if (newPeriod === MatchPeriod.EXTRA_TIME_SECOND) {
        // Second extra time starts at 0 seconds (will display as 105:00)
        newBaseTime = 0;
      }
      
      await update(timerRef, {
        period: newPeriod,
        baseTimeSeconds: newBaseTime
      });
    }
    
    // Update current time and seconds state to match the period change
    if (newPeriod === MatchPeriod.EXTRA_TIME_FIRST || 
        newPeriod === MatchPeriod.EXTRA_TIME_SECOND) {
      setCurrentTime(0);
      setCurrentSeconds(0);
    }
    
    // Continue with the existing Firestore update logic
    await updatePeriodInDatabase(newPeriod);
  };

  // Update the setExtraTimeAndProceed function to work with RTDB
  const setExtraTimeAndProceed = async (minutes: number) => {
    if (!match) return;
    
    // Update extra time in RTDB
    const timerRef = ref(realtimeDb, `matchTimers/${match.id}`);
    await update(timerRef, {
      extraTime: minutes
    });
    
    // Continue with the existing Firestore update logic
    await updateDoc(doc(db, 'matches', matchId as string), {
      extraTime: minutes
    });
    
    setMatch(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        extraTime: minutes
      };
    });
    
// Continue with existing proceedToNextPeriod logic
    await proceedToExtraTime();
  };

  // Helper function to proceed to extra time
  const proceedToExtraTime = async () => {
    const extraTimeFirstPeriod = MatchPeriod.EXTRA_TIME_FIRST;
    const periodChangeEvent: MatchEvent = {
      type: MatchEventType.PERIOD_CHANGE,
      time: match!.currentTime,
      teamId: 'none',
      playerId: 'none',
      additionalInfo: getPeriodDisplayName(extraTimeFirstPeriod),
      timestamp: new Date()
    };

    // Update match with extra time period
    const matchRef = doc(db, 'matches', matchId as string);
    await updateDoc(matchRef, {
      period: extraTimeFirstPeriod,
      events: arrayUnion(periodChangeEvent),
      periodEndNotified: false
    });

    // Update local match state
    setMatch({
      ...match!,
      period: extraTimeFirstPeriod,
      events: [...match!.events, periodChangeEvent],
      periodEndNotified: false
    });

    // Show notification
    Alert.alert(
      'Extra Time',
      'The match will continue with extra time. Click start to begin the first half of extra time.',
      [{ text: 'OK' }]
    );
  };

  // Helper function to complete the match with a period change
  const completeMatch = async (newPeriod: MatchPeriod) => {
    const periodChangeEvent: MatchEvent = {
      type: MatchEventType.PERIOD_CHANGE,
      time: match!.currentTime,
      teamId: 'none',
      playerId: 'none',
      additionalInfo: getPeriodDisplayName(newPeriod),
      timestamp: new Date()
    };

    // Determine match result
    const matchResult = getMatchResult();

    // For penalties, ensure we record that it was decided by penalties
    let finalPeriod = newPeriod;
    if (match?.period === MatchPeriod.PENALTIES) {
      finalPeriod = MatchPeriod.PENALTIES; // Ensure we keep track of penalties
    }

    // Update match with completed status
    const matchRef = doc(db, 'matches', matchId as string);
    await updateDoc(matchRef, {
      period: finalPeriod,
      events: arrayUnion(periodChangeEvent),
      periodEndNotified: false,
      status: MatchStatus.COMPLETED,
      result: matchResult
    });

    // Update local match state
    setMatch({
      ...match!,
      period: finalPeriod,
      events: [...match!.events, periodChangeEvent],
      periodEndNotified: false,
      status: MatchStatus.COMPLETED,
      result: matchResult
    });

    // If this match is part of a tournament, update the LiveMatch record
    if (match?.tournamentId) {
      try {
        // Query LiveMatch collection to find the match
        const liveMatchesQuery = query(
          collection(db, 'liveMatches'),
          where('team1.teamId', '==', match.team1.id),
          where('team2.teamId', '==', match.team2.id)
        );
        
        const liveMatchSnapshot = await getDocs(liveMatchesQuery);
        
        if (!liveMatchSnapshot.empty) {
          // Update the LiveMatch with the result
          const liveMatchDoc = liveMatchSnapshot.docs[0];
          await updateDoc(doc(db, 'liveMatches', liveMatchDoc.id), {
            result: matchResult,
            status: 'Completed'
          });
        }
      } catch (error) {
        console.error('Error updating tournament match result:', error);
      }
    }

    // Handle post-match updates
    await updateTeamsAfterMatch();
    await updateLeaderboard();
    
    // Show notification
    Alert.alert(
      'Match Completed', 
      `The match has been recorded as completed. ${matchResult}`,
      [{ text: 'OK' }]
    );
    
    // Ensure the clock is stopped
    setClockRunning(false);
  };

  // Helper function to determine match result
  const getMatchResult = (): string => {
    if (!match) return 'Match Result Unknown';
    
    if (match.team1.score > match.team2.score) {
      return `${match.team1.name} wins ${match.team1.score}-${match.team2.score}`;
    } else if (match.team2.score > match.team1.score) {
      return `${match.team2.name} wins ${match.team2.score}-${match.team1.score}`;
    } else {
      if (match.period === MatchPeriod.PENALTIES) {
        // In penalties, the scores in team1.score and team2.score represent the penalty scores
        // This should be explicitly chosen by the user by updating the scores during penalties
        if (match.team1.score > match.team2.score) {
          return `${match.team1.name} wins ${match.team1.score}-${match.team2.score} on penalties`;
        } else if (match.team2.score > match.team1.score) {
          return `${match.team2.name} wins ${match.team2.score}-${match.team1.score} on penalties`;
        } else {
          return `Draw ${match.team1.score}-${match.team2.score} (penalties unresolved)`;
        }
      }
      return `Draw ${match.team1.score}-${match.team2.score}`;
    }
  };

  // Helper function to update the period in the database
  const updatePeriodInDatabase = async (newPeriod: MatchPeriod) => {
    const periodChangeEvent: MatchEvent = {
      type: MatchEventType.PERIOD_CHANGE,
      time: currentTime + (currentSeconds / 60),
      teamId: 'none',
      playerId: 'none',
      additionalInfo: getPeriodDisplayName(newPeriod),
      timestamp: new Date()
    };

    // Check if the teams have equal scores (draw)
    const isDrawMatch = match && match.team1.score === match.team2.score;
    
    // Check if we're moving to a potentially completed state
    const isPotentiallyCompleted = 
      newPeriod === MatchPeriod.FULL_TIME;
      
    // Only mark as completed if:
    // We're at FULL_TIME and scores are NOT equal (no need for extra time)
    // Note: We're removing automatic completion for PENALTIES to allow recording penalty results
    const isActuallyCompleted = 
      (newPeriod === MatchPeriod.FULL_TIME && !isDrawMatch);
      
    // Set new match status based on whether it's actually completed
    const newMatchStatus = isActuallyCompleted ? MatchStatus.COMPLETED : match!.status;
    
    // If the match is actually completed, determine the result
    const matchResult = isActuallyCompleted ? getMatchResult() : undefined;
    
    // Update match with new period and the period change event
    const matchRef = doc(db, 'matches', matchId as string);
    await updateDoc(matchRef, {
      period: newPeriod,
      events: arrayUnion(periodChangeEvent),
      periodEndNotified: false, // Reset notification flag
      status: newMatchStatus,
      ...(matchResult && { result: matchResult })
    });

    // Update local match state
    setMatch({
      ...match!,
      period: newPeriod,
      events: [...match!.events, periodChangeEvent],
      periodEndNotified: false,
      status: newMatchStatus,
      ...(matchResult && { result: matchResult })
    });

    // If arriving at FULL_TIME with a draw, show extra time/penalties options
    if (newPeriod === MatchPeriod.FULL_TIME && isDrawMatch) {
      Alert.alert(
        'Match Ended in a Draw',
        'How would you like to proceed with this draw match?',
        [
          {
            text: 'Proceed to Extra Time',
            onPress: async () => {
              // Auto-transition to extra time
              await handlePeriodChange(MatchPeriod.EXTRA_TIME_FIRST);
            }
          },
          {
            text: 'Go to Penalties',
            onPress: async () => {
              // Skip to penalties
              await handlePeriodChange(MatchPeriod.PENALTIES);
            }
          },
          {
            text: 'End as Draw',
            style: 'destructive',
            onPress: async () => {
              // Complete match as a draw
              await completeMatch(MatchPeriod.FULL_TIME);
            }
          }
        ]
      );
      return;
    }

    // If match is now completed, update team statistics and tournament data
    if (isActuallyCompleted) {
      // If this match is part of a tournament, update the LiveMatch record
      if (match?.tournamentId && matchResult) {
        try {
          // Query LiveMatch collection to find the match
          const liveMatchesQuery = query(
            collection(db, 'liveMatches'),
            where('team1.teamId', '==', match.team1.id),
            where('team2.teamId', '==', match.team2.id)
          );
          
          const liveMatchSnapshot = await getDocs(liveMatchesQuery);
          
          if (!liveMatchSnapshot.empty) {
            // Update the LiveMatch with the result
            const liveMatchDoc = liveMatchSnapshot.docs[0];
            await updateDoc(doc(db, 'liveMatches', liveMatchDoc.id), {
              result: matchResult,
              status: 'Completed'
            });
          }
        } catch (error) {
          console.error('Error updating tournament match result:', error);
        }
      }

      await updateTeamsAfterMatch();
      await updateLeaderboard();
      
      // Show a more prominent notification with match result
      Alert.alert(
        'Match Completed', 
        `The match has been recorded as completed. ${matchResult || ''}`,
        [{ text: 'OK' }]
      );
      
      // Ensure the clock is stopped
      setClockRunning(false);
    }

    // If period is changing to a half time or break, stop the clock
    if (
      newPeriod === MatchPeriod.HALF_TIME || 
      newPeriod === MatchPeriod.FULL_TIME || 
      newPeriod === MatchPeriod.EXTRA_TIME_BREAK || 
      newPeriod === MatchPeriod.PENALTIES
    ) {
      setClockRunning(false);
    }
  };

  // Update team statistics after match completion
  const updateTeamsAfterMatch = async () => {
    if (!match) return;
    
    try {
      const team1Ref = doc(db, 'teams', match.team1.id);
      const team2Ref = doc(db, 'teams', match.team2.id);
      
      const team1Doc = await getDoc(team1Ref);
      const team2Doc = await getDoc(team2Ref);
      
      if (team1Doc.exists() && team2Doc.exists()) {
        const team1Data = team1Doc.data();
        const team2Data = team2Doc.data();
        
        // Determine match result
        const team1Won = match.team1.score > match.team2.score;
        const team2Won = match.team2.score > match.team1.score;
        const draw = match.team1.score === match.team2.score;
        
        // Update team1 stats
        await updateDoc(team1Ref, {
          'stats.matches': (team1Data.stats?.matches || 0) + 1,
          'stats.wins': (team1Data.stats?.wins || 0) + (team1Won ? 1 : 0),
          'stats.draws': (team1Data.stats?.draws || 0) + (draw ? 1 : 0),
          'stats.losses': (team1Data.stats?.losses || 0) + (team2Won ? 1 : 0),
          'stats.goalsFor': (team1Data.stats?.goalsFor || 0) + match.team1.score,
          'stats.goalsAgainst': (team1Data.stats?.goalsAgainst || 0) + match.team2.score,
          'stats.points': (team1Data.stats?.points || 0) + (team1Won ? 3 : draw ? 1 : 0)
        });
        
        // Update team2 stats
        await updateDoc(team2Ref, {
          'stats.matches': (team2Data.stats?.matches || 0) + 1,
          'stats.wins': (team2Data.stats?.wins || 0) + (team2Won ? 1 : 0),
          'stats.draws': (team2Data.stats?.draws || 0) + (draw ? 1 : 0),
          'stats.losses': (team2Data.stats?.losses || 0) + (team1Won ? 1 : 0),
          'stats.goalsFor': (team2Data.stats?.goalsFor || 0) + match.team2.score,
          'stats.goalsAgainst': (team2Data.stats?.goalsAgainst || 0) + match.team1.score,
          'stats.points': (team2Data.stats?.points || 0) + (team2Won ? 3 : draw ? 1 : 0)
        });
        
        // Update leaderboard
        await updateLeaderboard();
      }
    } catch (error) {
      console.error('Error updating team stats:', error);
    }
  };

  // Update tournament leaderboard
  const updateLeaderboard = async () => {
    if (!match?.tournamentId) return;
    
    try {
      // Get tournament leaderboard
      const leaderboardQuery = query(
        collection(db, 'leaderboards'), 
        where('tournamentId', '==', match.tournamentId)
      );
      
      const leaderboardSnapshot = await getDocs(leaderboardQuery);
      
      if (!leaderboardSnapshot.empty) {
        const leaderboardDoc = leaderboardSnapshot.docs[0];
        const leaderboardId = leaderboardDoc.id;
        const leaderboardData = leaderboardDoc.data();
        const rankings = leaderboardData.rankings || [];
        
        // Find team1 ranking
        const team1Ranking = rankings.find((r: any) => r.teamId === match.team1.id);
        // Find team2 ranking
        const team2Ranking = rankings.find((r: any) => r.teamId === match.team2.id);
        
        const updatedRankings = [...rankings];
        
        // Determine match result
        const team1Won = match.team1.score > match.team2.score;
        const team2Won = match.team2.score > match.team1.score;
        const draw = match.team1.score === match.team2.score;
        
        // Update or add team1 ranking
        if (team1Ranking) {
          team1Ranking.matchesPlayed++;
          team1Ranking.wins += team1Won ? 1 : 0;
          team1Ranking.draws += draw ? 1 : 0;
          team1Ranking.losses += team2Won ? 1 : 0;
          team1Ranking.points += team1Won ? 3 : draw ? 1 : 0;
        } else {
          updatedRankings.push({
            teamId: match.team1.id,
            teamName: match.team1.name,
            matchesPlayed: 1,
            wins: team1Won ? 1 : 0,
            draws: draw ? 1 : 0,
            losses: team2Won ? 1 : 0,
            points: team1Won ? 3 : draw ? 1 : 0
          });
        }
        
        // Update or add team2 ranking
        if (team2Ranking) {
          team2Ranking.matchesPlayed++;
          team2Ranking.wins += team2Won ? 1 : 0;
          team2Ranking.draws += draw ? 1 : 0;
          team2Ranking.losses += team1Won ? 1 : 0;
          team2Ranking.points += team2Won ? 3 : draw ? 1 : 0;
        } else {
          updatedRankings.push({
            teamId: match.team2.id,
            teamName: match.team2.name,
            matchesPlayed: 1,
            wins: team2Won ? 1 : 0,
            draws: draw ? 1 : 0,
            losses: team1Won ? 1 : 0,
            points: team2Won ? 3 : draw ? 1 : 0
          });
        }
        
        // Sort rankings by points (descending)
        updatedRankings.sort((a: any, b: any) => b.points - a.points);
        
        // Update leaderboard
        await updateDoc(doc(db, 'leaderboards', leaderboardId), {
          rankings: updatedRankings
        });
      }
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  };

  // Submit an event (goal, card, etc.)
  const handleSubmitEvent = async () => {
    // Don't allow updates if match is completed
    if (!isMatchEditable()) {
      Alert.alert('Match Completed', 'This match has ended and cannot be updated.');
      setEventModalVisible(false);
      return;
    }

    if (!match || !selectedTeam || !selectedPlayer) {
      Alert.alert('Error', 'Please select a team and player');
      return;
    }
    
    try {
      const teamKey = selectedTeam;
      const team = match[teamKey];
      
      // Create the event
      const newEvent: MatchEvent = {
        time: match.currentTime,
        type: eventType,
        teamId: team.id,
        playerId: selectedPlayer,
        playerName: playersList[team.id]?.find(p => p.id === selectedPlayer)?.name || 'Unknown Player',
        timestamp: new Date()
      };
      
      // Add secondary player if needed (for assists)
      if (secondSelectedPlayer) {
        newEvent.secondPlayerId = secondSelectedPlayer;
        newEvent.secondPlayerName = playersList[team.id]?.find(p => p.id === secondSelectedPlayer)?.name || 'Unknown Player';
      }
      
      // Add additional info if provided
      if (additionalInfo) {
        newEvent.additionalInfo = additionalInfo;
      }
      
      // Create updated match object
      const updatedMatch = { ...match };
      updatedMatch.events = [...updatedMatch.events, newEvent];
      
      // Update specific stats based on event type
      if (eventType === MatchEventType.GOAL) {
        // Update team score
        updatedMatch[teamKey].score += 1;
        
        // Update player stats
        const playerIndex = updatedMatch[teamKey].players.findIndex(p => p.id === selectedPlayer);
        if (playerIndex !== -1) {
          updatedMatch[teamKey].players[playerIndex].stats.goals += 1;
        }
        
        // Update assist if provided
        if (secondSelectedPlayer) {
          const assistPlayerIndex = updatedMatch[teamKey].players.findIndex(p => p.id === secondSelectedPlayer);
          if (assistPlayerIndex !== -1) {
            updatedMatch[teamKey].players[assistPlayerIndex].stats.assists += 1;
          }
        }
      } else if (eventType === MatchEventType.YELLOW_CARD) {
        // Update team yellow cards
        updatedMatch[teamKey].yellowCards += 1;
        
        // Update player stats
        const playerIndex = updatedMatch[teamKey].players.findIndex(p => p.id === selectedPlayer);
        if (playerIndex !== -1) {
          updatedMatch[teamKey].players[playerIndex].stats.yellowCards += 1;
        }
      } else if (eventType === MatchEventType.RED_CARD) {
        // Update team red cards
        updatedMatch[teamKey].redCards += 1;
        
        // Update player stats
        const playerIndex = updatedMatch[teamKey].players.findIndex(p => p.id === selectedPlayer);
        if (playerIndex !== -1) {
          updatedMatch[teamKey].players[playerIndex].stats.redCards += 1;
        }
      }
      
      // Update local state
      setMatch(updatedMatch);
      
      // Update Firestore
      const updateData: any = {
        events: updatedMatch.events
      };
      
      // Add team-specific updates
      if (eventType === MatchEventType.GOAL) {
        updateData[`${teamKey}.score`] = updatedMatch[teamKey].score;
      } else if (eventType === MatchEventType.YELLOW_CARD) {
        updateData[`${teamKey}.yellowCards`] = updatedMatch[teamKey].yellowCards;
      } else if (eventType === MatchEventType.RED_CARD) {
        updateData[`${teamKey}.redCards`] = updatedMatch[teamKey].redCards;
      }
      
      // Update player stats
      updateData[`${teamKey}.players`] = updatedMatch[teamKey].players;
      
      await updateDoc(doc(db, 'matches', matchId as string), updateData);
      
      // Reset form state
      setEventModalVisible(false);
      setSelectedTeam(null);
      setSelectedPlayer(null);
      setSecondSelectedPlayer(null);
      setAdditionalInfo('');
    } catch (error) {
      console.error('Error submitting event:', error);
      Alert.alert('Error', 'Failed to submit match event');
    }
  };

  // Render a player item in the selection list
  const renderPlayerItem = ({ item }: { item: Player }) => (
    <TouchableOpacity
      style={[
        styles.playerItem,
        selectedPlayer === item.id && styles.selectedPlayerItem
      ]}
      onPress={() => setSelectedPlayer(item.id)}
    >
      <Text style={styles.playerNumber}>#{item.number}</Text>
      <View style={styles.playerItemInfo}>
        <Text style={styles.playerItemName}>{item.name}</Text>
        <Text style={styles.playerItemPosition}>{item.position}</Text>
      </View>
      {item.isCaptain && (
        <MaterialIcons name="star" size={16} color="#FFD700" />
      )}
    </TouchableOpacity>
  );

  // Format time display
  const formatTime = (minutes: number, seconds: number): string => {
    // Handle time display based on match periods
    let displayMinutes = minutes;
    let displaySeconds = seconds;
    let extraTimeSymbol = '';
    
    switch (match?.period) {
      case MatchPeriod.FIRST_HALF:
    // First half injury time
        if (minutes >= 45) {
      displayMinutes = 45;
      extraTimeSymbol = '+' + (minutes - 45);
    } 
        break;
        
      case MatchPeriod.SECOND_HALF:
        // Check if we're continuing from first half or started at 45:00
        if (secondHalfContinued || (match?.secondHalfContinued === true)) {
          // Case: Continue from current time - keep actual time without modifying
          displayMinutes = minutes;
          
          // Still handle injury time after 90 minutes
          if (minutes >= 90) {
      displayMinutes = 90;
      extraTimeSymbol = '+' + (minutes - 90);
    }
        } else {
          // Case: Started second half at 0 - display as 45+minutes
          displayMinutes = 45 + minutes;
        }
        break;
        
      case MatchPeriod.EXTRA_TIME_FIRST:
        // First half of extra time
        if (minutes >= 15) {
          displayMinutes = 105;
      extraTimeSymbol = '+' + (minutes - 15);
        } else {
          // Display as 90+minutes
          displayMinutes = 90 + minutes;
        }
        break;
        
      case MatchPeriod.EXTRA_TIME_SECOND:
        // Second half of extra time
        if (minutes >= 15) {
          displayMinutes = 120;
          extraTimeSymbol = '+' + (minutes - 15);
        } else {
          // Display as 105+minutes
          displayMinutes = 105 + minutes;
        }
        break;
    }
    
    // If we're showing extra time (injury time)
    if (extraTimeSymbol) {
      return `${displayMinutes}${extraTimeSymbol}:${displaySeconds.toString().padStart(2, '0')}`;
    }
    
    // Normal time display
    return `${displayMinutes}:${displaySeconds.toString().padStart(2, '0')}`;
  };

  // Get player name by ID
  const getPlayerName = (teamId: string, playerId: string): string => {
    const teamPlayers = playersList[teamId] || [];
    const player = teamPlayers.find(p => p.id === playerId);
    return player ? player.name : 'Unknown Player';
  };

  // Add substitution functionality
  const handleSubstitution = async (teamId: string) => {
    try {
      // Don't allow updates if match is completed
      if (!isMatchEditable()) {
        Alert.alert('Match Completed', 'This match has ended and cannot be updated.');
        return;
      }

      
      
      if (match?.team1.id === teamId) {
        setSelectedTeam('team1');
      } else if (match?.team2.id === teamId) {
        setSelectedTeam('team2');
      } else {
        console.error('Cannot determine which team this ID belongs to:', teamId);
        Alert.alert('Error', 'Cannot determine which team this ID belongs to');
        return;
      }
      
      setEventType(MatchEventType.SUBSTITUTION);
      setSubModalVisible(true);
    } catch (error) {
      console.error('Error preparing substitution:', error);
      Alert.alert('Error', 'Failed to prepare substitution form');
    }
  };

  // Handle player substitution submission
  const handleSubmitSubstitution = async () => {
    if (!match || !selectedTeam || !selectedPlayer || !secondSelectedPlayer) {
      Alert.alert('Error', 'Please select both players for substitution');
      return;
    }
    
    try {
      const teamKey = selectedTeam;
      const team = match[teamKey];
      
      // Find players
      const playerOut = playersList[team.id]?.find(p => p.id === selectedPlayer);
      const playerIn = playersList[team.id]?.find(p => p.id === secondSelectedPlayer);
      
      if (!playerOut || !playerIn) {
        Alert.alert('Error', 'Could not find selected players');
        return;
      }
      
      // Create the substitution event
      const newEvent: MatchEvent = {
        time: match.currentTime,
        type: MatchEventType.SUBSTITUTION,
        teamId: team.id,
        playerId: selectedPlayer, // Player going out
        playerName: playerOut.name,
        secondPlayerId: secondSelectedPlayer, // Player coming in
        secondPlayerName: playerIn.name,
        additionalInfo: additionalInfo || 'Substitution',
        timestamp: new Date()
      };
      
      // Update player statuses - mark outgoing player as not starting, incoming as starting
      const updatedMatch = { ...match };
      updatedMatch.events = [...updatedMatch.events, newEvent];
      
      // Find the outgoing player in the starting lineup and move to substitutes
      const outPlayerIndex = updatedMatch[teamKey].players.findIndex(p => p.id === selectedPlayer);
      if (outPlayerIndex !== -1) {
        const outPlayer = {...updatedMatch[teamKey].players[outPlayerIndex]};
        outPlayer.isStarting = false;
        
        // Remove from starting lineup
        updatedMatch[teamKey].players.splice(outPlayerIndex, 1);
        
        // Add to substitutes if not already there
        if (!updatedMatch[teamKey].substitutes.some(p => p.id === outPlayer.id)) {
          updatedMatch[teamKey].substitutes.push(outPlayer);
        }
      }
      
      // Find the incoming player in substitutes and move to starting lineup
      const inPlayerIndex = updatedMatch[teamKey].substitutes.findIndex(p => p.id === secondSelectedPlayer);
      if (inPlayerIndex !== -1) {
        const inPlayer = {...updatedMatch[teamKey].substitutes[inPlayerIndex]};
        inPlayer.isStarting = true;
        
        // Remove from substitutes
        updatedMatch[teamKey].substitutes.splice(inPlayerIndex, 1);
        
        // Add to starting lineup
        updatedMatch[teamKey].players.push(inPlayer);
      }
      
      setMatch(updatedMatch);
      
      // Update Firestore
      const updateData: any = {
        events: updatedMatch.events,
        [`${teamKey}.players`]: updatedMatch[teamKey].players,
        [`${teamKey}.substitutes`]: updatedMatch[teamKey].substitutes
      };
      
      await updateDoc(doc(db, 'matches', matchId as string), updateData);
      
      // Reset form state
      setSubModalVisible(false);
      setSelectedTeam(null);
      setSelectedPlayer(null);
      setSecondSelectedPlayer(null);
      setAdditionalInfo('');
    } catch (error) {
      console.error('Error submitting substitution:', error);
      Alert.alert('Error', 'Failed to submit substitution');
    }
  };

  // Helper function for displaying notifications about match events
  const showNotification = (title: string, message: string) => {
    // Simple Alert-based notification
    Alert.alert(title, message, [{ text: 'OK' }], { cancelable: true });
  };

  // Record shot on goal
  const recordShot = async (teamId: string, onTarget: boolean) => {
    // Don't allow updates if match is completed
    if (!isMatchEditable()) {
      Alert.alert('Match Completed', 'This match has ended and cannot be updated.');
      return;
    }

    try {
      

      if (!match) return;

      // Determine which team this belongs to
      let teamKey: 'team1' | 'team2';
      if (match.team1.id === teamId) {
        teamKey = 'team1';
      } else if (match.team2.id === teamId) {
        teamKey = 'team2';
      } else {
        console.error('Cannot determine which team this ID belongs to:', teamId);
        Alert.alert('Error', 'Cannot determine which team this ID belongs to');
        return;
      }

      // Update local state first for responsiveness
      const updatedMatch = { ...match } as FootballMatch;
      updatedMatch[teamKey].shots += 1;
      if (onTarget) {
        updatedMatch[teamKey].shotsOnTarget += 1;
      }
      setMatch(updatedMatch);

      // Update in Firestore
      const matchRef = doc(db, 'matches', matchId as string);
      const updateData: any = {
        [`${teamKey}.shots`]: updatedMatch[teamKey].shots
      };

      if (onTarget) {
        updateData[`${teamKey}.shotsOnTarget`] = updatedMatch[teamKey].shotsOnTarget;
      }

      await updateDoc(matchRef, updateData);

      // Create event notification
      const eventType = onTarget ? 'shot on target' : 'shot off target';
      showNotification('Shot Recorded', `${updatedMatch[teamKey].name} - ${eventType}`);
    } catch (error) {
      console.error('Error recording shot:', error);
      Alert.alert('Error', 'Failed to record shot');
    }
  };

  // Update possession stats
  const updatePossession = async (teamKey: 'team1' | 'team2', possessionValue: number) => {
    // Don't allow updates if match is completed
    if (!isMatchEditable()) {
      Alert.alert('Match Completed', 'This match has ended and possession stats cannot be updated.');
      return;
    }

    try {
      if (!match) return;
      
      // Calculate the opposing team's possession (must add up to 100%)
      const opposingTeamKey: 'team1' | 'team2' = teamKey === 'team1' ? 'team2' : 'team1';
      const opposingPossession = 100 - possessionValue;
      
      // Update local state for immediate feedback
      const updatedMatch = { ...match } as FootballMatch;
      updatedMatch[teamKey].possession = possessionValue;
      updatedMatch[opposingTeamKey].possession = opposingPossession;
      setMatch(updatedMatch);
      
      // Update in Firestore
      const matchRef = doc(db, 'matches', matchId as string);
      await updateDoc(matchRef, {
        [`${teamKey}.possession`]: possessionValue,
        [`${opposingTeamKey}.possession`]: opposingPossession
      });
      
      // Show success notification
      showNotification(
        'Possession Updated', 
        `${updatedMatch[teamKey].name}: ${possessionValue}%, ${updatedMatch[opposingTeamKey].name}: ${opposingPossession}%`
      );
    } catch (error) {
      console.error('Error updating possession:', error);
      Alert.alert('Error', 'Failed to update possession statistics');
    }
  };

  // Record other stats (corner, offside, foul)
  const recordStatEvent = async (teamId: string, eventType: 'corner' | 'offside' | 'foul') => {
    // Don't allow updates if match is completed
    if (!isMatchEditable()) {
      Alert.alert('Match Completed', 'This match has ended and cannot be updated.');
      return;
    }

    try {
      
      
      let teamKey: 'team1' | 'team2';
      if (match?.team1.id === teamId) {
        teamKey = 'team1';
      } else if (match?.team2.id === teamId) {
        teamKey = 'team2';
      } else {
        console.error('Cannot determine which team this ID belongs to:', teamId);
        Alert.alert('Error', 'Cannot determine which team this ID belongs to');
        return;
      }
      
      // Update local state
      const updatedMatch = { ...match };
      
      switch (eventType) {
        case 'corner':
          updatedMatch[teamKey].corners += 1;
          break;
        case 'offside':
          updatedMatch[teamKey].offsides += 1;
          break;
        case 'foul':
          updatedMatch[teamKey].fouls += 1;
          break;
      }
      
      setMatch(updatedMatch);
      
      // Update Firestore
      const updateData: any = {};
      
      switch (eventType) {
        case 'corner':
          updateData[`${teamKey}.corners`] = updatedMatch[teamKey].corners;
          break;
        case 'offside':
          updateData[`${teamKey}.offsides`] = updatedMatch[teamKey].offsides;
          break;
        case 'foul':
          updateData[`${teamKey}.fouls`] = updatedMatch[teamKey].fouls;
          break;
      }
      
      await updateDoc(doc(db, 'matches', matchId as string), updateData);
    } catch (error) {
      console.error(`Error recording ${eventType}:`, error);
      Alert.alert('Error', `Failed to record ${eventType}`);
    }
  };

  // View and update player stats
  const openPlayerStats = (player: Player) => {
    setSelectedPlayerForStats(player);
    setStatsModalVisible(true);
  };

  // Update individual player stat
  const updatePlayerStat = async (
    player: Player, 
    teamKey: 'team1' | 'team2', 
    statKey: keyof Player['stats'], 
    value: number
  ) => {
    // Don't allow updates if match is completed
    if (!isMatchEditable()) {
      Alert.alert('Match Completed', 'This match has ended and player stats cannot be updated.');
      return;
    }

    try {
      if (!match) return;
      
      // Determine if player is in starting lineup or substitutes
      const isStarting = match[teamKey].players.some(p => p.id === player.id);
      
      // Create a deep copy of match to update
      const updatedMatch = JSON.parse(JSON.stringify(match)) as FootballMatch;
      
      // Find the player in the appropriate array (starting or substitutes)
      const playerList = isStarting 
        ? updatedMatch[teamKey]?.players || [] 
        : updatedMatch[teamKey]?.substitutes || [];
      const playerIndex = playerList.findIndex(p => p.id === player.id);
      
      if (playerIndex !== -1) {
        // Update the stat
        playerList[playerIndex].stats[statKey] = value;
        
        // Update local state
        setMatch(updatedMatch);
        
        // Update selected player for stats if currently viewing
        if (selectedPlayerForStats?.id === player.id) {
          setSelectedPlayerForStats(playerList[playerIndex]);
        }
        
        // Update in Firestore
        const matchRef = doc(db, 'matches', matchId as string);
        
        // Create the update path based on whether player is starting or substitute
        const updatePath = isStarting 
          ? `${teamKey}.players.${playerIndex}.stats.${statKey}` 
          : `${teamKey}.substitutes.${playerIndex}.stats.${statKey}`;
        
        await updateDoc(matchRef, {
          [updatePath]: value
        });
        
        return true;
      } else {
        console.error('Player not found in team:', player.id);
        return false;
      }
    } catch (error) {
      console.error('Error updating player stat:', error);
      Alert.alert('Error', 'Failed to update player statistics');
      return false;
    }
  };

  // Render the player stats modal
  const renderPlayerStatsModal = () => {
    if (!selectedPlayerForStats) return null;
    
    // Determine which team the player belongs to
    const team1Player = match?.team1.players.some(p => p.id === selectedPlayerForStats.id) || 
                       match?.team1.substitutes.some(p => p.id === selectedPlayerForStats.id);
    const teamKey: 'team1' | 'team2' = team1Player ? 'team1' : 'team2';
    
    return (
      <Modal
        visible={statsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Player Statistics</Text>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.playerStatsHeader}>
              <Text style={styles.playerStatsName}>
                {selectedPlayerForStats.name} 
                {selectedPlayerForStats.isCaptain && ' (C)'}
              </Text>
              <Text style={styles.playerStatsPosition}>{selectedPlayerForStats.position}</Text>
              <Text style={styles.playerStatsNumber}>#{selectedPlayerForStats.number}</Text>
            </View>
            
            <ScrollView style={styles.playerStatsList}>
              <View style={styles.playerStatsItem}>
                <Text style={styles.playerStatsLabel}>Goals</Text>
                <View style={styles.playerStatsControls}>
                  <TouchableOpacity 
                    style={styles.playerStatsButton}
                    onPress={() => {
                      const newValue = Math.max(0, selectedPlayerForStats.stats.goals - 1);
                      updatePlayerStat(selectedPlayerForStats, teamKey, 'goals', newValue);
                    }}
                  >
                    <Text style={styles.playerStatsButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.playerStatsValue}>{selectedPlayerForStats.stats.goals}</Text>
                  <TouchableOpacity 
                    style={styles.playerStatsButton}
                    onPress={() => {
                      const newValue = selectedPlayerForStats.stats.goals + 1;
                      updatePlayerStat(selectedPlayerForStats, teamKey, 'goals', newValue);
                    }}
                  >
                    <Text style={styles.playerStatsButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.playerStatsItem}>
                <Text style={styles.playerStatsLabel}>Assists</Text>
                <View style={styles.playerStatsControls}>
                  <TouchableOpacity 
                    style={styles.playerStatsButton}
                    onPress={() => {
                      const newValue = Math.max(0, selectedPlayerForStats.stats.assists - 1);
                      updatePlayerStat(selectedPlayerForStats, teamKey, 'assists', newValue);
                    }}
                  >
                    <Text style={styles.playerStatsButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.playerStatsValue}>{selectedPlayerForStats.stats.assists}</Text>
                  <TouchableOpacity 
                    style={styles.playerStatsButton}
                    onPress={() => {
                      const newValue = selectedPlayerForStats.stats.assists + 1;
                      updatePlayerStat(selectedPlayerForStats, teamKey, 'assists', newValue);
                    }}
                  >
                    <Text style={styles.playerStatsButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.playerStatsItem}>
                <Text style={styles.playerStatsLabel}>Yellow Cards</Text>
                <View style={styles.playerStatsControls}>
                  <TouchableOpacity 
                    style={styles.playerStatsButton}
                    onPress={() => {
                      const newValue = Math.max(0, selectedPlayerForStats.stats.yellowCards - 1);
                      updatePlayerStat(selectedPlayerForStats, teamKey, 'yellowCards', newValue);
                    }}
                  >
                    <Text style={styles.playerStatsButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.playerStatsValue}>{selectedPlayerForStats.stats.yellowCards}</Text>
                  <TouchableOpacity 
                    style={styles.playerStatsButton}
                    onPress={() => {
                      const newValue = selectedPlayerForStats.stats.yellowCards + 1;
                      updatePlayerStat(selectedPlayerForStats, teamKey, 'yellowCards', newValue);
                    }}
                  >
                    <Text style={styles.playerStatsButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.playerStatsItem}>
                <Text style={styles.playerStatsLabel}>Red Cards</Text>
                <View style={styles.playerStatsControls}>
                  <TouchableOpacity 
                    style={styles.playerStatsButton}
                    onPress={() => {
                      const newValue = Math.max(0, selectedPlayerForStats.stats.redCards - 1);
                      updatePlayerStat(selectedPlayerForStats, teamKey, 'redCards', newValue);
                    }}
                  >
                    <Text style={styles.playerStatsButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.playerStatsValue}>{selectedPlayerForStats.stats.redCards}</Text>
                  <TouchableOpacity 
                    style={styles.playerStatsButton}
                    onPress={() => {
                      const newValue = selectedPlayerForStats.stats.redCards + 1;
                      updatePlayerStat(selectedPlayerForStats, teamKey, 'redCards', newValue);
                    }}
                  >
                    <Text style={styles.playerStatsButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Conditional stats based on position */}
              {selectedPlayerForStats.position === 'GK' && (
                <>
                  <View style={styles.playerStatsItem}>
                    <Text style={styles.playerStatsLabel}>Saves</Text>
                    <View style={styles.playerStatsControls}>
                      <TouchableOpacity 
                        style={styles.playerStatsButton}
                        onPress={() => {
                          const newValue = Math.max(0, (selectedPlayerForStats.stats.saves || 0) - 1);
                          updatePlayerStat(selectedPlayerForStats, teamKey, 'saves', newValue);
                        }}
                      >
                        <Text style={styles.playerStatsButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.playerStatsValue}>{selectedPlayerForStats.stats.saves || 0}</Text>
                      <TouchableOpacity 
                        style={styles.playerStatsButton}
                        onPress={() => {
                          const newValue = (selectedPlayerForStats.stats.saves || 0) + 1;
                          updatePlayerStat(selectedPlayerForStats, teamKey, 'saves', newValue);
                        }}
                      >
                        <Text style={styles.playerStatsButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.playerStatsItem}>
                    <Text style={styles.playerStatsLabel}>Clean Sheets</Text>
                    <View style={styles.playerStatsControls}>
                      <TouchableOpacity 
                        style={styles.playerStatsButton}
                        onPress={() => {
                          const newValue = Math.max(0, (selectedPlayerForStats.stats.cleanSheets || 0) - 1);
                          updatePlayerStat(selectedPlayerForStats, teamKey, 'cleanSheets', newValue);
                        }}
                      >
                        <Text style={styles.playerStatsButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.playerStatsValue}>{selectedPlayerForStats.stats.cleanSheets || 0}</Text>
                      <TouchableOpacity 
                        style={styles.playerStatsButton}
                        onPress={() => {
                          const newValue = (selectedPlayerForStats.stats.cleanSheets || 0) + 1;
                          updatePlayerStat(selectedPlayerForStats, teamKey, 'cleanSheets', newValue);
                        }}
                      >
                        <Text style={styles.playerStatsButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
              
              {/* Add more stats as needed */}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // View team lineup and formation
  const viewTeamFormation = (teamKey: 'team1' | 'team2') => {
    if (!match) return;
    
    const team = match[teamKey];
    const formationParts = team.formation.split('-').map(Number);
    
    // Calculate positions for players in formation
    const positions: {[key: string]: Player[]} = {
      'GK': [],
      'DEF': [],
      'MID': [],
      'FWD': []
    };
    
    // Organize players by position
    team.players.forEach(player => {
      if (player.position === 'GK') {
        positions.GK.push(player);
      } else if (player.position === 'DEF') {
        positions.DEF.push(player);
      } else if (player.position === 'MID') {
        positions.MID.push(player);
      } else if (player.position === 'FWD') {
        positions.FWD.push(player);
      }
    });
    
    // Build formation string
    let formationDisplay = `Formation: ${team.formation}\n\n`;
    
    // Display GK
    if (positions.GK.length > 0) {
      formationDisplay += 'Goalkeeper:\n';
      positions.GK.forEach(player => {
        formationDisplay += `${player.number}. ${player.name}${player.isCaptain ? ' (C)' : ''}\n`;
      });
      formationDisplay += '\n';
    }
    
    // Display DEF
    if (positions.DEF.length > 0) {
      formationDisplay += `Defenders (${formationParts[0]}):\n`;
      positions.DEF.forEach(player => {
        formationDisplay += `${player.number}. ${player.name}${player.isCaptain ? ' (C)' : ''}\n`;
      });
      formationDisplay += '\n';
    }
    
    // Display MID
    if (positions.MID.length > 0) {
      formationDisplay += `Midfielders (${formationParts[1]}):\n`;
      positions.MID.forEach(player => {
        formationDisplay += `${player.number}. ${player.name}${player.isCaptain ? ' (C)' : ''}\n`;
      });
      formationDisplay += '\n';
    }
    
    // Display FWD
    if (positions.FWD.length > 0) {
      const fwdCount = formationParts.length > 2 ? formationParts[2] : 0;
      formationDisplay += `Forwards (${fwdCount}):\n`;
      positions.FWD.forEach(player => {
        formationDisplay += `${player.number}. ${player.name}${player.isCaptain ? ' (C)' : ''}\n`;
      });
      formationDisplay += '\n';
    }
    
    // Display substitutes
    if (team.substitutes.length > 0) {
      formationDisplay += 'Substitutes:\n';
      team.substitutes.forEach(player => {
        formationDisplay += `${player.number}. ${player.name} (${player.position})${player.isCaptain ? ' (C)' : ''}\n`;
      });
    }
    
    // Format for total players
    formationDisplay += `\nTotal: ${team.players.length} starters, ${team.substitutes.length} substitutes`;
    
    Alert.alert(
      `${team.name} Lineup`,
      formationDisplay
    );
  };

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

  // Add transitions between extra time periods
  const handleExtraTimePeriodTransition = async () => {
    if (!match) return;
    
    if (match.period === MatchPeriod.EXTRA_TIME_FIRST) {
      // When first half of extra time ends, go to extra time break
      await handlePeriodChange(MatchPeriod.EXTRA_TIME_BREAK);
      
      // Notify user
      Alert.alert(
        'Extra Time - Half Time',
        'The first half of extra time has ended. Click start to begin the second half of extra time.',
        [
          {
            text: 'Continue',
            onPress: async () => {
              // Auto-transition to second half of extra time
              await handlePeriodChange(MatchPeriod.EXTRA_TIME_SECOND);
            }
          }
        ]
      );
    } else if (match.period === MatchPeriod.EXTRA_TIME_SECOND) {
      // When second half of extra time ends, handle draw or completion
      if (match.team1.score === match.team2.score) {
        // Still a draw after extra time, go to penalties
        Alert.alert(
          'Extra Time Ended - Still a Draw',
          'The match is still tied after extra time. Proceed to penalties?',
          [
            {
              text: 'Go to Penalties',
              onPress: async () => {
                await handlePeriodChange(MatchPeriod.PENALTIES);
              }
            },
            {
              text: 'End as Draw',
              style: 'destructive',
              onPress: async () => {
                await completeMatch(MatchPeriod.FULL_TIME);
              }
            }
          ]
        );
      } else {
        // Not a draw, complete the match
        await completeMatch(MatchPeriod.FULL_TIME);
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Match Header & Scorecard */}
      <View style={styles.matchHeader}>
        <Text style={styles.matchTitle}>
          {match.team1.name} vs {match.team2.name}
        </Text>
        {match.venueId && (
          <Text style={styles.venueText}>{match.venueName}</Text>
        )}
      </View>

      {/* Add lineup buttons to the header */}
      <View style={styles.lineupContainer}>
        <TouchableOpacity
          style={styles.lineupButton}
          onPress={() => viewTeamFormation('team1')}
        >
          <Text style={styles.lineupButtonText}>View {match.team1.name} Lineup</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.lineupButton}
          onPress={() => viewTeamFormation('team2')}
        >
          <Text style={styles.lineupButtonText}>View {match.team2.name} Lineup</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scorecard}>
        <View style={styles.periodIndicator}>
          <Text style={styles.periodText}>
            {match.period.replace(/_/g, ' ')}
          </Text>
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(currentTime, currentSeconds)}</Text>
            <TouchableOpacity 
              style={styles.clockButton}
              onPress={toggleClock}
            >
              <MaterialIcons 
                name={clockRunning ? "pause" : "play-arrow"} 
                size={24} 
                color="#FF9F45" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.teamsContainer}>
          <View style={styles.teamSection}>
            <View style={styles.teamLogo}>
              {match.team1.logo ? (
                <Image 
                  source={{ uri: match.team1.logo }} 
                  style={styles.teamLogoImage} 
                />
              ) : (
                <MaterialIcons name="sports-soccer" size={30} color="#FFF" />
              )}
            </View>
            <Text style={styles.teamName}>{match.team1.name}</Text>
            <Text style={styles.score}>{match.team1.score}</Text>
            <TouchableOpacity
              style={styles.goalButton}
              onPress={() => handleGoal(match.team1.id)}
            >
              <LinearGradient
                colors={['#4BB543', '#45FF9F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.goalGradient}
              >
                <Text style={styles.goalButtonText}>GOAL</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.cardButtons}>
              <TouchableOpacity
                style={styles.cardButton}
                onPress={() => handleCard(match.team1.id, 'yellow')}
              >
                <View style={[styles.card, styles.yellowCard]} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardButton}
                onPress={() => handleCard(match.team1.id, 'red')}
              >
                <View style={[styles.card, styles.redCard]} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.vs}>VS</Text>

          <View style={styles.teamSection}>
            <View style={styles.teamLogo}>
              {match.team2.logo ? (
                <Image 
                  source={{ uri: match.team2.logo }} 
                  style={styles.teamLogoImage} 
                />
              ) : (
                <MaterialIcons name="sports-soccer" size={30} color="#FFF" />
              )}
            </View>
            <Text style={styles.teamName}>{match.team2.name}</Text>
            <Text style={styles.score}>{match.team2.score}</Text>
            <TouchableOpacity
              style={styles.goalButton}
              onPress={() => handleGoal(match.team2.id)}
            >
              <LinearGradient
                colors={['#4BB543', '#45FF9F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.goalGradient}
              >
                <Text style={styles.goalButtonText}>GOAL</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.cardButtons}>
              <TouchableOpacity
                style={styles.cardButton}
                onPress={() => handleCard(match.team2.id, 'yellow')}
              >
                <View style={[styles.card, styles.yellowCard]} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardButton}
                onPress={() => handleCard(match.team2.id, 'red')}
              >
                <View style={[styles.card, styles.redCard]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Match Timeline */}
      <View style={{
        marginTop: 24,
        padding: 16, 
        backgroundColor: '#1a1a1a',
        borderRadius: 12
      }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12
        }}>
          <Text style={{
            fontSize: 18,
            fontWeight: 'bold',
            color: '#FFFFFF'
          }}>Match Timeline</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <MaterialIcons name="timer" size={16} color="#FF9F45" style={{marginRight: 4}} />
            <Text style={{color: '#FF9F45', fontSize: 12}}>
              {match.period === MatchPeriod.NOT_STARTED ? 'Not Started' : 
               match.period === MatchPeriod.FULL_TIME ? 'Final' : 
               `${Math.floor(currentTime)}:${currentSeconds < 10 ? '0' : ''}${currentSeconds}`}
            </Text>
          </View>
        </View>
        
        {match.events.filter(e => e.type !== MatchEventType.PERIOD_CHANGE).length > 0 ? (
          <View style={{position: 'relative', marginTop: 20}}>
            {/* Period markers */}
            <View style={{
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              marginBottom: 8,
              position: 'relative',
              zIndex: 1
            }}>
              <Text style={{color: '#999999', fontSize: 12}}>First Half</Text>
              <Text style={{color: '#999999', fontSize: 12}}>Second Half</Text>
            </View>
            
            {/* Timeline base */}
            <View style={{
              height: 2, 
              backgroundColor: '#333333', 
              marginVertical: 12,
              position: 'relative'
            }}>
              {/* Half-time marker */}
              <View style={{
                position: 'absolute',
                left: '50%',
                height: 10,
                width: 2,
                backgroundColor: '#666666',
                top: -4
              }} />
              
              {/* Game clock marker */}
              {match.period !== MatchPeriod.NOT_STARTED && match.period !== MatchPeriod.FULL_TIME && (
                <View style={{
                  position: 'absolute',
                  left: `${Math.min((currentTime / 90) * 100, 100)}%`,
                  height: 12,
                  width: 3,
                  backgroundColor: '#FF9F45',
                  top: -5,
                  borderRadius: 1
                }} />
              )}
              
              {/* Event markers */}
              {match.events.filter(e => e.type !== MatchEventType.PERIOD_CHANGE).map((event, index) => {
                const eventPosition = (event.time / 90) * 100;
                const isHomeTeamEvent = event.teamId === match.team1.id;
                
                return (
                  <View 
                    key={`event-${index}`}
                    style={{
                      position: 'absolute',
                      left: `${Math.min(eventPosition, 100)}%`,
                      top: isHomeTeamEvent ? -25 : 5,
                      alignItems: 'center'
                    }}
                  >
                    <View style={{
                      flexDirection: isHomeTeamEvent ? 'column' : 'column-reverse',
                      alignItems: 'center'
                    }}>
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: event.type === MatchEventType.GOAL ? '#4CAF50' :
                                         event.type === MatchEventType.YELLOW_CARD ? '#FFEB3B' :
                                         event.type === MatchEventType.RED_CARD ? '#F44336' :
                                         event.type === MatchEventType.SUBSTITUTION ? '#2196F3' : '#999999',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: isHomeTeamEvent ? 4 : 0,
                        marginTop: isHomeTeamEvent ? 0 : 4
                      }}>
                        {event.type === MatchEventType.GOAL && (
                          <MaterialIcons name="sports-soccer" size={14} color="#FFFFFF" />
                        )}
                        {event.type === MatchEventType.YELLOW_CARD && (
                          <MaterialIcons name="square" size={14} color="#000000" />
                        )}
                        {event.type === MatchEventType.RED_CARD && (
                          <MaterialIcons name="square" size={14} color="#FFFFFF" />
                        )}
                        {event.type === MatchEventType.SUBSTITUTION && (
                          <MaterialIcons name="swap-horiz" size={14} color="#FFFFFF" />
                        )}
                      </View>
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 10,
                        maxWidth: 60,
                        textAlign: 'center'
                      }}>
                        {event.playerName || 'Unknown'}
                      </Text>
                      <Text style={{color: '#999999', fontSize: 9}}>{Math.floor(event.time)}'</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            
            {/* Team indicators */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 30
            }}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Image 
                  source={{uri: match.team1.logo}} 
                  style={{width: 20, height: 20, marginRight: 8}} 
                />
                <Text style={{color: '#FFFFFF', fontSize: 12}}>{match.team1.name}</Text>
              </View>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={{color: '#FFFFFF', fontSize: 12}}>{match.team2.name}</Text>
                <Image 
                  source={{uri: match.team2.logo}} 
                  style={{width: 20, height: 20, marginLeft: 8}} 
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={{
            padding: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#2a2a2a',
            borderRadius: 8
          }}>
            <Text style={{color: '#999999'}}>No match events recorded yet</Text>
          </View>
        )}
      </View>

      {/* Match Events */}
      <View style={styles.eventsContainer}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => setEventsExpanded(!eventsExpanded)}
        >
          <Text style={styles.sectionTitle}>Match Events</Text>
          <MaterialIcons 
            name={eventsExpanded ? "expand-less" : "expand-more"} 
            size={24} 
            color="#FFF" 
          />
        </TouchableOpacity>
        
        {eventsExpanded && match.events.length > 0 ? (
          <View style={styles.eventsList}>
            {match.events.map((event, index) => (
              <View key={index} style={styles.eventItem}>
                <Text style={styles.eventTime}>{Math.floor(event.time)}'</Text>
                <View style={styles.eventDetails}>
                  <Text style={styles.eventType}>
                    {event.type === MatchEventType.GOAL ? '⚽️ GOAL : ' :
                     event.type === MatchEventType.YELLOW_CARD ? '🟨 YELLOW CARD ' :
                     event.type === MatchEventType.RED_CARD ? '🟥 RED CARD' :
                     event.type === MatchEventType.SUBSTITUTION ? '🔄 SUBSTITUTION' :
                     event.type === MatchEventType.PERIOD_CHANGE ? '⏱ ' + (event.additionalInfo || 'PERIOD CHANGE') :
                     event.type}
                  </Text>
                  
                  {event.playerName && (
                    <Text style={styles.eventPlayer}>
                      {event.playerName}
                      {event.secondPlayerName && event.type === MatchEventType.GOAL && 
                        ` (Assist: ${event.secondPlayerName})`}
                      {event.secondPlayerName && event.type === MatchEventType.SUBSTITUTION && 
                        ` ↔️ ${event.secondPlayerName}`}
                    </Text>
                  )}
                  
                  {event.additionalInfo && event.type !== MatchEventType.PERIOD_CHANGE && (
                    <Text style={styles.eventInfo}>{event.additionalInfo}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : eventsExpanded ? (
          <Text style={styles.noEventsText}>No events recorded yet</Text>
        ) : null}
      </View>

      {/* Match Stats */}
      <View style={styles.stats}>
        <Text style={styles.statsTitle}>Match Stats</Text>
        
        <View style={styles.statRow}>
          <Text style={styles.statValue}>{match.team1.possession}%</Text>
          <Text style={styles.statLabel}>Possession</Text>
          <Text style={styles.statValue}>{match.team2.possession}%</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statValue}>{match.team1.shots}</Text>
          <Text style={styles.statLabel}>Shots</Text>
          <Text style={styles.statValue}>{match.team2.shots}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statValue}>{match.team1.shotsOnTarget}</Text>
          <Text style={styles.statLabel}>Shots on Target</Text>
          <Text style={styles.statValue}>{match.team2.shotsOnTarget}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statValue}>{match.team1.corners}</Text>
          <Text style={styles.statLabel}>Corners</Text>
          <Text style={styles.statValue}>{match.team2.corners}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statValue}>{match.team1.fouls}</Text>
          <Text style={styles.statLabel}>Fouls</Text>
          <Text style={styles.statValue}>{match.team2.fouls}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statValue}>{match.team1.yellowCards}</Text>
          <Text style={styles.statLabel}>Yellow Cards</Text>
          <Text style={styles.statValue}>{match.team2.yellowCards}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statValue}>{match.team1.redCards}</Text>
          <Text style={styles.statLabel}>Red Cards</Text>
          <Text style={styles.statValue}>{match.team2.redCards}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statValue}>{match.team1.offsides}</Text>
          <Text style={styles.statLabel}>Offsides</Text>
          <Text style={styles.statValue}>{match.team2.offsides}</Text>
        </View>
      </View>

      {/* Period Controls */}
      <View style={styles.periodControls}>
        <TouchableOpacity
          style={styles.periodButton}
          onPress={() => handlePeriodChange(MatchPeriod.HALF_TIME)}
          disabled={match.period !== MatchPeriod.FIRST_HALF}
        >
          <LinearGradient
            colors={match.period !== MatchPeriod.FIRST_HALF ? ['#777', '#999'] : ['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.periodGradient}
          >
            <Text style={styles.periodButtonText}>Half Time</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.periodButton}
          onPress={() => handlePeriodChange(MatchPeriod.SECOND_HALF)}
          disabled={match.period !== MatchPeriod.HALF_TIME}
        >
          <LinearGradient
            colors={match.period !== MatchPeriod.HALF_TIME ? ['#777', '#999'] : ['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.periodGradient}
          >
            <Text style={styles.periodButtonText}>Second Half</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.periodButton}
          onPress={() => handlePeriodChange(MatchPeriod.FULL_TIME)}
          disabled={match.period !== MatchPeriod.SECOND_HALF}
        >
          <LinearGradient
            colors={match.period !== MatchPeriod.SECOND_HALF ? ['#777', '#999'] : ['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.periodGradient}
          >
            <Text style={styles.periodButtonText}>Full Time</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Complete Match Button */}
      {match.status !== MatchStatus.COMPLETED && (
        <View style={styles.completeMatchContainer}>
          <TouchableOpacity
            style={styles.completeMatchButton}
            onPress={() => {
              Alert.alert(
                'Complete Match',
                'Are you sure you want to end this match now?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel'
                  },
                  {
                    text: 'Complete Match',
                    style: 'destructive',
                    onPress: async () => {
                      await completeMatch(match.period);
                    }
                  }
                ]
              );
            }}
          >
            <LinearGradient
              colors={['#FF4545', '#FF9F45']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.completeMatchGradient}
            >
              <Text style={styles.completeMatchButtonText}>Complete Match</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Extra Time Controls */}
      {match.period === MatchPeriod.FULL_TIME && match.team1.score === match.team2.score && (
        <View style={styles.periodControls}>
          <Text style={styles.sectionTitle}>Draw Match Options</Text>
          <TouchableOpacity
            style={styles.periodButton}
            onPress={() => handlePeriodChange(MatchPeriod.EXTRA_TIME_FIRST)}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.periodGradient}
            >
              <Text style={styles.periodButtonText}>Start Extra Time</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.periodButton}
            onPress={() => handlePeriodChange(MatchPeriod.PENALTIES)}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.periodGradient}
            >
              <Text style={styles.periodButtonText}>Go to Penalties</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.periodButton}
            onPress={() => completeMatch(MatchPeriod.FULL_TIME)}
          >
            <LinearGradient
              colors={['#FF4545', '#FF9F45']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.periodGradient}
            >
              <Text style={styles.periodButtonText}>End as Draw</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Extra Time First Half Controls */}
      {match.period === MatchPeriod.EXTRA_TIME_FIRST && (
        <View style={styles.periodControls}>
          <Text style={styles.sectionTitle}>Extra Time - First Half</Text>
          <TouchableOpacity
            style={styles.periodButton}
            onPress={() => handlePeriodChange(MatchPeriod.EXTRA_TIME_BREAK)}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.periodGradient}
            >
              <Text style={styles.periodButtonText}>End First Half</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Extra Time Break Controls */}
      {match.period === MatchPeriod.EXTRA_TIME_BREAK && (
        <View style={styles.periodControls}>
          <Text style={styles.sectionTitle}>Extra Time - Break</Text>
          <TouchableOpacity
            style={styles.periodButton}
            onPress={() => handlePeriodChange(MatchPeriod.EXTRA_TIME_SECOND)}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.periodGradient}
            >
              <Text style={styles.periodButtonText}>Start Second Half</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Extra Time Second Half Controls */}
      {match.period === MatchPeriod.EXTRA_TIME_SECOND && (
        <View style={styles.periodControls}>
          <Text style={styles.sectionTitle}>Extra Time - Second Half</Text>
          <TouchableOpacity
            style={styles.periodButton}
            onPress={() => {
              if (match.team1.score === match.team2.score) {
                // Still a draw, show options
                Alert.alert(
                  'Extra Time Ended - Still a Draw',
                  'The match is still tied after extra time. How would you like to proceed?',
                  [
                    {
                      text: 'Go to Penalties',
                      onPress: () => handlePeriodChange(MatchPeriod.PENALTIES)
                    },
                    {
                      text: 'End as Draw',
                      style: 'destructive',
                      onPress: () => completeMatch(MatchPeriod.FULL_TIME)
                    }
                  ]
                );
              } else {
                // Not a draw, complete the match
                completeMatch(MatchPeriod.FULL_TIME);
              }
            }}
          >
            <LinearGradient
              colors={['#FF9F45', '#D494FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.periodGradient}
            >
              <Text style={styles.periodButtonText}>End Extra Time</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Penalties Controls */}
      {match.period === MatchPeriod.PENALTIES && (
        <View style={styles.periodControls}>
          <Text style={styles.sectionTitle}>Penalty Shootout</Text>
          
          {/* Add controls for recording penalty scores */}
          <View style={styles.penaltyScoreContainer}>
            <View style={styles.teamPenaltyControls}>
              <Text style={styles.teamName}>{match.team1.name}</Text>
              <View style={styles.scoreControls}>
                <TouchableOpacity
                  style={styles.scoreButton}
                  onPress={async () => {
                    if (match.team1.score > 0) {
                      const newScore = match.team1.score - 1;
                      await updateDoc(doc(db, 'matches', matchId as string), {
                        'team1.score': newScore
                      });
                      setMatch({
                        ...match,
                        team1: {
                          ...match.team1,
                          score: newScore
                        }
                      });
                    }
                  }}
                >
                  <Text style={styles.scoreButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.penaltyScore}>{match.team1.score}</Text>
                <TouchableOpacity
                  style={styles.scoreButton}
                  onPress={async () => {
                    const newScore = match.team1.score + 1;
                    await updateDoc(doc(db, 'matches', matchId as string), {
                      'team1.score': newScore
                    });
                    setMatch({
                      ...match,
                      team1: {
                        ...match.team1,
                        score: newScore
                      }
                    });
                  }}
                >
                  <Text style={styles.scoreButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.teamPenaltyControls}>
              <Text style={styles.teamName}>{match.team2.name}</Text>
              <View style={styles.scoreControls}>
                <TouchableOpacity
                  style={styles.scoreButton}
                  onPress={async () => {
                    if (match.team2.score > 0) {
                      const newScore = match.team2.score - 1;
                      await updateDoc(doc(db, 'matches', matchId as string), {
                        'team2.score': newScore
                      });
                      setMatch({
                        ...match,
                        team2: {
                          ...match.team2,
                          score: newScore
                        }
                      });
                    }
                  }}
                >
                  <Text style={styles.scoreButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.penaltyScore}>{match.team2.score}</Text>
                <TouchableOpacity
                  style={styles.scoreButton}
                  onPress={async () => {
                    const newScore = match.team2.score + 1;
                    await updateDoc(doc(db, 'matches', matchId as string), {
                      'team2.score': newScore
                    });
                    setMatch({
                      ...match,
                      team2: {
                        ...match.team2,
                        score: newScore
                      }
                    });
                  }}
                >
                  <Text style={styles.scoreButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.periodButton}
            onPress={() => completeMatch(MatchPeriod.PENALTIES)}
          >
            <LinearGradient
              colors={['#FF4545', '#FF9F45']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.periodGradient}
            >
              <Text style={styles.periodButtonText}>Complete Match</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Event Modal for selecting player */}
      <Modal
        visible={eventModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEventModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {eventType === MatchEventType.GOAL ? 'Add Goal' :
                 eventType === MatchEventType.YELLOW_CARD ? 'Add Yellow Card' :
                 eventType === MatchEventType.RED_CARD ? 'Add Red Card' :
                 'Add Event'}
              </Text>
              <TouchableOpacity
                onPress={() => setEventModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Debug Info */}
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>Selected Team: {selectedTeam || 'None'}</Text>
              {selectedTeam && match && (
                <Text style={styles.debugText}>Team ID: {match[selectedTeam].id}</Text>
              )}
              {selectedTeam && match && (
                <Text style={styles.debugText}>
                  Players in list: {playersList[match[selectedTeam].id]?.length || 0}
                </Text>
              )}
            </View>

            <Text style={styles.modalLabel}>Select Player:</Text>
            {selectedTeam && match && (
              <FlatList
                data={playersList[match[selectedTeam].id] || []}
                renderItem={renderPlayerItem}
                keyExtractor={(item) => item.id}
                style={styles.playersList}
                ListEmptyComponent={() => (
                  <Text style={styles.noEventsText}>No players available</Text>
                )}
              />
            )}

            {eventType === MatchEventType.GOAL && (
              <>
                <Text style={styles.modalLabel}>Assist By (Optional):</Text>
                {selectedTeam && match && (
                  <FlatList
                    data={(playersList[match[selectedTeam].id] || [])
                      .filter(p => p.id !== selectedPlayer)}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.playerItem,
                          secondSelectedPlayer === item.id && styles.selectedPlayerItem
                        ]}
                        onPress={() => setSecondSelectedPlayer(
                          secondSelectedPlayer === item.id ? null : item.id
                        )}
                      >
                        <Text style={styles.playerNumber}>#{item.number}</Text>
                        <View style={styles.playerItemInfo}>
                          <Text style={styles.playerItemName}>{item.name}</Text>
                          <Text style={styles.playerItemPosition}>{item.position}</Text>
                        </View>
                        {item.isCaptain && (
                          <MaterialIcons name="star" size={16} color="#FFD700" />
                        )}
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.id}
                    style={styles.playersList}
                    ListEmptyComponent={() => (
                      <Text style={styles.noEventsText}>No players available</Text>
                    )}
                  />
                )}
              </>
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Additional notes (optional)"
              placeholderTextColor="#999"
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              multiline
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitEvent}
              disabled={!selectedPlayer}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Substitution Modal */}
      <Modal
        visible={subModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSubModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Player Substitution</Text>
              <TouchableOpacity
                onPress={() => setSubModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Player Out:</Text>
            {selectedTeam && match && (
              <FlatList
                data={playersList[match[selectedTeam].id]?.filter(p => p.isStarting) || []}
                renderItem={renderPlayerItem}
                keyExtractor={(item) => item.id}
                style={styles.playersList}
                ListEmptyComponent={() => (
                  <Text style={styles.noEventsText}>No players available</Text>
                )}
              />
            )}

            <Text style={styles.modalLabel}>Player In:</Text>
            {selectedTeam && match && (
              <FlatList
                data={playersList[match[selectedTeam].id]?.filter(p => !p.isStarting) || []}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.playerItem,
                      secondSelectedPlayer === item.id && styles.selectedPlayerItem
                    ]}
                    onPress={() => setSecondSelectedPlayer(
                      secondSelectedPlayer === item.id ? null : item.id
                    )}
                  >
                    <Text style={styles.playerNumber}>#{item.number}</Text>
                    <View style={styles.playerItemInfo}>
                      <Text style={styles.playerItemName}>{item.name}</Text>
                      <Text style={styles.playerItemPosition}>{item.position}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id}
                style={styles.playersList}
                ListEmptyComponent={() => (
                  <Text style={styles.noEventsText}>No substitutes available</Text>
                )}
              />
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Reason for substitution (optional)"
              placeholderTextColor="#999"
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              multiline
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitSubstitution}
              disabled={!selectedPlayer || !secondSelectedPlayer}
            >
              <LinearGradient
                colors={['#FF9F45', '#D494FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitButtonText}>Complete Substitution</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Team Actions section below the scorecard */}
      <View style={styles.teamActionsContainer}>
        <Text style={styles.sectionTitle}>Team Actions</Text>
        
        <View style={styles.teamActionRow}>
          <View style={styles.teamActionCol}>
            <Text style={styles.teamActionLabel}>{match.team1.name}</Text>
            <View style={styles.actionButtonsGroup}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordShot(match.team1.id, true)}
              >
                <Text style={styles.actionButtonText}>Shot On Target</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordShot(match.team1.id, false)}
              >
                <Text style={styles.actionButtonText}>Shot Off Target</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordStatEvent(match.team1.id, 'corner')}
              >
                <Text style={styles.actionButtonText}>Corner</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordStatEvent(match.team1.id, 'foul')}
              >
                <Text style={styles.actionButtonText}>Foul</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordStatEvent(match.team1.id, 'offside')}
              >
                <Text style={styles.actionButtonText}>Offside</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleSubstitution(match.team1.id)}
              >
                <Text style={styles.actionButtonText}>Substitution</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.teamActionCol}>
            <Text style={styles.teamActionLabel}>{match.team2.name}</Text>
            <View style={styles.actionButtonsGroup}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordShot(match.team2.id, true)}
              >
                <Text style={styles.actionButtonText}>Shot On Target</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordShot(match.team2.id, false)}
              >
                <Text style={styles.actionButtonText}>Shot Off Target</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordStatEvent(match.team2.id, 'corner')}
              >
                <Text style={styles.actionButtonText}>Corner</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordStatEvent(match.team2.id, 'foul')}
              >
                <Text style={styles.actionButtonText}>Foul</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => recordStatEvent(match.team2.id, 'offside')}
              >
                <Text style={styles.actionButtonText}>Offside</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleSubstitution(match.team2.id)}
              >
                <Text style={styles.actionButtonText}>Substitution</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Possession slider */}
        <View style={styles.possessionContainer}>
          <Text style={styles.possessionLabel}>Possession</Text>
          <View style={styles.possessionRow}>
            <Text style={styles.possessionTeam}>{match.team1.name}</Text>
            <Text style={styles.possessionValue}>{match.team1.possession}%</Text>
            <View style={styles.possessionSliderContainer}>
              <View 
                style={[
                  styles.possessionTeam1Bar, 
                  {width: `${match.team1.possession}%`}
                ]} 
              />
              <View 
                style={[
                  styles.possessionTeam2Bar, 
                  {width: `${match.team2.possession}%`}
                ]} 
              />
            </View>
            <Text style={styles.possessionValue}>{match.team2.possession}%</Text>
            <Text style={styles.possessionTeam}>{match.team2.name}</Text>
          </View>
          <View style={styles.possessionButtons}>
            <TouchableOpacity
              style={styles.possessionButton}
              onPress={() => updatePossession('team1', Math.min(100, match.team1.possession + 5))}
            >
              <Text style={styles.possessionButtonText}>+5% {match.team1.name}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.possessionButton}
              onPress={() => updatePossession('team2', Math.min(100, match.team2.possession + 5))}
            >
              <Text style={styles.possessionButtonText}>+5% {match.team2.name}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Add team roster sections */}
      <View style={styles.teamRosterContainer}>
        <Text style={styles.sectionTitle}>Team Rosters</Text>
        
        <View style={styles.teamRosterTabs}>
          <TouchableOpacity
            style={[styles.teamRosterTab, selectedTeam === 'team1' && styles.teamRosterTabActive]}
            onPress={() => setSelectedTeam('team1')}
          >
            <Text style={styles.teamRosterTabText}>
              {match.team1.name !== 'Team 1' ? match.team1.name : 'Team 1'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.teamRosterTab, selectedTeam === 'team2' && styles.teamRosterTabActive]}
            onPress={() => setSelectedTeam('team2')}
          >
            <Text style={styles.teamRosterTabText}>
              {match.team2.name !== 'Team 2' ? match.team2.name : 'Team 2'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.teamRosterList}>
          {selectedTeam && match && match[selectedTeam] && (
            [...(match[selectedTeam].players || []), ...(match[selectedTeam].substitutes || [])]
              .sort((a, b) => (a.isStarting === b.isStarting) ? 0 : a.isStarting ? -1 : 1)
              .map((player, index) => (
                <TouchableOpacity
                  key={player.id}
                  style={styles.rosterPlayerItem}
                  onPress={() => openPlayerStats(player)}
                >
                  <View style={styles.rosterPlayerNumber}>
                    <Text style={styles.rosterPlayerNumberText}>{player.number}</Text>
                  </View>
                  <View style={styles.rosterPlayerInfo}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Text style={styles.rosterPlayerName} numberOfLines={1}>
                        {player.name}
                      </Text>
                      {player.isCaptain && (
                        <Text style={{color: '#FFD700', marginLeft: 4, fontSize: 12}}>(C)</Text>
                      )}
                    </View>
                    <Text style={styles.rosterPlayerPosition}>{player.position}</Text>
                  </View>
                  <View style={styles.rosterPlayerStats}>
                    <Text style={styles.rosterPlayerStatText}>
                      {player.stats.goals > 0 && `⚽ ${player.stats.goals} `}
                      {player.stats.assists > 0 && `👟 ${player.stats.assists} `}
                      {player.stats.yellowCards > 0 && `🟨 ${player.stats.yellowCards} `}
                      {player.stats.redCards > 0 && `🟥 ${player.stats.redCards}`}
                      {player.position === 'GK' && player.stats.saves && player.stats.saves > 0 && 
                        `🧤 ${player.stats.saves}`}
                    </Text>
                    <Text style={styles.rosterPlayerStatus}>
                      {player.isStarting ? 'Starting' : 'Substitute'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
          )}
          {selectedTeam && match && match[selectedTeam] && 
            (match[selectedTeam].players.length === 0 && match[selectedTeam].substitutes.length === 0) && (
              <Text style={styles.noPlayersText}>
                No players found for {match[selectedTeam].name}. Go to the Teams section to add players.
              </Text>
            )
          }
        </View>
      </View>

      {/* Render the player stats modal */}
      {renderPlayerStatsModal()}

      {match.period === MatchPeriod.NOT_STARTED && (
        <Text style={styles.promptText}>
          Press the Start button to begin the match
        </Text>
      )}

      {match.period === MatchPeriod.FULL_TIME && (
        <Text style={styles.statusText}>
          Final Score: {match.team1.score} - {match.team2.score} • 
          {match.status === MatchStatus.COMPLETED ? ' Match Completed' : ' Match Ended'}
        </Text>
      )}

      {/* Add Winner Display */}
      {match.status === MatchStatus.COMPLETED && match.result && (
        <View style={styles.winnerContainer}>
          <LinearGradient
            colors={['#FF9F45', '#D494FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.winnerGradient}
          >
            <Text style={styles.winnerText}>{match.result}</Text>
          </LinearGradient>
        </View>
      )}
    </ScrollView>
  );
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#FF4545',
    fontSize: 16,
  },
  scorecard: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  periodIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  periodText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  timeText: {
    color: '#FF9F45',
    fontSize: 18,
    fontWeight: '600',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamSection: {
    flex: 2,
    alignItems: 'center',
  },
  teamLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    marginBottom: 8,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  score: {
    color: '#FF9F45',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  vs: {
    flex: 1,
    color: '#FF9F45',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  goalButton: {
    width: '100%',
    marginBottom: 8,
  },
  goalGradient: {
    borderRadius: 24,
    padding: 1,
  },
  goalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#000',
    margin: 1,
    padding: 8,
    borderRadius: 23,
  },
  cardButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cardButton: {
    padding: 4,
  },
  card: {
    width: 20,
    height: 28,
    borderRadius: 2,
  },
  yellowCard: {
    backgroundColor: '#FFD700',
  },
  redCard: {
    backgroundColor: '#FF0000',
  },
  stats: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  statsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    color: '#999',
    fontSize: 14,
    flex: 2,
    textAlign: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  periodControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
  },
  periodGradient: {
    borderRadius: 24,
    padding: 1,
  },
  periodButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#000',
    margin: 1,
    padding: 8,
    borderRadius: 23,
  },
  matchHeader: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  matchTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  venueText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  eventsContainer: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  eventsList: {
    marginBottom: 12,
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTime: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  eventDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventType: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  eventPlayer: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  eventInfo: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  noEventsText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 8,
    width: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  playersList: {
    maxHeight: 200,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  selectedPlayerItem: {
    backgroundColor: '#333',
  },
  playerNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  playerItemInfo: {
    flexDirection: 'column',
    marginLeft: 8,
  },
  playerItemName: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  playerItemPosition: {
    color: '#999',
    fontSize: 12,
  },
  submitButton: {
    width: '100%',
    marginTop: 16,
  },
  submitGradient: {
    borderRadius: 24,
    padding: 1,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#000',
    margin: 1,
    padding: 8,
    borderRadius: 23,
  },
  modalInput: {
    color: '#FFFFFF',
    backgroundColor: '#333',
    borderRadius: 4,
    padding: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clockButton: {
    padding: 4,
  },
  teamLogoImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  debugInfo: {
    backgroundColor: '#333',
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 4,
  },
  teamActionsContainer: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  teamActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamActionCol: {
    flex: 1,
    padding: 8,
  },
  teamActionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  actionButtonsGroup: {
    width: '100%',
  },
  actionButton: {
    backgroundColor: '#333',
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  possessionContainer: {
    marginTop: 16,
  },
  possessionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  possessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  possessionTeam: {
    color: '#FFFFFF',
    fontSize: 12,
    width: 50,
    textAlign: 'center',
  },
  possessionValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  possessionSliderContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#333',
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  possessionTeam1Bar: {
    height: '100%',
    backgroundColor: '#FF9F45',
  },
  possessionTeam2Bar: {
    height: '100%',
    backgroundColor: '#4287f5',
  },
  possessionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  possessionButton: {
    backgroundColor: '#333',
    borderRadius: 4,
    padding: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  possessionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  timelineContainer: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  timelineContent: {
    marginTop: 8,
    position: 'relative',
  },
  timelinePeriods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelinePeriodMark: {
    color: '#999',
    fontSize: 12,
  },
  timelinePeriodMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    backgroundColor: 'rgba(255, 159, 69, 0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -12 }],
    top: -2,
  },
  timelinePeriodMarkerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  timelineEventMarker: {
    position: 'absolute',
    zIndex: 10,
  },
  timelineEventDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  timelineEventTeam1: {
    backgroundColor: '#FF9F45',
  },
  timelineEventTeam2: {
    backgroundColor: '#4287f5',
  },
  timelineEventTooltip: {
    position: 'absolute',
    minWidth: 100,
    top: 22,
    left: -40,
    backgroundColor: '#333',
    borderRadius: 4,
    padding: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  timelineEventTooltipTeam1: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9F45',
  },
  timelineEventTooltipTeam2: {
    borderLeftWidth: 4,
    borderLeftColor: '#4287f5',
  },
  timelineEventTime: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  timelineEventInfo: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  timelineTeams: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  timelineTeam: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineTeamIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  timelineTeamName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  timelineYellowCard: {
    backgroundColor: '#FFD700',
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  timelineRedCard: {
    backgroundColor: '#FF0000',
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  // Player Stats Modal styles
  playerStatsHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  playerStatsName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playerStatsPosition: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  playerStatsNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playerStatsList: {
    maxHeight: 400,
  },
  playerStatsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  playerStatsLabel: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  playerStatsControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerStatsButton: {
    width: 30,
    height: 30,
    backgroundColor: '#333',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerStatsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playerStatsValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    width: 40,
    textAlign: 'center',
  },
  lineupContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: -8,
    marginBottom: 8,
    gap: 8,
  },
  lineupButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  lineupButtonText: {
    color: '#FF9F45',
    fontSize: 14,
    fontWeight: '600',
  },
  teamRosterContainer: {
    backgroundColor: '#1A1A1A',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  teamRosterTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamRosterTab: {
    backgroundColor: '#333',
    borderRadius: 4,
    padding: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  teamRosterTabActive: {
    backgroundColor: '#FF9F45',
  },
  teamRosterTabText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  teamRosterList: {
    maxHeight: '100%',
  },
  rosterPlayerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  rosterPlayerNumber: {
    width: 30,
    alignItems: 'center',
    marginRight: 6,
  },
  rosterPlayerNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  rosterPlayerInfo: {
    flex: 1,
    paddingRight: 8,
  },
  rosterPlayerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  rosterPlayerPosition: {
    color: '#999',
    fontSize: 12,
  },
  rosterPlayerStats: {
    width: 100,
    alignItems: 'flex-end',
  },
  rosterPlayerStatText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 4,
  },
  rosterPlayerStatus: {
    color: '#999',
    fontSize: 10,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 16,
  },
  timelineCurrentTime: {
    position: 'absolute',
    zIndex: 5,
    top: -10,
    height: 40,
    width: 2,
    backgroundColor: '#FF9F45',
  },
  timelineCurrentTimeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF9F45',
    position: 'absolute',
    top: -6,
    left: -5,
  },
  timelinePeriodLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelinePeriodLabel: {
    position: 'absolute',
    top: 20,
    width: '25%',
    textAlign: 'center',
  },
  timelinePeriodLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  completeMatchContainer: {
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  completeMatchButton: {
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  completeMatchGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  completeMatchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  promptText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  winnerContainer: {
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  winnerGradient: {
    padding: 15,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    alignItems: 'center',
  },
  winnerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noPlayersText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  penaltyScoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamPenaltyControls: {
    flex: 1,
    alignItems: 'center',
  },
  scoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  scoreButton: {
    width: 36,
    height: 36,
    backgroundColor: '#333',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  scoreButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  penaltyScore: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
}); 