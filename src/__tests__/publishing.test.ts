import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import type { PublishConfig, PublishingStats } from '../types';

const RNAudioStream = NativeModules.RNAudioStream;

describe('Audio Encoding & Publishing', () => {
  let audioStream: AudioStream;

  beforeEach(async () => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    RNAudioStream.initialize.mockResolvedValueOnce(true);
    await audioStream.initialize();
  });

  describe('startPublishing', () => {
    it('should call native startPublishing with RTMP config', async () => {
      const config: PublishConfig = {
        url: 'rtmp://stream.example.com/live',
        protocol: 'rtmp',
        streamKey: 'my-stream-key',
        encoder: { codec: 'aac', bitrate: 128, sampleRate: 48000 },
      };
      await audioStream.startPublishing(config);
      expect(RNAudioStream.startPublishing).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'rtmp://stream.example.com/live',
          protocol: 'rtmp',
          streamKey: 'my-stream-key',
        })
      );
    });

    it('should call native startPublishing with SRT config', async () => {
      const config: PublishConfig = {
        url: 'srt://srt.example.com:9000',
        protocol: 'srt',
        srtLatency: 200,
      };
      await audioStream.startPublishing(config);
      expect(RNAudioStream.startPublishing).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'srt://srt.example.com:9000',
          protocol: 'srt',
          srtLatency: 200,
        })
      );
    });

    it('should support Opus encoder', async () => {
      const config: PublishConfig = {
        url: 'https://api.example.com/publish',
        protocol: 'http',
        encoder: { codec: 'opus', bitrate: 64, sampleRate: 16000, channels: 1 },
      };
      await audioStream.startPublishing(config);
      const calledConfig = RNAudioStream.startPublishing.mock.calls[0][0];
      expect(calledConfig.encoder.codec).toBe('opus');
    });

    it('should throw if URL is missing', async () => {
      await expect(
        audioStream.startPublishing({ url: '', protocol: 'rtmp' })
      ).rejects.toThrow('Publishing URL is required');
    });

    it('should throw if protocol is missing', async () => {
      await expect(
        audioStream.startPublishing({ url: 'rtmp://example.com', protocol: '' as any })
      ).rejects.toThrow('Publishing protocol is required');
    });

    it('should throw if not initialized', async () => {
      (AudioStream as any).instance = null;
      const fresh = AudioStream.getInstance();
      await expect(
        fresh.startPublishing({ url: 'rtmp://example.com', protocol: 'rtmp' })
      ).rejects.toThrow('AudioStream is not initialized');
    });
  });

  describe('stopPublishing', () => {
    it('should call native stopPublishing', async () => {
      await audioStream.stopPublishing();
      expect(RNAudioStream.stopPublishing).toHaveBeenCalled();
    });
  });

  describe('getPublishingStats', () => {
    it('should return default stats', async () => {
      const stats: PublishingStats = await audioStream.getPublishingStats();
      expect(stats.isPublishing).toBe(false);
      expect(stats.bitrate).toBe(128);
      expect(stats.droppedFrames).toBe(0);
      expect(stats.bytesSent).toBe(0);
      expect(stats.duration).toBe(0);
    });

    it('should return active publishing stats from native', async () => {
      RNAudioStream.getPublishingStats.mockResolvedValueOnce({
        isPublishing: true,
        bitrate: 96,
        droppedFrames: 2,
        latency: 120,
        bytesSent: 512000,
        duration: 60.5,
      });
      const stats = await audioStream.getPublishingStats();
      expect(stats.isPublishing).toBe(true);
      expect(stats.bitrate).toBe(96);
      expect(stats.bytesSent).toBe(512000);
      expect(stats.duration).toBe(60.5);
    });
  });
});
