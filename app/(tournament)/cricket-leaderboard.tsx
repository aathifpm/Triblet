import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';

interface PlayerStats {
  id: string;
  name: string;
  teamName: string;
  matches: number;
  runs: number;
  wickets: number;
  sixes: number;
  fours: number;
  average: number;
  strikeRate: number;
  economy: number;
}

interface TeamStats {
  id: string;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  points: number;
  nrr: number; // Net Run Rate
}

interface MatchStats {
  id: string;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  team1Overs: number;
  team2Overs: number;
  team1Wickets: number;
  team2Wickets: number;
  winnerName: string;
  date: string;
}

export default function CricketLeaderboard() {
  const [activeTab, setActiveTab] = useState<'TEAMS' | 'BATTING' | 'BOWLING' | 'MATCHES'>('TEAMS');
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [battingStats, setBattingStats] = useState<PlayerStats[]>([]);
  const [bowlingStats, setBowlingStats] = useState<PlayerStats[]>([]);
  const [matchStats, setMatchStats] = useState<MatchStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tournamentId } = useLocalSearchParams();
  const db = getFirestore();

  useEffect(() => {
    if (tournamentId) {
      loadStats();
    }
  }, [tournamentId]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, get the tournament document to access tournament stats
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId as string));
      if (!tournamentDoc.exists()) {
        throw new Error('Tournament not found');
      }

      // Load team stats
      const teamsRef = collection(db, 'teams');
      const teamsQuery = query(teamsRef, where('tournamentId', '==', tournamentId));
      const teamsSnapshot = await getDocs(teamsQuery);
      
      // Get all completed matches for the tournament
      const matchesQuery = query(
        collection(db, 'matches'),
        where('tournamentId', '==', tournamentId),
        where('status', '==', 'COMPLETED')
      );
      const matchesSnapshot = await getDocs(matchesQuery);
      
      // Create a map to store team stats
      const teamStatsMap = new Map();
      const teamsMap = new Map(); // To store team names for player stats

      // Initialize team stats
      teamsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        teamsMap.set(doc.id, data.name);
        teamStatsMap.set(doc.id, {
          id: doc.id,
          name: data.name || 'Unknown Team',
          matches: 0,
          wins: 0,
          losses: 0,
          points: 0,
          runsScored: 0,
          runsConceded: 0,
          oversPlayed: 0,
          oversBowled: 0,
          nrr: 0
        });
      });

      // Store match stats
      const matches: MatchStats[] = [];
      
      // Calculate stats from matches
      matchesSnapshot.docs.forEach(matchDoc => {
        const matchData = matchDoc.data();

        
        const team1Stats = teamStatsMap.get(matchData.team1Id);
        const team2Stats = teamStatsMap.get(matchData.team2Id);

        if (team1Stats && team2Stats) {
          // Update matches played
          team1Stats.matches++;
          team2Stats.matches++;

          // Determine if team1 batted first
          const team1BattedFirst = matchData.firstInningsTeam === matchData.team1Id;

          // Update wins, losses and points
          let winner;
          if (matchData.result?.winner) {
            winner = matchData.result.winner;
          } else if (matchData.firstInningsScore !== undefined && matchData.secondInningsScore !== undefined) {
            // Determine winner based on scores if not explicitly set
            const team1Score = team1BattedFirst ? matchData.firstInningsScore : matchData.secondInningsScore;
            const team2Score = team1BattedFirst ? matchData.secondInningsScore : matchData.firstInningsScore;
            
            if (team1Score > team2Score) {
              winner = matchData.team1Id;
            } else if (team2Score > team1Score) {
              winner = matchData.team2Id;
            }
            // If scores are equal, it's a tie (no winner)
          }



          if (winner === matchData.team1Id) {
            
            team1Stats.wins++;
            team1Stats.points += 2;
            team2Stats.losses++;
          } else if (winner === matchData.team2Id) {

            team2Stats.wins++;
            team2Stats.points += 2;
            team1Stats.losses++;
          }

          // Update runs and overs for NRR calculation
          if (team1BattedFirst) {
            team1Stats.runsScored += matchData.firstInningsScore || 0;
            team1Stats.oversPlayed += matchData.firstInningsOvers || 0;
            team2Stats.runsConceded += matchData.firstInningsScore || 0;
            team2Stats.oversBowled += matchData.firstInningsOvers || 0;
            
            team2Stats.runsScored += matchData.secondInningsScore || 0;
            team2Stats.oversPlayed += matchData.secondInningsOvers || 0;
            team1Stats.runsConceded += matchData.secondInningsScore || 0;
            team1Stats.oversBowled += matchData.secondInningsOvers || 0;
          } else {
            team2Stats.runsScored += matchData.firstInningsScore || 0;
            team2Stats.oversPlayed += matchData.firstInningsOvers || 0;
            team1Stats.runsConceded += matchData.firstInningsScore || 0;
            team1Stats.oversBowled += matchData.firstInningsOvers || 0;
            
            team1Stats.runsScored += matchData.secondInningsScore || 0;
            team1Stats.oversPlayed += matchData.secondInningsOvers || 0;
            team2Stats.runsConceded += matchData.secondInningsScore || 0;
            team2Stats.oversBowled += matchData.secondInningsOvers || 0;
          }

          // Add match stats
          matches.push({
            id: matchDoc.id,
            team1Name: team1Stats.name,
            team2Name: team2Stats.name,
            team1Score: matchData.firstInningsTeam === matchData.team1Id ? 
              (matchData.firstInningsScore || 0) : 
              (matchData.secondInningsScore || 0),
            team2Score: matchData.firstInningsTeam === matchData.team2Id ? 
              (matchData.firstInningsScore || 0) : 
              (matchData.secondInningsScore || 0),
            team1Overs: matchData.firstInningsTeam === matchData.team1Id ? 
              (matchData.firstInningsOvers || 0) : 
              (matchData.secondInningsOvers || 0),
            team2Overs: matchData.firstInningsTeam === matchData.team2Id ? 
              (matchData.firstInningsOvers || 0) : 
              (matchData.secondInningsOvers || 0),
            team1Wickets: matchData.firstInningsTeam === matchData.team1Id ? 
              (matchData.firstInningsWickets || 0) : 
              (matchData.secondInningsWickets || 0),
            team2Wickets: matchData.firstInningsTeam === matchData.team2Id ? 
              (matchData.firstInningsWickets || 0) : 
              (matchData.secondInningsWickets || 0),
            winnerName: matchData.result?.winner ? 
              (matchData.result.winner === matchData.team1Id ? team1Stats.name : team2Stats.name) :
              (matchData.firstInningsScore !== undefined && matchData.secondInningsScore !== undefined ? 
                (team1BattedFirst ? 
                  (matchData.firstInningsScore > matchData.secondInningsScore ? team1Stats.name : 
                   matchData.secondInningsScore > matchData.firstInningsScore ? team2Stats.name : 'Tie') :
                  (matchData.secondInningsScore > matchData.firstInningsScore ? team1Stats.name :
                   matchData.firstInningsScore > matchData.secondInningsScore ? team2Stats.name : 'Tie')
                ) : 'Unknown'),
            date: 'Match ' + (matches.length + 1)  // Simple match numbering instead of dates
          });
        }
      });

      // Log final team stats before creating array
      console.log('Final Team Stats:');
      teamStatsMap.forEach((stats, teamId) => {
        console.log(`${stats.name}:`, {
          matches: stats.matches,
          wins: stats.wins,
          losses: stats.losses,
          points: stats.points
        });
      });

      // Calculate NRR and create final team stats array
      const teamsData: TeamStats[] = Array.from(teamStatsMap.values()).map(team => {
        const nrr = (team.oversPlayed > 0 && team.oversBowled > 0)
          ? ((team.runsScored / team.oversPlayed) - (team.runsConceded / team.oversBowled))
          : 0;

        return {
          id: team.id,
          name: team.name,
          matches: team.matches,
          wins: team.wins,
          losses: team.losses,
          points: team.points,
          nrr: Number(nrr.toFixed(3))
        };
      });

      setTeamStats(teamsData.sort((a, b) => b.points - a.points || b.nrr - a.nrr));

      // Load player stats from completed matches
      const playerStatsMap = new Map();

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();
        
        // Process team 1 players
        if (matchData.team1?.players) {
          matchData.team1.players.forEach((player: any) => {
            if (!playerStatsMap.has(player.id)) {
              playerStatsMap.set(player.id, {
                id: player.id,
                name: player.name,
                teamName: teamsMap.get(matchData.team1Id) || 'Unknown Team',
                matches: 0,
                runs: 0,
                wickets: 0,
                sixes: 0,
                fours: 0,
                balls: 0,
                runsConceded: 0,
                overs: 0
              });
            }
            
            const stats = playerStatsMap.get(player.id);
            stats.matches++;
            
            if (player.battingStats) {
              stats.runs += player.battingStats.runs || 0;
              stats.sixes += player.battingStats.sixes || 0;
              stats.fours += player.battingStats.fours || 0;
              stats.balls += player.battingStats.balls || 0;
            }
            
            if (player.bowlingStats) {
              stats.wickets += player.bowlingStats.wickets || 0;
              stats.runsConceded += player.bowlingStats.runs || 0;
              stats.overs += player.bowlingStats.overs || 0;
            }
          });
        }

        // Process team 2 players
        if (matchData.team2?.players) {
          matchData.team2.players.forEach((player: any) => {
            if (!playerStatsMap.has(player.id)) {
              playerStatsMap.set(player.id, {
                id: player.id,
                name: player.name,
                teamName: teamsMap.get(matchData.team2Id) || 'Unknown Team',
                matches: 0,
                runs: 0,
                wickets: 0,
                sixes: 0,
                fours: 0,
                balls: 0,
                runsConceded: 0,
                overs: 0
              });
            }
            
            const stats = playerStatsMap.get(player.id);
            stats.matches++;
            
            if (player.battingStats) {
              stats.runs += player.battingStats.runs || 0;
              stats.sixes += player.battingStats.sixes || 0;
              stats.fours += player.battingStats.fours || 0;
              stats.balls += player.battingStats.balls || 0;
            }
            
            if (player.bowlingStats) {
              stats.wickets += player.bowlingStats.wickets || 0;
              stats.runsConceded += player.bowlingStats.runs || 0;
              stats.overs += player.bowlingStats.overs || 0;
            }
          });
        }
      }

      const playerStats = Array.from(playerStatsMap.values()).map(stats => ({
        ...stats,
        average: stats.matches > 0 ? stats.runs / stats.matches : 0,
        strikeRate: stats.balls > 0 ? (stats.runs / stats.balls) * 100 : 0,
        economy: stats.overs > 0 ? stats.runsConceded / stats.overs : 0
      }));

      setBattingStats(playerStats
        .filter(player => player.runs > 0)
        .sort((a, b) => b.runs - a.runs)
      );

      setBowlingStats(playerStats
        .filter(player => player.wickets > 0)
        .sort((a, b) => b.wickets - a.wickets)
      );

      // Set match stats directly without sorting
      setMatchStats(matches);

      setLoading(false);
    } catch (error) {
      console.error('Error loading stats:', error);
      setError('Failed to load statistics. Please try again.');
      setLoading(false);
    }
  };

  const renderTeamStats = () => (
    <View style={styles.statsTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Team</Text>
        <Text style={styles.headerCell}>M</Text>
        <Text style={styles.headerCell}>W</Text>
        <Text style={styles.headerCell}>L</Text>
        <Text style={styles.headerCell}>Pts</Text>
        <Text style={styles.headerCell}>NRR</Text>
      </View>
      {teamStats.length > 0 ? (
        teamStats.map((team) => (
        <View key={team.id} style={styles.tableRow}>
          <Text style={[styles.cell, { flex: 2 }]}>{team.name}</Text>
          <Text style={styles.cell}>{team.matches}</Text>
          <Text style={styles.cell}>{team.wins}</Text>
          <Text style={styles.cell}>{team.losses}</Text>
          <Text style={styles.cell}>{team.points}</Text>
          <Text style={styles.cell}>{team.nrr.toFixed(2)}</Text>
        </View>
        ))
      ) : (
        <View style={styles.noDataRow}>
          <Text style={styles.noDataText}>No team statistics available</Text>
        </View>
      )}
    </View>
  );

  const renderBattingStats = () => (
    <View style={styles.statsTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Batsman</Text>
        <Text style={styles.headerCell}>M</Text>
        <Text style={styles.headerCell}>Runs</Text>
        <Text style={styles.headerCell}>4s</Text>
        <Text style={styles.headerCell}>6s</Text>
        <Text style={styles.headerCell}>Avg</Text>
        <Text style={styles.headerCell}>SR</Text>
      </View>
      {battingStats.length > 0 ? (
        battingStats.map((player) => (
        <View key={player.id} style={styles.tableRow}>
          <View style={[styles.cell, { flex: 2 }]}>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={styles.teamName}>{player.teamName}</Text>
          </View>
          <Text style={styles.cell}>{player.matches}</Text>
          <Text style={styles.cell}>{player.runs}</Text>
          <Text style={styles.cell}>{player.fours}</Text>
          <Text style={styles.cell}>{player.sixes}</Text>
          <Text style={styles.cell}>{player.average.toFixed(2)}</Text>
          <Text style={styles.cell}>{player.strikeRate.toFixed(2)}</Text>
        </View>
        ))
      ) : (
        <View style={styles.noDataRow}>
          <Text style={styles.noDataText}>No batting statistics available</Text>
        </View>
      )}
    </View>
  );

  const renderBowlingStats = () => (
    <View style={styles.statsTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Bowler</Text>
        <Text style={styles.headerCell}>M</Text>
        <Text style={styles.headerCell}>W</Text>
        <Text style={styles.headerCell}>Eco</Text>
      </View>
      {bowlingStats.length > 0 ? (
        bowlingStats.map((player) => (
        <View key={player.id} style={styles.tableRow}>
          <View style={[styles.cell, { flex: 2 }]}>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={styles.teamName}>{player.teamName}</Text>
          </View>
          <Text style={styles.cell}>{player.matches}</Text>
          <Text style={styles.cell}>{player.wickets}</Text>
          <Text style={styles.cell}>{player.economy.toFixed(2)}</Text>
        </View>
        ))
      ) : (
        <View style={styles.noDataRow}>
          <Text style={styles.noDataText}>No bowling statistics available</Text>
        </View>
      )}
    </View>
  );

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

  const renderMatchStats = () => (
    <View style={styles.statsTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 3 }]}>Match Details</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Result</Text>
      </View>
      {matchStats.length > 0 ? (
        matchStats.map((match) => (
          <View key={match.id} style={styles.tableRow}>
            <View style={[styles.cell, { flex: 3 }]}>
              <Text style={styles.matchTeam}>
                {match.team1Name}: {match.team1Score}/{match.team1Wickets || 0} ({formatOvers(match.team1Overs)})
              </Text>
              <Text style={styles.matchTeam}>
                {match.team2Name}: {match.team2Score}/{match.team2Wickets || 0} ({formatOvers(match.team2Overs)})
              </Text>
              <Text style={styles.matchDate}>{match.date}</Text>
            </View>
            <View style={[styles.cell, { flex: 1, justifyContent: 'center' }]}>
              <Text style={[styles.winnerText, { color: '#FF9F45' }]}>
                {match.winnerName === 'Tie' ? 'Tie' : `${match.winnerName} won`}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.noDataRow}>
          <Text style={styles.noDataText}>No match statistics available</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF9F45" />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadStats}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'TEAMS' && styles.activeTab]}
          onPress={() => setActiveTab('TEAMS')}
        >
          <Text style={[styles.tabText, activeTab === 'TEAMS' && styles.activeTabText]}>
            Teams
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'BATTING' && styles.activeTab]}
          onPress={() => setActiveTab('BATTING')}
        >
          <Text style={[styles.tabText, activeTab === 'BATTING' && styles.activeTabText]}>
            Batting
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'BOWLING' && styles.activeTab]}
          onPress={() => setActiveTab('BOWLING')}
        >
          <Text style={[styles.tabText, activeTab === 'BOWLING' && styles.activeTabText]}>
            Bowling
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'MATCHES' && styles.activeTab]}
          onPress={() => setActiveTab('MATCHES')}
        >
          <Text style={[styles.tabText, activeTab === 'MATCHES' && styles.activeTabText]}>
            Matches
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'TEAMS' && renderTeamStats()}
        {activeTab === 'BATTING' && renderBattingStats()}
        {activeTab === 'BOWLING' && renderBowlingStats()}
        {activeTab === 'MATCHES' && renderMatchStats()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  errorText: {
    color: '#FF4545',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF9F45',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FF9F45',
  },
  tabText: {
    fontSize: 16,
    color: '#CCCCCC',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsTable: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  cell: {
    flex: 1,
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  playerName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  teamName: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  noDataRow: {
    padding: 20,
    alignItems: 'center',
  },
  noDataText: {
    color: '#999999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  matchTeam: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  matchDate: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  winnerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 