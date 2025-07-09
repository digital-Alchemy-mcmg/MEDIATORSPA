
export enum DebatePhase {
  Setup = 'SETUP',
  InProgress = 'IN_PROGRESS',
  Finished = 'FINISHED',
}

export enum Role {
  For = 'FOR',
  Against = 'AGAINST',
  Moderator = 'MODERATOR',
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  analysis?: AiTurnResponse;
}

export interface Score {
  points: number;
  reason: string;
}

export interface PlayerStats {
  score: number;
  bestQuote: string | null;
  fallacyWarnings: number;
}

export interface Scores {
  [Role.For]: PlayerStats;
  [Role.Against]: PlayerStats;
}

export interface Turn {
  role: Role;
  round: number;
  type: 'Opening' | 'Rebuttal' | 'Closing';
}

export interface AiTurnResponse {
  summary: string;
  analysis: string;
  scores: Score[];
  fallacyWarning: string | null;
  bestQuoteCandidate: string | null;
}

export interface LensScore {
  logic: number;
  contextual: number;
  abstract: number;
}

export interface FinalReportData {
  winner: Role | 'TIE';
  winnerJustification: string;
  finalScores: {
    [Role.For]: number;
    [Role.Against]: number;
  };
  bestQuotes: {
    [Role.For]: string | null;
    [Role.Against]: string | null;
  };
  lensScores: {
    [Role.For]: LensScore;
    [Role.Against]: LensScore;
  };
}
