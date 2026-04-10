import AppleHealthKit, {
  HealthKitPermissions,
  HealthValue,
  HealthInputOptions,
} from 'react-native-health';
import { Platform } from 'react-native';

export interface HealthKitStepsResult {
  value: number;
  startDate: string;
  endDate: string;
}

export interface HealthKitSleepResult {
  value: number;
  startDate: string;
  endDate: string;
  sourceId: string;
  sourceName: string;
}

export interface HealthKitMindfulResult {
  value: number;
  startDate: string;
  endDate: string;
}

export interface HealthKitHRVResult {
  value: number;
  startDate: string;
  endDate: string;
}

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.MindfulSession,
      AppleHealthKit.Constants.Permissions.HeartRateVariability,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.DistanceCycling,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.MindfulSession,
    ],
  },
};

class HealthKitService {
  private initialized = false;

  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS, (error) => {
        if (error) {
          console.error('[HealthKit] Init error:', error);
          resolve(false);
        } else {
          this.initialized = true;
          resolve(true);
        }
      });
    });
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('HealthKit not initialized. Call initialize() first.');
    }
  }

  async getStepCount(startDate: Date, endDate: Date): Promise<number> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        includeManuallyAdded: false,
      };

      AppleHealthKit.getStepCount(options, (err, results: HealthValue) => {
        if (err) reject(err);
        else resolve(results.value ?? 0);
      });
    });
  }

  async getDailySteps(
    startDate: Date,
    endDate: Date
  ): Promise<HealthKitStepsResult[]> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        includeManuallyAdded: false,
      };

      AppleHealthKit.getDailyStepCountSamples(
        options,
        (err, results: HealthValue[]) => {
          if (err) reject(err);
          else
            resolve(
              (results ?? []).map((r) => ({
                value: r.value,
                startDate: r.startDate,
                endDate: r.endDate,
              }))
            );
        }
      );
    });
  }

  async getSleepSamples(
    startDate: Date,
    endDate: Date
  ): Promise<HealthKitSleepResult[]> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.getSleepSamples(options, (err, results) => {
        if (err) reject(err);
        else {
          const samples = (results ?? []).map((r: any) => ({
            value: r.value,
            startDate: r.startDate,
            endDate: r.endDate,
            sourceId: r.sourceId ?? '',
            sourceName: r.sourceName ?? '',
          }));
          resolve(samples);
        }
      });
    });
  }

  async getMindfulMinutes(startDate: Date, endDate: Date): Promise<number> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      AppleHealthKit.getMindfulSession(options, (err, results) => {
        if (err) reject(err);
        else {
          const totalMinutes = (results ?? []).reduce((acc: number, r: any) => {
            const start = new Date(r.startDate).getTime();
            const end = new Date(r.endDate).getTime();
            const minutes = (end - start) / 1000 / 60;
            return acc + minutes;
          }, 0);
          resolve(Math.round(totalMinutes));
        }
      });
    });
  }

  async getHRVSamples(
    startDate: Date,
    endDate: Date
  ): Promise<HealthKitHRVResult[]> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ascending: false,
        limit: 100,
      };

      AppleHealthKit.getHeartRateVariabilitySamples(
        options,
        (err, results: HealthValue[]) => {
          if (err) reject(err);
          else
            resolve(
              (results ?? []).map((r) => ({
                value: r.value * 1000, // convert s to ms
                startDate: r.startDate,
                endDate: r.endDate,
              }))
            );
        }
      );
    });
  }

  async getAverageHRV(startDate: Date, endDate: Date): Promise<number> {
    const samples = await this.getHRVSamples(startDate, endDate);
    if (samples.length === 0) return 0;
    const sum = samples.reduce((acc, s) => acc + s.value, 0);
    return Math.round(sum / samples.length);
  }

  async getWalkingRunningDistance(
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        unit: 'kilometer',
      };

      AppleHealthKit.getDistanceWalkingRunning(
        options,
        (err, results: HealthValue) => {
          if (err) reject(err);
          else resolve(results.value ?? 0);
        }
      );
    });
  }

  isAvailable(): boolean {
    return Platform.OS === 'ios';
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const healthKit = new HealthKitService();
