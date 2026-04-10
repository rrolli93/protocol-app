import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { healthKit } from '../lib/healthkit';

interface HealthKitState {
  isAvailable: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
}

interface HealthKitData {
  todaySteps: number;
  weekSteps: number;
  todayMindfulMinutes: number;
  weekMindfulMinutes: number;
  avgHrv: number;
  todayDistanceKm: number;
}

interface HealthKitActions {
  initialize: () => Promise<boolean>;
  getSteps: (startDate: Date, endDate: Date) => Promise<number>;
  getMindfulMinutes: (startDate: Date, endDate: Date) => Promise<number>;
  getHrv: (startDate: Date, endDate: Date) => Promise<number>;
  getRunDistance: (startDate: Date, endDate: Date) => Promise<number>;
  refreshData: () => Promise<void>;
}

export type UseHealthKitReturn = HealthKitState & HealthKitData & HealthKitActions;

export function useHealthKit(): UseHealthKitReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [todaySteps, setTodaySteps] = useState(0);
  const [weekSteps, setWeekSteps] = useState(0);
  const [todayMindfulMinutes, setTodayMindfulMinutes] = useState(0);
  const [weekMindfulMinutes, setWeekMindfulMinutes] = useState(0);
  const [avgHrv, setAvgHrv] = useState(0);
  const [todayDistanceKm, setTodayDistanceKm] = useState(0);

  const isAvailable = Platform.OS === 'ios';

  const initialize = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    setIsLoading(true);
    setError(null);

    try {
      const result = await healthKit.initialize();
      setIsInitialized(result);
      return result;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  const getSteps = useCallback(
    async (startDate: Date, endDate: Date): Promise<number> => {
      if (!isInitialized) return 0;
      try {
        return await healthKit.getStepCount(startDate, endDate);
      } catch (err) {
        console.error('[useHealthKit] getSteps error:', err);
        return 0;
      }
    },
    [isInitialized]
  );

  const getMindfulMinutes = useCallback(
    async (startDate: Date, endDate: Date): Promise<number> => {
      if (!isInitialized) return 0;
      try {
        return await healthKit.getMindfulMinutes(startDate, endDate);
      } catch (err) {
        console.error('[useHealthKit] getMindfulMinutes error:', err);
        return 0;
      }
    },
    [isInitialized]
  );

  const getHrv = useCallback(
    async (startDate: Date, endDate: Date): Promise<number> => {
      if (!isInitialized) return 0;
      try {
        return await healthKit.getAverageHRV(startDate, endDate);
      } catch (err) {
        console.error('[useHealthKit] getHrv error:', err);
        return 0;
      }
    },
    [isInitialized]
  );

  const getRunDistance = useCallback(
    async (startDate: Date, endDate: Date): Promise<number> => {
      if (!isInitialized) return 0;
      try {
        return await healthKit.getWalkingRunningDistance(startDate, endDate);
      } catch (err) {
        console.error('[useHealthKit] getRunDistance error:', err);
        return 0;
      }
    },
    [isInitialized]
  );

  const refreshData = useCallback(async () => {
    if (!isInitialized) return;

    setIsLoading(true);
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    try {
      const [steps, wSteps, mindful, wMindful, hrv, distance] = await Promise.all([
        healthKit.getStepCount(startOfToday, now),
        healthKit.getStepCount(weekAgo, now),
        healthKit.getMindfulMinutes(startOfToday, now),
        healthKit.getMindfulMinutes(weekAgo, now),
        healthKit.getAverageHRV(weekAgo, now),
        healthKit.getWalkingRunningDistance(startOfToday, now),
      ]);

      setTodaySteps(steps);
      setWeekSteps(wSteps);
      setTodayMindfulMinutes(mindful);
      setWeekMindfulMinutes(wMindful);
      setAvgHrv(hrv);
      setTodayDistanceKm(Math.round(distance * 100) / 100);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  useEffect(() => {
    if (isAvailable) {
      initialize().then((ok) => {
        if (ok) refreshData();
      });
    }
  }, []);

  return {
    isAvailable,
    isInitialized,
    isLoading,
    error,
    todaySteps,
    weekSteps,
    todayMindfulMinutes,
    weekMindfulMinutes,
    avgHrv,
    todayDistanceKm,
    initialize,
    getSteps,
    getMindfulMinutes,
    getHrv,
    getRunDistance,
    refreshData,
  };
}
