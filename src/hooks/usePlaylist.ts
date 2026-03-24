import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioStream } from '../AudioStream';
import type { PlaylistItem, PlaylistState } from '../types';
import { RepeatMode } from '../types';

export interface UsePlaylistOptions {
  /** Initial playlist to set on mount */
  initialPlaylist?: PlaylistItem[];
  /** Auto-play when playlist is set. Default: true */
  autoPlay?: boolean;
}

export interface UsePlaylistReturn {
  /** Current playlist state */
  state: PlaylistState;
  /** The full queue of items */
  queue: PlaylistItem[];
  /** Whether the playlist is loaded (has items) */
  isLoaded: boolean;

  // Queue management
  setPlaylist: (items: PlaylistItem[]) => Promise<void>;
  addToQueue: (item: PlaylistItem, position?: number) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  moveInQueue: (fromIndex: number, toIndex: number) => Promise<void>;
  clearQueue: () => Promise<void>;

  // Playback controls
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  skipToIndex: (index: number) => Promise<void>;

  // Modes
  setShuffle: (enabled: boolean) => Promise<void>;
  setRepeat: (mode: RepeatMode) => Promise<void>;
  toggleShuffle: () => Promise<void>;
  cycleRepeat: () => Promise<void>;
}

const DEFAULT_STATE: PlaylistState = {
  currentIndex: -1,
  totalItems: 0,
  shuffle: false,
  repeat: RepeatMode.NONE,
  currentItem: null,
  hasNext: false,
  hasPrevious: false,
};

/**
 * React hook for playlist & queue management.
 * Provides reactive state and controls for the audio stream playlist.
 */
export function usePlaylist(options?: UsePlaylistOptions): UsePlaylistReturn {
  const [state, setState] = useState<PlaylistState>(DEFAULT_STATE);
  const [queue, setQueue] = useState<PlaylistItem[]>([]);
  const audioStream = useRef(AudioStream.getInstance()).current;

  // Sync state from native on track/queue changes
  useEffect(() => {
    const onTrackChange = (newState: PlaylistState) => {
      setState(newState);
    };

    const onQueueUpdate = (newState: PlaylistState) => {
      setState(newState);
      // Re-fetch full queue on update
      audioStream.getQueue().then(setQueue).catch(() => {});
    };

    audioStream.addEventListener('onTrackChange', onTrackChange);
    audioStream.addEventListener('onQueueUpdate', onQueueUpdate);

    return () => {
      audioStream.removeEventListener('onTrackChange', onTrackChange);
      audioStream.removeEventListener('onQueueUpdate', onQueueUpdate);
    };
  }, [audioStream]);

  // Set initial playlist on mount
  useEffect(() => {
    if (options?.initialPlaylist && options.initialPlaylist.length > 0) {
      audioStream
        .setPlaylist(options.initialPlaylist)
        .then(() => audioStream.getQueue())
        .then(setQueue)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPlaylist = useCallback(
    async (items: PlaylistItem[]) => {
      await audioStream.setPlaylist(items);
      const q = await audioStream.getQueue();
      setQueue(q);
      const s = await audioStream.getPlaylistState();
      setState(s);
    },
    [audioStream]
  );

  const addToQueue = useCallback(
    async (item: PlaylistItem, position?: number) => {
      await audioStream.addToQueue(item, position);
    },
    [audioStream]
  );

  const removeFromQueue = useCallback(
    async (index: number) => {
      await audioStream.removeFromQueue(index);
    },
    [audioStream]
  );

  const moveInQueue = useCallback(
    async (fromIndex: number, toIndex: number) => {
      await audioStream.moveInQueue(fromIndex, toIndex);
    },
    [audioStream]
  );

  const clearQueue = useCallback(async () => {
    await audioStream.clearQueue();
    setQueue([]);
    setState(DEFAULT_STATE);
  }, [audioStream]);

  const skipToNext = useCallback(async () => {
    await audioStream.skipToNext();
  }, [audioStream]);

  const skipToPrevious = useCallback(async () => {
    await audioStream.skipToPrevious();
  }, [audioStream]);

  const skipToIndex = useCallback(
    async (index: number) => {
      await audioStream.skipToIndex(index);
    },
    [audioStream]
  );

  const setShuffle = useCallback(
    async (enabled: boolean) => {
      await audioStream.setShuffle(enabled);
      setState((prev) => ({ ...prev, shuffle: enabled }));
    },
    [audioStream]
  );

  const setRepeat = useCallback(
    async (mode: RepeatMode) => {
      await audioStream.setRepeat(mode);
      setState((prev) => ({ ...prev, repeat: mode }));
    },
    [audioStream]
  );

  const toggleShuffle = useCallback(async () => {
    await setShuffle(!state.shuffle);
  }, [setShuffle, state.shuffle]);

  const cycleRepeat = useCallback(async () => {
    const modes = [RepeatMode.NONE, RepeatMode.ALL, RepeatMode.ONE];
    const nextIndex = (modes.indexOf(state.repeat) + 1) % modes.length;
    await setRepeat(modes[nextIndex]!);
  }, [setRepeat, state.repeat]);

  return {
    state,
    queue,
    isLoaded: queue.length > 0,
    setPlaylist,
    addToQueue,
    removeFromQueue,
    moveInQueue,
    clearQueue,
    skipToNext,
    skipToPrevious,
    skipToIndex,
    setShuffle,
    setRepeat,
    toggleShuffle,
    cycleRepeat,
  };
}
