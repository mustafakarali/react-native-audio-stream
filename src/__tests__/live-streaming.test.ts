import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import type { LiveStreamState, DvrWindow } from '../types';

const RNAudioStream = NativeModules.RNAudioStream;

describe('Live Streaming Advanced', () => {
  let audioStream: AudioStream;

  beforeEach(async () => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    RNAudioStream.initialize.mockResolvedValueOnce(true);
    await audioStream.initialize();
  });

  describe('seekToLiveEdge', () => {
    it('should call native seekToLiveEdge', async () => {
      await audioStream.seekToLiveEdge();
      expect(RNAudioStream.seekToLiveEdge).toHaveBeenCalled();
    });

    it('should throw if not initialized', async () => {
      (AudioStream as any).instance = null;
      const fresh = AudioStream.getInstance();
      await expect(fresh.seekToLiveEdge()).rejects.toThrow('AudioStream is not initialized');
    });
  });

  describe('getLiveEdgeOffset', () => {
    it('should return 0 by default', async () => {
      const offset = await audioStream.getLiveEdgeOffset();
      expect(offset).toBe(0.0);
      expect(RNAudioStream.getLiveEdgeOffset).toHaveBeenCalled();
    });

    it('should return offset value from native', async () => {
      RNAudioStream.getLiveEdgeOffset.mockResolvedValueOnce(5.2);
      const offset = await audioStream.getLiveEdgeOffset();
      expect(offset).toBe(5.2);
    });
  });

  describe('getDvrWindow', () => {
    it('should return empty DVR window by default', async () => {
      const window: DvrWindow = await audioStream.getDvrWindow();
      expect(window.start).toBe(0);
      expect(window.end).toBe(0);
      expect(window.duration).toBe(0);
    });

    it('should return DVR window from native', async () => {
      RNAudioStream.getDvrWindow.mockResolvedValueOnce({ start: 100, end: 400, duration: 300 });
      const window: DvrWindow = await audioStream.getDvrWindow();
      expect(window.start).toBe(100);
      expect(window.end).toBe(400);
      expect(window.duration).toBe(300);
    });
  });

  describe('setTargetLatency', () => {
    it('should call native setTargetLatency', async () => {
      await audioStream.setTargetLatency(2000);
      expect(RNAudioStream.setTargetLatency).toHaveBeenCalledWith(2000);
    });

    it('should accept 0 latency', async () => {
      await audioStream.setTargetLatency(0);
      expect(RNAudioStream.setTargetLatency).toHaveBeenCalledWith(0);
    });

    it('should throw on negative latency', async () => {
      await expect(audioStream.setTargetLatency(-100)).rejects.toThrow(
        'Target latency must be non-negative'
      );
    });
  });

  describe('getLiveStreamState', () => {
    it('should return non-live state by default', async () => {
      const state: LiveStreamState = await audioStream.getLiveStreamState();
      expect(state.isLive).toBe(false);
      expect(state.liveEdgeOffset).toBe(0);
      expect(state.dvrWindowSize).toBe(0);
      expect(state.isAtLiveEdge).toBe(false);
      expect(state.targetLatencyMs).toBe(0);
    });

    it('should return live state from native', async () => {
      RNAudioStream.getLiveStreamState.mockResolvedValueOnce({
        isLive: true,
        liveEdgeOffset: 1.5,
        dvrWindowSize: 300,
        isAtLiveEdge: true,
        targetLatencyMs: 2000,
      });
      const state: LiveStreamState = await audioStream.getLiveStreamState();
      expect(state.isLive).toBe(true);
      expect(state.liveEdgeOffset).toBe(1.5);
      expect(state.dvrWindowSize).toBe(300);
      expect(state.isAtLiveEdge).toBe(true);
      expect(state.targetLatencyMs).toBe(2000);
    });
  });
});
