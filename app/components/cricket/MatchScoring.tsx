import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getFirestore, doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import {
  CricketMatch,
  DismissalType,
  ExtraType,
  BallByBall,
  PlayerInnings
} from '../../types/cricket';

interface MatchScoringProps {
  match: CricketMatch;
  onUpdateMatch: (match: CricketMatch) => void;
}

export default function MatchScoring({ match, onUpdateMatch }: MatchScoringProps) {
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showBowlerModal, setShowBowlerModal] = useState(false);
  const db = getFirestore();

  const getCurrentInningsDetails = () => {
    if (match.currentInnings === 1) {
      return {
        battingTeam: match.firstInningsTeam,
        score: match.firstInningsScore,
        wickets: match.firstInningsWickets,
        overs: match.firstInningsOvers,
        extras: match.firstInningsExtras
      };
    } else {
      return {
        battingTeam: match.secondInningsTeam,
        score: match.secondInningsScore,
        wickets: match.secondInningsWickets,
        overs: match.secondInningsOvers,
        extras: match.secondInningsExtras
      };
    }
  };

  const updateScore = async (runs: number, isExtra: boolean = false, extraType?: ExtraType) => {
    const inningsDetails = getCurrentInningsDetails();
    const updatedMatch = { ...match };
    
    // Update score
    if (match.currentInnings === 1) {
      updatedMatch.firstInningsScore += runs;
      if (extraType === ExtraType.WIDE) {
        updatedMatch.firstInningsExtras.wides += 1;
      } else if (extraType === ExtraType.NO_BALL) {
        updatedMatch.firstInningsExtras.noBalls += 1;
      }
    } else {
      updatedMatch.secondInningsScore += runs;
      if (extraType === ExtraType.WIDE) {
        updatedMatch.secondInningsExtras.wides += 1;
      } else if (extraType === ExtraType.NO_BALL) {
        updatedMatch.secondInningsExtras.noBalls += 1;
      }
    }

    // If not an extra, increment the ball count
    if (!isExtra) {
      updatedMatch.ballsInOver++;
      if (updatedMatch.ballsInOver === 6) {
        updatedMatch.currentOver++;
        updatedMatch.ballsInOver = 0;
        setShowBowlerModal(true);
      }
    }

    // Update required runs and run rate for second innings
    if (match.currentInnings === 2) {
      const remainingBalls = (20 * 6) - ((updatedMatch.currentOver * 6) + updatedMatch.ballsInOver);
      updatedMatch.requiredRuns = (match.firstInningsScore + 1) - updatedMatch.secondInningsScore;
      updatedMatch.requiredRunRate = (updatedMatch.requiredRuns * 6) / remainingBalls;
    }

    // Record ball-by-ball
    const ballByBall: BallByBall = {
      id: Math.random().toString(36).substr(2, 9), // temporary ID generation
      matchId: match.id,
      inningsNumber: match.currentInnings,
      over: updatedMatch.currentOver,
      ball: updatedMatch.ballsInOver,
      batsmanId: match.currentBatsmen.striker,
      bowlerId: match.currentBowler,
      runs: runs,
      isExtra: isExtra,
      extraType: extraType,
      extraRuns: isExtra ? 1 : 0,
      isWicket: false,
      timestamp: new Date(),
      commentary: generateCommentary(runs, isExtra, extraType)
    };

    // Save ball-by-ball to Firestore
    await addDoc(collection(db, 'ballByBall'), ballByBall);

    // Update match in Firestore
    await updateDoc(doc(db, 'matches', match.id), updatedMatch);

    // Update UI
    onUpdateMatch(updatedMatch);
  };

  const handleWicket = async (wicketType: DismissalType) => {
    const updatedMatch = { ...match };
    
    if (match.currentInnings === 1) {
      updatedMatch.firstInningsWickets++;
    } else {
      updatedMatch.secondInningsWickets++;
    }

    // Record ball-by-ball for wicket
    const ballByBall: BallByBall = {
      id: Math.random().toString(36).substr(2, 9),
      matchId: match.id,
      inningsNumber: match.currentInnings,
      over: updatedMatch.currentOver,
      ball: updatedMatch.ballsInOver,
      batsmanId: match.currentBatsmen.striker,
      bowlerId: match.currentBowler,
      runs: 0,
      isExtra: false,
      isWicket: true,
      wicketType: wicketType,
      dismissedPlayerId: match.currentBatsmen.striker,
      timestamp: new Date(),
      commentary: generateWicketCommentary(wicketType)
    };

    await addDoc(collection(db, 'ballByBall'), ballByBall);
    
    // Update bowler's stats
    const bowlerInnings = await getBowlerInnings();
    if (bowlerInnings) {
      bowlerInnings.bowlingStats.wickets++;
      await updateDoc(doc(db, 'playerInnings', bowlerInnings.id), bowlerInnings);
    }

    updatedMatch.ballsInOver++;
    if (updatedMatch.ballsInOver === 6) {
      updatedMatch.currentOver++;
      updatedMatch.ballsInOver = 0;
      setShowBowlerModal(true);
    }

    setShowPlayerModal(true); // To select next batsman
    await updateDoc(doc(db, 'matches', match.id), updatedMatch);
    onUpdateMatch(updatedMatch);
  };

  const getBowlerInnings = async () => {
    // Implementation to get or create bowler's innings record
    // This would fetch from playerInnings collection or create new if not exists
    return null; // Placeholder
  };

  const generateCommentary = (runs: number, isExtra: boolean, extraType?: ExtraType): string => {
    if (isExtra) {
      if (extraType === ExtraType.WIDE) return "Wide ball";
      if (extraType === ExtraType.NO_BALL) return "No ball";
      return "Extra";
    }
    if (runs === 4) return "FOUR! Beautiful shot!";
    if (runs === 6) return "SIX! That's gone all the way!";
    return `${runs} run${runs !== 1 ? 's' : ''}`;
  };

  const generateWicketCommentary = (wicketType: DismissalType): string => {
    switch (wicketType) {
      case DismissalType.BOWLED:
        return "WICKET! Clean bowled!";
      case DismissalType.CAUGHT:
        return "WICKET! Caught!";
      case DismissalType.RUN_OUT:
        return "WICKET! Run out!";
      case DismissalType.LBW:
        return "WICKET! LBW!";
      case DismissalType.STUMPED:
        return "WICKET! Stumped!";
      default:
        return "WICKET!";
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.scoreContainer}>
        <Text style={styles.score}>
          {getCurrentInningsDetails().score}/{getCurrentInningsDetails().wickets}
        </Text>
        <Text style={styles.overs}>
          {match.currentOver}.{match.ballsInOver} overs
        </Text>
        {match.currentInnings === 2 && (
          <Text style={styles.target}>
            Need {match.requiredRuns} runs from {(20 * 6) - ((match.currentOver * 6) + match.ballsInOver)} balls
            (RR: {match.requiredRunRate?.toFixed(2)})
          </Text>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.runButton}
          onPress={() => updateScore(1)}
        >
          <Text style={styles.buttonText}>1</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.runButton}
          onPress={() => updateScore(2)}
        >
          <Text style={styles.buttonText}>2</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.runButton}
          onPress={() => updateScore(4)}
        >
          <Text style={styles.buttonText}>4</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.runButton}
          onPress={() => updateScore(6)}
        >
          <Text style={styles.buttonText}>6</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.wicketButton}
          onPress={() => setShowWicketModal(true)}
        >
          <Text style={styles.buttonText}>W</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.extraButton}
          onPress={() => updateScore(1, true, ExtraType.WIDE)}
        >
          <Text style={styles.buttonText}>Wd</Text>
        </TouchableOpacity>
      </View>

      {/* Wicket Modal */}
      <Modal
        visible={showWicketModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Wicket Type</Text>
            {Object.values(DismissalType).map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.modalButton}
                onPress={() => {
                  handleWicket(type);
                  setShowWicketModal(false);
                }}
              >
                <Text style={styles.modalButtonText}>{type}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowWicketModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Player Selection Modal */}
      <Modal
        visible={showPlayerModal}
        transparent={true}
        animationType="slide"
      >
        {/* Implementation for player selection */}
      </Modal>

      {/* Bowler Selection Modal */}
      <Modal
        visible={showBowlerModal}
        transparent={true}
        animationType="slide"
      >
        {/* Implementation for bowler selection */}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  score: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  overs: {
    fontSize: 18,
    color: '#666',
  },
  target: {
    fontSize: 16,
    color: '#444',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  runButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wicketButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  extraButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 5,
    marginVertical: 5,
  },
  modalButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
  modalCloseButton: {
    backgroundColor: '#666',
    padding: 12,
    borderRadius: 5,
    marginTop: 10,
  },
  modalCloseButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
}); 