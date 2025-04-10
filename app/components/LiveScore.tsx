import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';

interface LiveScoreProps {
  matchId: string;
  gameType: 'CRICKET' | 'FOOTBALL';
}

interface CricketScore {
  battingTeam?: {
    name: string;
    score: number;
    wickets: number;
  };
  currentInnings?: number;
  ballsInOver?: number;
  target?: number;
  striker?: {
    name: string;
    runs: number;
    balls: number;
  };
  nonStriker?: {
    name: string;
    runs: number;
    balls: number;
  };
  currentBowler?: {
    name: string;
    wickets: number;
    runsConceded: number;
  };
}

interface FootballScore {
  team1: {
    name: string;
    score: number;
  };
  team2: {
    name: string;
    score: number;
  };
  period: string;
  currentTime: number;
}

export default function LiveScore({ matchId, gameType }: LiveScoreProps) {
  const [loading, setLoading] = useState(true);
  const [cricketScore, setCricketScore] = useState<CricketScore | null>(null);
  const [footballScore, setFootballScore] = useState<FootballScore | null>(null);
  const db = getFirestore();

  useEffect(() => {
    if (!matchId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'matches', matchId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          
          if (gameType === 'CRICKET') {
            setCricketScore({
              battingTeam: {
                name: data.battingTeam?.name || 'Team',
                score: data.battingTeam?.score || 0,
                wickets: data.battingTeam?.wickets || 0,
              },
              currentInnings: data.currentInnings,
              ballsInOver: data.ballsInOver || 0,
              target: data.target,
              striker: data.striker ? {
                name: data.striker.name,
                runs: data.striker.runs || 0,
                balls: data.striker.balls || 0,
              } : undefined,
              nonStriker: data.nonStriker ? {
                name: data.nonStriker.name,
                runs: data.nonStriker.runs || 0,
                balls: data.nonStriker.balls || 0,
              } : undefined,
              currentBowler: data.currentBowler ? {
                name: data.currentBowler.name,
                wickets: data.currentBowler.wickets || 0,
                runsConceded: data.currentBowler.runsConceded || 0,
              } : undefined,
            });
          } else {
            setFootballScore({
              team1: {
                name: data.team1?.name || 'Team 1',
                score: data.team1?.score || 0,
              },
              team2: {
                name: data.team2?.name || 'Team 2',
                score: data.team2?.score || 0,
              },
              period: data.period || 'NOT_STARTED',
              currentTime: data.currentTime || 0,
            });
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to score updates:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [matchId, gameType]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FF9F45" />
      </View>
    );
  }

  if (gameType === 'CRICKET' && cricketScore) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1A1A1A', '#2A2A2A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scoreCard}
        >
          <View style={styles.cricketScore}>
            <View style={styles.teamScoreContainer}>
              <Text style={styles.teamName}>{cricketScore.battingTeam?.name}</Text>
              <Text style={styles.score}>
                {cricketScore.battingTeam?.score || 0}/{cricketScore.battingTeam?.wickets || 0}
              </Text>
              <Text style={styles.overs}>
                ({Math.floor(cricketScore.ballsInOver || 0) / 6}.{(cricketScore.ballsInOver || 0) % 6} ov)
              </Text>
            </View>
            {cricketScore.target && (
              <Text style={styles.target}>Target: {cricketScore.target}</Text>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (gameType === 'FOOTBALL' && footballScore) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1A1A1A', '#2A2A2A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scoreCard}
        >
          <Text style={styles.period}>
            {footballScore.period.replace('_', ' ')} - {footballScore.currentTime}'
          </Text>
          <View style={styles.footballScore}>
            <Text style={styles.teamName}>{footballScore.team1.name}</Text>
            <Text style={styles.score}>{footballScore.team1.score} - {footballScore.team2.score}</Text>
            <Text style={styles.teamName}>{footballScore.team2.name}</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  scoreCard: {
    padding: 16,
    borderRadius: 8,
  },
  cricketScore: {
    alignItems: 'center',
  },
  teamScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  score: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  overs: {
    color: '#999999',
    fontSize: 14,
  },
  target: {
    color: '#FF9F45',
    fontSize: 14,
    marginTop: 4,
  },
  period: {
    color: '#FF9F45',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  footballScore: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}); 