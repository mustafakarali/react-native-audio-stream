import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import { RepeatMode } from '../types';
import type { PlaylistItem, PlaylistState } from '../types';

const RNAudioStream = NativeModules.RNAudioStream;

describe('Playlist & Queue Management', () => {
  let audioStream: AudioStream;

  beforeEach(async () => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    RNAudioStream.initialize.mockResolvedValueOnce(true);
    await audioStream.initialize();
  });

  const samplePlaylist: PlaylistItem[] = [
    { url: 'https://example.com/track1.mp3', title: 'Track 1', artist: 'Artist A' },
    { url: 'https://example.com/track2.mp3', title: 'Track 2', artist: 'Artist B' },
    { url: 'https://example.com/track3.mp3', title: 'Track 3', artist: 'Artist C' },
  ];

  describe('RepeatMode enum', () => {
    it('should have NONE, ONE, ALL values', () => {
      expect(RepeatMode.NONE).toBe('none');
      expect(RepeatMode.ONE).toBe('one');
      expect(RepeatMode.ALL).toBe('all');
    });

    it('should have exactly 3 values', () => {
      expect(Object.values(RepeatMode)).toHaveLength(3);
    });
  });

  describe('PlaylistItem interface', () => {
    it('should accept valid items', () => {
      const item: PlaylistItem = {
        url: 'https://example.com/track.mp3',
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album',
        artwork: 'https://example.com/art.jpg',
        duration: 180,
        headers: { Authorization: 'Bearer token' },
        id: 'track-1',
      };
      expect(item.url).toBe('https://example.com/track.mp3');
      expect(item.id).toBe('track-1');
    });

    it('should accept minimal items (url only)', () => {
      const item: PlaylistItem = { url: 'https://example.com/track.mp3' };
      expect(item.title).toBeUndefined();
      expect(item.artist).toBeUndefined();
    });
  });

  describe('setPlaylist', () => {
    it('should call native setPlaylist with items', async () => {
      await audioStream.setPlaylist(samplePlaylist);
      expect(RNAudioStream.setPlaylist).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ url: 'https://example.com/track1.mp3', title: 'Track 1' }),
        ])
      );
    });

    it('should auto-generate IDs for items without them', async () => {
      await audioStream.setPlaylist(samplePlaylist);
      const calledWith = RNAudioStream.setPlaylist.mock.calls[0][0];
      calledWith.forEach((item: any) => {
        expect(item.id).toBeDefined();
        expect(typeof item.id).toBe('string');
      });
    });

    it('should throw on empty playlist', async () => {
      try {
        await audioStream.setPlaylist([]);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('INVALID_STATE');
      }
    });

    it('should throw if not initialized', async () => {
      (AudioStream as any).instance = null;
      const fresh = AudioStream.getInstance();
      try {
        await fresh.setPlaylist(samplePlaylist);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('INITIALIZATION_ERROR');
      }
    });
  });

  describe('addToQueue', () => {
    it('should call native addToQueue with item and position', async () => {
      const item: PlaylistItem = { url: 'https://example.com/new.mp3', title: 'New Track' };
      await audioStream.addToQueue(item, 2);
      expect(RNAudioStream.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com/new.mp3' }),
        2
      );
    });

    it('should use -1 for end position when not specified', async () => {
      const item: PlaylistItem = { url: 'https://example.com/new.mp3' };
      await audioStream.addToQueue(item);
      expect(RNAudioStream.addToQueue).toHaveBeenCalledWith(
        expect.anything(),
        -1
      );
    });
  });

  describe('removeFromQueue', () => {
    it('should call native removeFromQueue with index', async () => {
      await audioStream.removeFromQueue(1);
      expect(RNAudioStream.removeFromQueue).toHaveBeenCalledWith(1);
    });
  });

  describe('moveInQueue', () => {
    it('should call native moveInQueue with from/to indices', async () => {
      await audioStream.moveInQueue(0, 2);
      expect(RNAudioStream.moveInQueue).toHaveBeenCalledWith(0, 2);
    });
  });

  describe('skipToNext', () => {
    it('should call native skipToNext', async () => {
      await audioStream.skipToNext();
      expect(RNAudioStream.skipToNext).toHaveBeenCalled();
    });
  });

  describe('skipToPrevious', () => {
    it('should call native skipToPrevious', async () => {
      await audioStream.skipToPrevious();
      expect(RNAudioStream.skipToPrevious).toHaveBeenCalled();
    });
  });

  describe('skipToIndex', () => {
    it('should call native skipToIndex', async () => {
      await audioStream.skipToIndex(5);
      expect(RNAudioStream.skipToIndex).toHaveBeenCalledWith(5);
    });
  });

  describe('setShuffle', () => {
    it('should call native setShuffle', async () => {
      await audioStream.setShuffle(true);
      expect(RNAudioStream.setShuffle).toHaveBeenCalledWith(true);
    });
  });

  describe('setRepeat', () => {
    it('should call native setRepeatMode with RepeatMode value', async () => {
      await audioStream.setRepeat(RepeatMode.ALL);
      expect(RNAudioStream.setRepeatMode).toHaveBeenCalledWith('all');
    });

    it('should accept all repeat modes', async () => {
      for (const mode of [RepeatMode.NONE, RepeatMode.ONE, RepeatMode.ALL]) {
        jest.clearAllMocks();
        await audioStream.setRepeat(mode);
        expect(RNAudioStream.setRepeatMode).toHaveBeenCalledWith(mode);
      }
    });
  });

  describe('getPlaylistState', () => {
    it('should return playlist state from native', async () => {
      const state = await audioStream.getPlaylistState();
      expect(state.currentIndex).toBe(-1);
      expect(state.totalItems).toBe(0);
      expect(state.shuffle).toBe(false);
      expect(state.repeat).toBe('none');
      expect(state.hasNext).toBe(false);
      expect(state.hasPrevious).toBe(false);
    });
  });

  describe('getQueue', () => {
    it('should return queue from native', async () => {
      const queue = await audioStream.getQueue();
      expect(Array.isArray(queue)).toBe(true);
      expect(queue).toHaveLength(0);
    });
  });

  describe('clearQueue', () => {
    it('should call native clearQueue', async () => {
      await audioStream.clearQueue();
      expect(RNAudioStream.clearQueue).toHaveBeenCalled();
    });
  });
});
