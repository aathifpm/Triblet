import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { TournamentStats } from '../../types/cricket';

interface TournamentLeaderboardProps {
  tournamentId: string;
}

export default function TournamentLeaderboard({ tournamentId }: TournamentLeaderboardProps) {
  const [stats, setStats] = useState<TournamentStats | null>(null);
  const [activeTab, setActiveTab] = useState<'batting' | 'bowling' | 'sixes'>('batting');
  const db = getFirestore();

  useEffect(() => {
    loadTournamentStats();
  }, [tournamentId]);

  const loadTournamentStats = async () => {
    try {
      const statsDoc = await getDoc(doc(db, 'tournamentStats', tournamentId));
      if (statsDoc.exists()) {
        setStats(statsDoc.data() as TournamentStats);
      }
    } catch (error) {
      console.error('Error loading tournament stats:', error);
    }
  };

  const renderBattingStats = () => (
    <View style={styles.statsSection}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, styles.headerCell, styles.playerCell]}>Player</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>M</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>R</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>Avg</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>SR</Text>
      </View>
      {stats?.topScorers.map((player, index) => (
        <View key={player.playerId} style={styles.tableRow}>
          <View style={[styles.cell, styles.playerCell]}>
            <Text style={styles.rank}>{index + 1}</Text>
            <Text style={styles.playerName}>{player.playerId}</Text>
          </View>
          <Text style={[styles.cell, styles.smallCell]}>{player.matches}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.runs}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.average.toFixed(2)}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.strikeRate.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );

  const renderBowlingStats = () => (
    <View style={styles.statsSection}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, styles.headerCell, styles.playerCell]}>Player</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>M</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>W</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>Avg</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>Econ</Text>
      </View>
      {stats?.topWicketTakers.map((player, index) => (
        <View key={player.playerId} style={styles.tableRow}>
          <View style={[styles.cell, styles.playerCell]}>
            <Text style={styles.rank}>{index + 1}</Text>
            <Text style={styles.playerName}>{player.playerId}</Text>
          </View>
          <Text style={[styles.cell, styles.smallCell]}>{player.matches}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.wickets}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.average.toFixed(2)}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.economy.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );

  const renderSixesStats = () => (
    <View style={styles.statsSection}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, styles.headerCell, styles.playerCell]}>Player</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>M</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>6s</Text>
      </View>
      {stats?.mostSixes.map((player, index) => (
        <View key={player.playerId} style={styles.tableRow}>
          <View style={[styles.cell, styles.playerCell]}>
            <Text style={styles.rank}>{index + 1}</Text>
            <Text style={styles.playerName}>{player.playerId}</Text>
          </View>
          <Text style={[styles.cell, styles.smallCell]}>{player.matches}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.sixes}</Text>
        </View>
      ))}
    </View>
  );

  if (!stats) {
    return (
      <View style={styles.container}>
        <Text>Loading stats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'batting' && styles.activeTab]}
          onPress={() => setActiveTab('batting')}
        >
          <Text style={[styles.tabText, activeTab === 'batting' && styles.activeTabText]}>
            Batting
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bowling' && styles.activeTab]}
          onPress={() => setActiveTab('bowling')}
        >
          <Text style={[styles.tabText, activeTab === 'bowling' && styles.activeTabText]}>
            Bowling
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sixes' && styles.activeTab]}
          onPress={() => setActiveTab('sixes')}
        >
          <Text style={[styles.tabText, activeTab === 'sixes' && styles.activeTabText]}>
            Most Sixes
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'batting' && renderBattingStats()}
        {activeTab === 'bowling' && renderBowlingStats()}
        {activeTab === 'sixes' && renderSixesStats()}

        <View style={styles.bestPerformances}>
          <Text style={styles.sectionTitle}>Best Performances</Text>
          
          <View style={styles.performanceCard}>
            <Text style={styles.performanceTitle}>Best Batting</Text>
            <Text style={styles.performanceText}>
              {stats.bestBattingPerformance.runs} runs off {stats.bestBattingPerformance.balls} balls
            </Text>
            <Text style={styles.performancePlayer}>
              by {stats.bestBattingPerformance.playerId}
            </Text>
          </View>

          <View style={styles.performanceCard}>
            <Text style={styles.performanceTitle}>Best Bowling</Text>
            <Text style={styles.performanceText}>
              {stats.bestBowlingPerformance.wickets}/{stats.bestBowlingPerformance.runs} in {stats.bestBowlingPerformance.overs} overs
            </Text>
            <Text style={styles.performancePlayer}>
              by {stats.bestBowlingPerformance.playerId}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF9F45',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#FF9F45',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  statsSection: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
  },
  cell: {
    paddingHorizontal: 8,
  },
  headerCell: {
    fontWeight: 'bold',
  },
  playerCell: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallCell: {
    flex: 1,
    textAlign: 'center',
  },
  rank: {
    width: 24,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  playerName: {
    fontSize: 16,
  },
  bestPerformances: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  performanceCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  performanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9F45',
    marginBottom: 4,
  },
  performancePlayer: {
    fontSize: 14,
    color: '#666',
  },
}); 