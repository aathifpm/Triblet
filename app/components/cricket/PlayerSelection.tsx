import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Player {
  id: string;
  name: string;
  skillLevel: string;
  stats: {
    matches: number;
    runs: number;
    wickets: number;
    catches: number;
    stumpings: number;
  };
}

interface PlayerSelectionProps {
  players: Player[];
  title: string;
  onSelect: (player: Player) => void;
  onClose: () => void;
  filterRole?: string;
}

export default function PlayerSelection({
  players,
  title,
  onSelect,
  onClose,
  filterRole
}: PlayerSelectionProps) {
  const filteredPlayers = filterRole
    ? players.filter(player => player.skillLevel === filterRole)
    : players;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.playerList}>
        {filteredPlayers.map((player) => (
          <TouchableOpacity
            key={player.id}
            style={styles.playerItem}
            onPress={() => onSelect(player)}
          >
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.playerRole}>{player.skillLevel}</Text>
            </View>
            <View style={styles.playerStats}>
              <Text style={styles.statItem}>M: {player.stats.matches}</Text>
              <Text style={styles.statItem}>R: {player.stats.runs}</Text>
              <Text style={styles.statItem}>W: {player.stats.wickets}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  playerList: {
    flex: 1,
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  playerRole: {
    fontSize: 14,
    color: '#666',
  },
  playerStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    fontSize: 14,
    color: '#444',
  },
}); 