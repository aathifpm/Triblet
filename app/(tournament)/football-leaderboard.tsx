import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { useLocalSearchParams } from 'expo-router';

interface PlayerStats {
  id: string;
  name: string;
  teamName: string;
  matches: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  saves?: number;
  cleanSheets?: number;
}

interface TeamStats {
  id: string;
  name: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  goalDifference: number;
}

export default function FootballLeaderboard() {
  const [activeTab, setActiveTab] = useState<'STANDINGS' | 'SCORERS' | 'GOALKEEPERS'>('STANDINGS');
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [goalkeeperStats, setGoalkeeperStats] = useState<PlayerStats[]>([]);
  const { tournamentId } = useLocalSearchParams();
  const db = getFirestore();

  useEffect(() => {
    if (tournamentId) {
      loadStats();
    }
  }, [tournamentId]);

  const loadStats = async () => {
    try {
      // Load team stats
      const teamsRef = collection(db, 'teams');
      const teamsQuery = query(teamsRef, where('tournamentId', '==', tournamentId));
      const teamsSnapshot = await getDocs(teamsQuery);
      
      const teamsData: TeamStats[] = [];
      teamsSnapshot.forEach((doc) => {
        const data = doc.data();
        teamsData.push({
          id: doc.id,
          name: data.name,
          matches: data.stats.matches,
          wins: data.stats.wins,
          draws: data.stats.draws,
          losses: data.stats.losses,
          goalsFor: data.stats.goalsFor,
          goalsAgainst: data.stats.goalsAgainst,
          points: data.stats.points,
          goalDifference: data.stats.goalsFor - data.stats.goalsAgainst,
        });
      });
      setTeamStats(teamsData.sort((a, b) => 
        b.points - a.points || b.goalDifference - a.goalDifference
      ));

      // Load player stats
      const playersRef = collection(db, 'players');
      const playersQuery = query(playersRef, where('tournamentId', '==', tournamentId));
      const playersSnapshot = await getDocs(playersQuery);
      
      const scorersData: PlayerStats[] = [];
      const goalkeepersData: PlayerStats[] = [];
      
      playersSnapshot.forEach((doc) => {
        const data = doc.data();
        const player = {
          id: doc.id,
          name: data.name,
          teamName: data.teamName,
          matches: data.stats.matches,
          goals: data.stats.goals,
          assists: data.stats.assists,
          yellowCards: data.stats.yellowCards,
          redCards: data.stats.redCards,
          saves: data.stats.saves,
          cleanSheets: data.stats.cleanSheets,
        };
        
        if (data.position === 'GOALKEEPER') {
          goalkeepersData.push(player);
        } else if (data.stats.goals > 0 || data.stats.assists > 0) {
          scorersData.push(player);
        }
      });

      setPlayerStats(scorersData.sort((a, b) => 
        b.goals - a.goals || b.assists - a.assists
      ));
      setGoalkeeperStats(goalkeepersData.sort((a, b) => 
        (b.cleanSheets || 0) - (a.cleanSheets || 0) || (b.saves || 0) - (a.saves || 0)
      ));
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const renderStandings = () => (
    <View style={styles.statsTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Team</Text>
        <Text style={styles.headerCell}>P</Text>
        <Text style={styles.headerCell}>W</Text>
        <Text style={styles.headerCell}>D</Text>
        <Text style={styles.headerCell}>L</Text>
        <Text style={styles.headerCell}>GF</Text>
        <Text style={styles.headerCell}>GA</Text>
        <Text style={styles.headerCell}>GD</Text>
        <Text style={styles.headerCell}>Pts</Text>
      </View>
      {teamStats.map((team, index) => (
        <View key={team.id} style={styles.tableRow}>
          <View style={[styles.cell, { flex: 2 }]}>
            <Text style={styles.position}>{index + 1}</Text>
            <Text style={styles.teamName}>{team.name}</Text>
          </View>
          <Text style={styles.cell}>{team.matches}</Text>
          <Text style={styles.cell}>{team.wins}</Text>
          <Text style={styles.cell}>{team.draws}</Text>
          <Text style={styles.cell}>{team.losses}</Text>
          <Text style={styles.cell}>{team.goalsFor}</Text>
          <Text style={styles.cell}>{team.goalsAgainst}</Text>
          <Text style={styles.cell}>{team.goalDifference}</Text>
          <Text style={[styles.cell, styles.points]}>{team.points}</Text>
        </View>
      ))}
    </View>
  );

  const renderScorers = () => (
    <View style={styles.statsTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Player</Text>
        <Text style={styles.headerCell}>P</Text>
        <Text style={styles.headerCell}>G</Text>
        <Text style={styles.headerCell}>A</Text>
        <Text style={styles.headerCell}>YC</Text>
        <Text style={styles.headerCell}>RC</Text>
      </View>
      {playerStats.map((player) => (
        <View key={player.id} style={styles.tableRow}>
          <View style={[styles.cell, { flex: 2 }]}>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={styles.teamName}>{player.teamName}</Text>
          </View>
          <Text style={styles.cell}>{player.matches}</Text>
          <Text style={styles.cell}>{player.goals}</Text>
          <Text style={styles.cell}>{player.assists}</Text>
          <Text style={styles.cell}>{player.yellowCards}</Text>
          <Text style={styles.cell}>{player.redCards}</Text>
        </View>
      ))}
    </View>
  );

  const renderGoalkeepers = () => (
    <View style={styles.statsTable}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Goalkeeper</Text>
        <Text style={styles.headerCell}>P</Text>
        <Text style={styles.headerCell}>CS</Text>
        <Text style={styles.headerCell}>SV</Text>
      </View>
      {goalkeeperStats.map((player) => (
        <View key={player.id} style={styles.tableRow}>
          <View style={[styles.cell, { flex: 2 }]}>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={styles.teamName}>{player.teamName}</Text>
          </View>
          <Text style={styles.cell}>{player.matches}</Text>
          <Text style={styles.cell}>{player.cleanSheets}</Text>
          <Text style={styles.cell}>{player.saves}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'STANDINGS' && styles.activeTab]}
          onPress={() => setActiveTab('STANDINGS')}
        >
          <Text style={[styles.tabText, activeTab === 'STANDINGS' && styles.activeTabText]}>
            Standings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'SCORERS' && styles.activeTab]}
          onPress={() => setActiveTab('SCORERS')}
        >
          <Text style={[styles.tabText, activeTab === 'SCORERS' && styles.activeTabText]}>
            Top Scorers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'GOALKEEPERS' && styles.activeTab]}
          onPress={() => setActiveTab('GOALKEEPERS')}
        >
          <Text style={[styles.tabText, activeTab === 'GOALKEEPERS' && styles.activeTabText]}>
            Goalkeepers
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'STANDINGS' && renderStandings()}
        {activeTab === 'SCORERS' && renderScorers()}
        {activeTab === 'GOALKEEPERS' && renderGoalkeepers()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#2196F3',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: 'white',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsTable: {
    backgroundColor: 'white',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  cell: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  position: {
    position: 'absolute',
    left: 0,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  teamName: {
    fontSize: 14,
    marginLeft: 24,
  },
  playerName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  points: {
    fontWeight: 'bold',
    color: '#2196F3',
  },
}); 