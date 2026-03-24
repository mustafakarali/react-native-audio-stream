import { useState, useEffect, useRef } from 'react';
import { AudioStream } from '../AudioStream';
import type { PlaybackStats } from '../types';

export interface UseStreamProgressOptions {
  /** Update interval in milliseconds. @default 250 */
  interval?: number;
  /** Whether progress tracking is enabled. @default true */
  enabled?: boolean;
}

export interface StreamProgress {
  /** Current playback time in seconds. */
  currentTime: number;
  /** Total duration in seconds (0 for live streams). */
  duration: number;
  /** Playback progress percentage (0–100). */
  percentage: number;
  /** Latest playback stats from the native layer. */
  stats: PlaybackStats | null;
}

/**
 * React hook for tracking stream progress and stats.
 *
 * Usage:
 * ```tsx
 * const { currentTime, duration, percentage, stats } = useStreamProgress();
 * ```
 */
export function useStreamProgress(
  options: UseStreamProgressOptions = {}
): StreamProgress {
  const { interval = 250, enabled = true } = options;

  const instance = useRef(AudioStream.getInstance()).current;
  const [progress, setProgress] = useState<StreamProgress>({
    currentTime: 0,
    duration: 0,
    percentage: 0,
    stats: null,
  });

  useEffect(() => {
    if (!enabled) return;

    // Listen to native progress events
    const handleProgress = (data: {
      currentTime: number;
      duration: number;
      percentage: number;
    }) => {
      setProgress((prev) => ({
        ...prev,
        currentTime: data.currentTime,
        duration: data.duration,
        percentage: data.percentage,
      }));
    };

    const handleStats = (stats: PlaybackStats) => {
      setProgress((prev) => ({
        ...prev,
        stats,
      }));
    };

    instance.addEventListener('onProgress', handleProgress);
    instance.addEventListener('onStats', handleStats);

    return () => {
      instance.removeEventListener('onProgress', handleProgress);
      instance.removeEventListener('onStats', handleStats);
    };
  }, [instance, enabled, interval]);

  return progress;
}
