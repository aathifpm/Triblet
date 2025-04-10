export enum DismissalType {
  BOWLED = 'BOWLED',
  CAUGHT = 'CAUGHT',
  RUN_OUT = 'RUN_OUT',
  LBW = 'LBW',
  STUMPED = 'STUMPED'
}

export enum ExtraType {
  WIDE = 'WIDE',
  NO_BALL = 'NO_BALL',
  BYE = 'BYE',
  LEG_BYE = 'LEG_BYE'
}

export enum MatchStatus {
  UPCOMING = 'UPCOMING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED'
}

export interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

export interface CricketMatch {
  id: string;
  tournamentId: string;
  team1Id: string;
  team2Id: string;
  date: Date;
  venue: string;
  tossWinner: string;
  battingFirst: string;
  status: MatchStatus;
  currentInnings: 1 | 2;
  result?: string;
  
  // First Innings
  firstInningsTeam: string;
  firstInningsScore: number;
  firstInningsWickets: number;
  firstInningsOvers: number;
  firstInningsExtras: Extras;

  // Second Innings
  secondInningsTeam: string;
  secondInningsScore: number;
  secondInningsWickets: number;
  secondInningsOvers: number;
  secondInningsExtras: Extras;

  // Current state
  currentBatsmen: {
    striker: string;
    nonStriker: string;
  };
  currentBowler: string;
  currentOver: number;
  ballsInOver: number;
  requiredRunRate?: number;
  requiredRuns?: number;
}

export interface BattingStats {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dismissalType?: DismissalType;
  dismissalBowler?: string;
  dismissalFielder?: string;
}

export interface BowlingStats {
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
}

export interface FieldingStats {
  catches: number;
  runOuts: number;
  stumpings: number;
}

export interface PlayerInnings {
  id: string;
  matchId: string;
  playerId: string;
  teamId: string;
  battingStats: BattingStats;
  bowlingStats: BowlingStats;
  fieldingStats: FieldingStats;
}

export interface BallByBall {
  id: string;
  matchId: string;
  inningsNumber: 1 | 2;
  over: number;
  ball: number;
  batsmanId: string;
  bowlerId: string;
  runs: number;
  isExtra: boolean;
  extraType?: ExtraType;
  extraRuns: number;
  isWicket: boolean;
  wicketType?: DismissalType;
  dismissedPlayerId?: string;
  fielderIds?: string[];
  timestamp: Date;
  commentary: string;
}

export interface PlayerTournamentStats {
  playerId: string;
  runs: number;
  matches: number;
  average: number;
  strikeRate: number;
}

export interface BowlerTournamentStats {
  playerId: string;
  wickets: number;
  matches: number;
  average: number;
  economy: number;
}

export interface SixHitterStats {
  playerId: string;
  sixes: number;
  matches: number;
}

export interface BestBattingPerformance {
  playerId: string;
  runs: number;
  balls: number;
  matchId: string;
}

export interface BestBowlingPerformance {
  playerId: string;
  wickets: number;
  runs: number;
  overs: number;
  matchId: string;
}

export interface TournamentStats {
  id: string;
  tournamentId: string;
  topScorers: PlayerTournamentStats[];
  topWicketTakers: BowlerTournamentStats[];
  mostSixes: SixHitterStats[];
  bestBattingPerformance: BestBattingPerformance;
  bestBowlingPerformance: BestBowlingPerformance;
} 