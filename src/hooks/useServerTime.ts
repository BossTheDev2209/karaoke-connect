import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to synchronize local time with Supabase server time.
 * 
 * The offset is calculated as: serverTime - localTime
 * Room time (synchronized time) = Date.now() + offset
 * 
 * Re-calibrates every 30 seconds to prevent clock drift.
 */

interface UseServerTimeReturn {
  /** Offset in milliseconds: serverTime - localTime */
  offset: number;
  /** Whether initial calibration is complete */
  isCalibrated: boolean;
  /** Get the current "room time" (synchronized with server) */
  getRoomTime: () => number;
  /** Manually trigger recalibration */
  calibrate: () => Promise<void>;
  /** Network round-trip time from last calibration */
  lastRtt: number;
}

const CALIBRATION_INTERVAL_MS = 30000; // 30 seconds
const CALIBRATION_SAMPLES = 3; // Take 3 samples and use median

export function useServerTime(): UseServerTimeReturn {
  const [offset, setOffset] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [lastRtt, setLastRtt] = useState(0);
  
  const calibrationIntervalRef = useRef<number | null>(null);

  /**
   * Perform a single time measurement.
   * Returns { offset, rtt } or null on error.
   */
  const measureOnce = async (): Promise<{ offset: number; rtt: number } | null> => {
    try {
      const t0 = Date.now();
      const { data, error } = await (supabase as any).rpc('get_server_time');
      const t1 = Date.now();
      
      if (error || !data) {
        console.error('[ServerTime] Failed to get server time:', error);
        return null;
      }
      
      const rtt = t1 - t0;
      // Estimate server time at moment of response (t1) by adding half RTT
      const serverTimeAtT1 = new Date(data).getTime() + rtt / 2;
      const measuredOffset = serverTimeAtT1 - t1;
      
      return { offset: measuredOffset, rtt };
    } catch (err) {
      console.error('[ServerTime] Calibration error:', err);
      return null;
    }
  };

  /**
   * Calibrate by taking multiple samples and using the median offset.
   * This reduces impact of network jitter.
   */
  const calibrate = useCallback(async () => {
    const samples: { offset: number; rtt: number }[] = [];
    
    for (let i = 0; i < CALIBRATION_SAMPLES; i++) {
      const result = await measureOnce();
      if (result) {
        samples.push(result);
      }
      // Small delay between samples
      if (i < CALIBRATION_SAMPLES - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (samples.length === 0) {
      console.warn('[ServerTime] All calibration samples failed');
      return;
    }
    
    // Use median offset (most robust to outliers)
    samples.sort((a, b) => a.offset - b.offset);
    const medianIndex = Math.floor(samples.length / 2);
    const medianSample = samples[medianIndex];
    
    setOffset(medianSample.offset);
    setLastRtt(medianSample.rtt);
    setIsCalibrated(true);
    
    console.log(`[ServerTime] Calibrated: offset=${medianSample.offset}ms, RTT=${medianSample.rtt}ms`);
  }, []);

  /**
   * Get the current "room time" which is synchronized across all clients.
   */
  const getRoomTime = useCallback(() => {
    return Date.now() + offset;
  }, [offset]);

  // Initial calibration and periodic recalibration
  useEffect(() => {
    // Initial calibration
    calibrate();
    
    // Re-calibrate periodically to handle clock drift
    calibrationIntervalRef.current = window.setInterval(() => {
      calibrate();
    }, CALIBRATION_INTERVAL_MS);
    
    return () => {
      if (calibrationIntervalRef.current) {
        clearInterval(calibrationIntervalRef.current);
      }
    };
  }, [calibrate]);

  return {
    offset,
    isCalibrated,
    getRoomTime,
    calibrate,
    lastRtt,
  };
}
