import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getFirestore, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { CricketMatch, PlayerInnings, BallByBall } from '../../types/cricket';

interface MatchSummaryProps {
  match: CricketMatch;
}

interface TeamInnings {
  battingStats: PlayerInnings[];
  bowlingStats: PlayerInnings[];
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
  };
  total: number;
  wickets: number;
  overs: number;
}

export default function MatchSummary({ match }: MatchSummaryProps) {
  const [activeTab, setActiveTab] = useState<'scorecard' | 'commentary'>('scorecard');
  const [firstInnings, setFirstInnings] = useState<TeamInnings | null>(null);
  const [secondInnings, setSecondInnings] = useState<TeamInnings | null>(null);
  const [commentary, setCommentary] = useState<BallByBall[]>([]);
  const db = getFirestore();

  useEffect(() => {
    loadMatchData();
  }, [match.id]);

  const loadMatchData = async () => {
    try {
      // Load player innings
      const inningsQuery = query(
        collection(db, 'playerInnings'),
        where('matchId', '==', match.id)
      );
      const inningsSnapshot = await getDocs(inningsQuery);
      const allInnings: PlayerInnings[] = [];
      inningsSnapshot.forEach((doc) => {
        allInnings.push({ id: doc.id, ...doc.data() } as PlayerInnings);
      });

      // Load ball-by-ball commentary
      const commentaryQuery = query(
        collection(db, 'ballByBall'),
        where('matchId', '==', match.id),
        orderBy('timestamp', 'desc')
      );
      const commentarySnapshot = await getDocs(commentaryQuery);
      const ballByBall: BallByBall[] = [];
      commentarySnapshot.forEach((doc) => {
        ballByBall.push({ id: doc.id, ...doc.data() } as BallByBall);
      });

      // Organize innings data
      const first: TeamInnings = {
        battingStats: allInnings.filter(i => i.teamId === match.firstInningsTeam),
        bowlingStats: allInnings.filter(i => i.teamId !== match.firstInningsTeam),
        extras: match.firstInningsExtras,
        total: match.firstInningsScore,
        wickets: match.firstInningsWickets,
        overs: match.firstInningsOvers
      };

      const second: TeamInnings = match.secondInningsTeam ? {
        battingStats: allInnings.filter(i => i.teamId === match.secondInningsTeam),
        bowlingStats: allInnings.filter(i => i.teamId !== match.secondInningsTeam),
        extras: match.secondInningsExtras,
        total: match.secondInningsScore,
        wickets: match.secondInningsWickets,
        overs: match.secondInningsOvers
      } : null;

      setFirstInnings(first);
      setSecondInnings(second);
      setCommentary(ballByBall);
    } catch (error) {
      console.error('Error loading match data:', error);
    }
  };

  const renderBattingCard = (innings: TeamInnings) => (
    <View style={styles.inningsSection}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, styles.headerCell, styles.batsmanCell]}>Batsman</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>R</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>B</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>4s</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>6s</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>SR</Text>
      </View>
      {innings.battingStats.map((player) => (
        <View key={player.id} style={styles.tableRow}>
          <View style={[styles.cell, styles.batsmanCell]}>
            <Text style={styles.playerName}>{player.id}</Text>
            <Text style={styles.dismissalInfo}>
              {player.battingStats.dismissalType?.toLowerCase()}
              {player.battingStats.dismissalBowler ? ` b ${player.battingStats.dismissalBowler}` : ''}
            </Text>
          </View>
          <Text style={[styles.cell, styles.smallCell]}>{player.battingStats.runs}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.battingStats.balls}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.battingStats.fours}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.battingStats.sixes}</Text>
          <Text style={[styles.cell, styles.smallCell]}>
            {player.battingStats.strikeRate.toFixed(2)}
          </Text>
        </View>
      ))}
      <View style={styles.extrasRow}>
        <Text style={styles.extrasLabel}>Extras</Text>
        <Text style={styles.extrasValue}>
          {innings.extras.wides + innings.extras.noBalls + innings.extras.byes + innings.extras.legByes}
          {' '}(w {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb {innings.extras.legByes})
        </Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>
          {innings.total}/{innings.wickets} ({innings.overs} Ov)
        </Text>
      </View>
    </View>
  );

  const renderBowlingCard = (innings: TeamInnings) => (
    <View style={styles.inningsSection}>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, styles.headerCell, styles.bowlerCell]}>Bowler</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>O</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>M</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>R</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>W</Text>
        <Text style={[styles.cell, styles.headerCell, styles.smallCell]}>Econ</Text>
      </View>
      {innings.bowlingStats.map((player) => (
        <View key={player.id} style={styles.tableRow}>
          <Text style={[styles.cell, styles.bowlerCell]}>{player.id}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.bowlingStats.overs}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.bowlingStats.maidens}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.bowlingStats.runs}</Text>
          <Text style={[styles.cell, styles.smallCell]}>{player.bowlingStats.wickets}</Text>
          <Text style={[styles.cell, styles.smallCell]}>
            {player.bowlingStats.economy.toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderCommentary = () => (
    <View style={styles.commentaryContainer}>
      {commentary.map((ball) => (
        <View key={ball.id} style={styles.commentaryItem}>
          <View style={styles.overBall}>
            <Text style={styles.overText}>{ball.over}.{ball.ball}</Text>
          </View>
          <View style={styles.commentaryContent}>
            <Text style={styles.commentaryText}>{ball.commentary}</Text>
            <Text style={styles.commentaryDetails}>
              {ball.isWicket ? 'WICKET! ' : ''}
              {ball.runs} {ball.runs === 1 ? 'run' : 'runs'}
              {ball.isExtra ? ` (${ball.extraType})` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scorecard' && styles.activeTab]}
          onPress={() => setActiveTab('scorecard')}
        >
          <Text style={[styles.tabText, activeTab === 'scorecard' && styles.activeTabText]}>
            Scorecard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'commentary' && styles.activeTab]}
          onPress={() => setActiveTab('commentary')}
        >
          <Text style={[styles.tabText, activeTab === 'commentary' && styles.activeTabText]}>
            Commentary
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'scorecard' ? (
          <>
            {firstInnings && (
              <View style={styles.innings}>
                <Text style={styles.inningsHeader}>1st Innings</Text>
                {renderBattingCard(firstInnings)}
                {renderBowlingCard(firstInnings)}
              </View>
            )}
            {secondInnings && (
              <View style={styles.innings}>
                <Text style={styles.inningsHeader}>2nd Innings</Text>
                {renderBattingCard(secondInnings)}
                {renderBowlingCard(secondInnings)}
              </View>
            )}
          </>
        ) : (
          renderCommentary()
        )}
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
  innings: {
    marginBottom: 20,
  },
  inningsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  inningsSection: {
    marginBottom: 16,
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
  batsmanCell: {
    flex: 2,
  },
  bowlerCell: {
    flex: 2,
  },
  smallCell: {
    flex: 1,
    textAlign: 'center',
  },
  playerName: {
    fontSize: 16,
  },
  dismissalInfo: {
    fontSize: 12,
    color: '#666',
  },
  extrasRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  extrasLabel: {
    flex: 1,
    fontWeight: '500',
  },
  extrasValue: {
    flex: 2,
  },
  totalRow: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f5f5f5',
  },
  totalLabel: {
    flex: 1,
    fontWeight: 'bold',
  },
  totalValue: {
    flex: 2,
    fontWeight: 'bold',
  },
  commentaryContainer: {
    padding: 16,
  },
  commentaryItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  overBall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  overText: {
    fontSize: 14,
    fontWeight: '500',
  },
  commentaryContent: {
    flex: 1,
  },
  commentaryText: {
    fontSize: 16,
    marginBottom: 4,
  },
  commentaryDetails: {
    fontSize: 14,
    color: '#666',
  },
}); 