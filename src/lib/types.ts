export interface MasterEvent {
  id: string;
  name: string;
  description?: string;
  createdAt?: any;
}

export interface SubEvent {
  id: string;
  masterEventId: string;
  name: string;
  status: "OPEN" | "CLOSED";
  votingMode: "sequential" | "parallel"; // Sequential (One by One) vs Parallel (All at Once)
  createdAt?: any;
}

export interface SubEventParticipant {
  id: string;
  subEventId: string;
  masterEventId: string;
  participantId: string; // Chest Number
  participantName: string;
  status: 0 | 1 | 2; // 0 = NOT STARTED / PENDING, 1 = LIVE ON STAGE, 2 = COMPLETED
  createdAt?: any;
}

export interface CurrentStage {
  masterEventId: string | number;
  subEventId: string | number;
  subEventName?: string;
  participantId: string | number; // Single Chest Number
  participantName: string;
  isVotingOpen: boolean;
  votingMode?: "sequential" | "parallel";
  showResults?: boolean;
  isGroupMode?: boolean; // Parallel mode flag
  groupParticipants?: { participantId: string; participantName: string }[];
  updatedAt?: any;
}

export interface Vote {
  id?: string;
  masterEventId?: string | number;
  subEventId: string | number;
  eventId?: string | number;
  participantId: string | number;
  voterUuid: string;
  rating: number;
  timestamp?: any;
}

export interface RatingStats {
  count: number;
  average: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ParticipantAnalytics {
  participantId: string;
  participantName: string;
  totalVotes: number;
  totalWeightedScore: number;
  averageScore: number;
  starDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  rank?: number;
}
