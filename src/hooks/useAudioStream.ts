import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioStream } from '../AudioStream';
import type {
  AudioStreamConfig,
  PlaybackState,
  PlaybackStats,
  AudioMetadata,
  StreamError,
} from '../types';

export interface UseAudioStreamOptions {
  /** Configuration to pass to initialize(). */
  config?: AudioStreamConfig;
  /** Auto-initialize on mount. @default true */
  autoInit?: boolean;
  /** Called when an error occurs. */
  onError?: (error: StreamError) => void;
  /** Called when metadata changes. */
  onMetadata?: (metadata: AudioMetadata) => void;
  /** Called when playback stats update. */
  onStats?: (stats: PlaybackStats) => void;
  /** Called when network state changes. */
  onNetworkStateChange?: (state: { isConnected: boolean; type?: string }) => void;
}

export interface UseAudioStreamReturn {
  /** Current playback state. */
  state: PlaybackState;
  /** Whether the player is currently buffering. */
  isBuffering: boolean;
  /** Whether the player is currently playing. */
  isPlaying: boolean;
  /** Latest stream metadata (title, artist, album, duration). */
  metadata: AudioMetadata | null;
  /** Latest error, or null. */
  error: StreamError | null;
  /** Whether the AudioStream has been initialized. */
  isInitialized: boolean;
  /** Initialize the audio stream manually if autoInit=false. */
  initialize: (config?: AudioStreamConfig) => Promise<void>;
  /** Start streaming from a URL. */
  startStream: (url: string, config?: AudioStreamConfig) => Promise<void>;
  /** Stop the current stream (alias for stopStream). */
  stop: () => Promise<void>;
  /** Stop the current stream. */
  stopStream: () => Promise<void>;
  /** Resume playback. */
  play: () => Promise<void>;
  /** Pause playback. */
  pause: () => Promise<void>;
  /** Seek to a position in seconds. */
  seek: (position: number) => Promise<void>;
  /** Set volume (0.0 – 1.0). */
  setVolume: (volume: number) => Promise<void>;
  /** Set playback rate (0.5 – 2.0). */
  setPlaybackRate: (rate: number) => Promise<void>;
  /** Destroy the player and release resources. */
  destroy: () => Promise<void>;
  /** The AudioStream singleton instance for advanced usage. */
  instance: AudioStream;
}

/**
 * React hook for audio streaming. Manages lifecycle, state, and events.
 *
 * Usage:
 * ```tsx
 * const { state, startStream, play, pause, stop } = useAudioStream({
 *   onError: (err) => console.error(err),
 *   onMetadata: (meta) => console.log(meta),
 * });
 * ```
 */
export function useAudioStream(
  options: UseAudioStreamOptions = {}
): UseAudioStreamReturn {
  const { config, autoInit = true, onError, onMetadata, onStats, onNetworkStateChange } = options;

  const instance = useRef(AudioStream.getInstance()).current;
  const [state, setState] = useState<PlaybackState>('idle' as PlaybackState);
  const [isBuffering, setIsBuffering] = useState(false);
  const [metadata, setMetadata] = useState<AudioMetadata | null>(null);
  const [error, setError] = useState<StreamError | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize
  useEffect(() => {
    if (!autoInit) return;

    let cancelled = false;

    (async () => {
      try {
        await instance.initialize(config);
        if (!cancelled) setIsInitialized(true);
      } catch (e) {
        const err: StreamError = {
          code: 'INITIALIZATION_ERROR',
          message: String(e),
          recoverable: false,
        };
        if (!cancelled) {
          setError(err);
          onError?.(err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoInit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Event listeners
  useEffect(() => {
    const handleStateChange = (newState: PlaybackState) => {
      setState(newState);
    };
    const handleBuffer = (buffering: boolean) => {
      setIsBuffering(buffering);
    };
    const handleMetadata = (meta: AudioMetadata) => {
      setMetadata(meta);
      onMetadata?.(meta);
    };
    const handleError = (err: StreamError) => {
      setError(err);
      onError?.(err);
    };
    const handleStats = (s: PlaybackStats) => {
      onStats?.(s);
    };
    const handleNetworkChange = (ns: { isConnected: boolean; type?: string }) => {
      onNetworkStateChange?.(ns);
    };

    instance.addEventListener('onStateChange', handleStateChange);
    instance.addEventListener('onBuffer', handleBuffer);
    instance.addEventListener('onMetadata', handleMetadata);
    instance.addEventListener('onError', handleError);
    instance.addEventListener('onStats', handleStats);
    instance.addEventListener('onNetworkStateChange', handleNetworkChange);

    return () => {
      instance.removeEventListener('onStateChange', handleStateChange);
      instance.removeEventListener('onBuffer', handleBuffer);
      instance.removeEventListener('onMetadata', handleMetadata);
      instance.removeEventListener('onError', handleError);
      instance.removeEventListener('onStats', handleStats);
      instance.removeEventListener('onNetworkStateChange', handleNetworkChange);
    };
  }, [instance]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialize = useCallback(
    async (initConfig?: AudioStreamConfig) => {
      try {
        await instance.initialize(initConfig || config);
        setIsInitialized(true);
      } catch (e) {
        const err: StreamError = {
          code: 'INITIALIZATION_ERROR',
          message: String(e),
          recoverable: false,
        };
        setError(err);
        onError?.(err);
        throw e;
      }
    },
    [instance, config] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const startStream = useCallback(
    async (url: string, streamConfig?: AudioStreamConfig) => {
      setError(null);
      await instance.startStream(url, streamConfig);
    },
    [instance]
  );

  const stopStream = useCallback(async () => {
    await instance.stopStream();
    setState('idle' as PlaybackState);
    setMetadata(null);
  }, [instance]);

  const play = useCallback(async () => {
    await instance.play();
  }, [instance]);

  const pause = useCallback(async () => {
    await instance.pause();
  }, [instance]);

  const seek = useCallback(
    async (position: number) => {
      await instance.seek(position);
    },
    [instance]
  );

  const setVolume = useCallback(
    async (volume: number) => {
      await instance.setVolume(volume);
    },
    [instance]
  );

  const setPlaybackRate = useCallback(
    async (rate: number) => {
      await instance.setPlaybackRate(rate);
    },
    [instance]
  );

  const destroy = useCallback(async () => {
    try {
      await instance.destroy();
      setState('idle' as PlaybackState);
      setMetadata(null);
      setIsInitialized(false);
    } catch (_e) {
      // Ignore errors on destroy
    }
  }, [instance]);

  return {
    state,
    isBuffering,
    isPlaying: state === ('playing' as PlaybackState),
    metadata,
    error,
    isInitialized,
    initialize,
    startStream,
    stop: stopStream,
    stopStream,
    play,
    pause,
    seek,
    setVolume,
    setPlaybackRate,
    destroy,
    instance,
  };
}
