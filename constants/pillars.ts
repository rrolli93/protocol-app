export type DataSource = 'strava' | 'healthkit' | 'oura' | 'whoop' | 'internal';

export interface Pillar {
  id: string;
  name: string;
  icon: string;
  color: string;
  accentColor: string;
  unit: string;
  unitLabel: string;
  description: string;
  dataSource: DataSource[];
  goalMin: number;
  goalMax: number;
  goalStep: number;
  goalDefault: number;
}

export const PILLARS: Pillar[] = [
  {
    id: 'run',
    name: 'RUN',
    icon: '🏃',
    color: '#FF6B35',
    accentColor: 'rgba(255, 107, 53, 0.15)',
    unit: 'km',
    unitLabel: 'kilometers',
    description: 'Total distance run tracked via GPS',
    dataSource: ['strava', 'healthkit'],
    goalMin: 5,
    goalMax: 500,
    goalStep: 5,
    goalDefault: 50,
  },
  {
    id: 'cycle',
    name: 'CYCLE',
    icon: '🚴',
    color: '#F59E0B',
    accentColor: 'rgba(245, 158, 11, 0.15)',
    unit: 'km',
    unitLabel: 'kilometers',
    description: 'Total cycling distance via Strava',
    dataSource: ['strava', 'healthkit'],
    goalMin: 10,
    goalMax: 1000,
    goalStep: 10,
    goalDefault: 100,
  },
  {
    id: 'walk',
    name: 'WALK',
    icon: '🚶',
    color: '#10B981',
    accentColor: 'rgba(16, 185, 129, 0.15)',
    unit: 'steps',
    unitLabel: 'steps',
    description: 'Total steps tracked via HealthKit or Strava',
    dataSource: ['healthkit', 'strava'],
    goalMin: 10000,
    goalMax: 500000,
    goalStep: 5000,
    goalDefault: 100000,
  },
  {
    id: 'sleep',
    name: 'SLEEP',
    icon: '😴',
    color: '#6C63FF',
    accentColor: 'rgba(108, 99, 255, 0.15)',
    unit: 'score',
    unitLabel: 'avg score (0–100)',
    description: 'Average nightly sleep score',
    dataSource: ['oura', 'whoop'],
    goalMin: 60,
    goalMax: 100,
    goalStep: 1,
    goalDefault: 85,
  },
  {
    id: 'fast',
    name: 'FAST',
    icon: '⚡',
    color: '#EC4899',
    accentColor: 'rgba(236, 72, 153, 0.15)',
    unit: 'hrs',
    unitLabel: 'total fasting hours',
    description: 'Total fasting hours via in-app timer',
    dataSource: ['internal'],
    goalMin: 16,
    goalMax: 500,
    goalStep: 8,
    goalDefault: 112,
  },
  {
    id: 'meditate',
    name: 'MEDITATE',
    icon: '🧘',
    color: '#8B5CF6',
    accentColor: 'rgba(139, 92, 246, 0.15)',
    unit: 'min',
    unitLabel: 'mindful minutes',
    description: 'Total mindful minutes via HealthKit',
    dataSource: ['healthkit'],
    goalMin: 30,
    goalMax: 1000,
    goalStep: 10,
    goalDefault: 300,
  },
  {
    id: 'hrv',
    name: 'HRV',
    icon: '💓',
    color: '#EF4444',
    accentColor: 'rgba(239, 68, 68, 0.15)',
    unit: 'ms',
    unitLabel: 'avg HRV (ms)',
    description: 'Average nightly heart rate variability',
    dataSource: ['oura', 'whoop'],
    goalMin: 20,
    goalMax: 200,
    goalStep: 5,
    goalDefault: 60,
  },
  {
    id: 'readiness',
    name: 'READINESS',
    icon: '⚡',
    color: '#00D4AA',
    accentColor: 'rgba(0, 212, 170, 0.15)',
    unit: 'score',
    unitLabel: 'avg readiness (0–100)',
    description: 'Average daily readiness score',
    dataSource: ['oura', 'whoop'],
    goalMin: 50,
    goalMax: 100,
    goalStep: 1,
    goalDefault: 80,
  },
];

export const getPillarById = (id: string): Pillar | undefined =>
  PILLARS.find((p) => p.id === id);

export const getPillarColor = (id: string): string =>
  getPillarById(id)?.color ?? '#6C63FF';
