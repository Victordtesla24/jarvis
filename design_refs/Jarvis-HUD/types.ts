export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isAudio?: boolean;
}

export interface SystemMetric {
  id: string;
  label: string;
  value: number;
  max: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

export enum JarvisMode {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  SPEAKING = 'SPEAKING',
  ANALYZING = 'ANALYZING'
}
