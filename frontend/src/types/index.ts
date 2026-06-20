export interface CanFrame {
  id: string;
  timestamp: number;
  arbitrationId: number;
  dlc: number;
  data: string;
  decoded: Record<string, number>;
  direction: 'RX' | 'TX';
}

export interface DbcSignal {
  name: string;
  startBit: number;
  bitLength: number;
  factor: number;
  offset: number;
  unit: string;
  minValue: number;
  maxValue: number;
  messageId: number;
}

export interface DbcMessage {
  id: number;
  name: string;
  dlc: number;
  sender: string;
  signals: DbcSignal[];
}

export interface BusStats {
  totalFrames: number;
  rxCount: number;
  txCount: number;
  errorCount: number;
  busLoad: number;
  lastUpdate: number;
}

export type CollectionStage = 'recent' | 'midterm' | 'longterm';

export interface SignalHealthMetrics {
  fluctuation: number;
  overLimitCount: number;
  abnormalDuration: number;
  averageValue: number;
  maxValue: number;
  minValue: number;
  sampleCount: number;
}

export interface SignalHealthScore {
  signalName: string;
  unit: string;
  overallScore: number;
  riskLevel: 'healthy' | 'warning' | 'critical';
  stages: Record<CollectionStage, SignalHealthMetrics>;
  currentValue: number;
  lastUpdate: number;
}

export interface HealthSummary {
  totalSignals: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  averageScore: number;
  topRisks: SignalHealthScore[];
}
