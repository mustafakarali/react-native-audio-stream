import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';
import { RecordingState } from '../types';

const RNAudioStream = NativeModules.RNAudioStream;

describe('Recording & Audio Capture', () => {
  let audioStream: AudioStream;

  beforeEach(async () => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    RNAudioStream.initialize.mockResolvedValueOnce(true);
    await audioStream.initialize();
  });

  describe('startRecording', () => {
    it('should call native startRecording with default config', async () => {
      await audioStream.startRecording();
      expect(RNAudioStream.startRecording).toHaveBeenCalledWith({});
    });

    it('should pass custom recording config', async () => {
      await audioStream.startRecording({
        sampleRate: 16000,
        channels: 1,
        format: 'pcm',
        enableAudioData: true,
        chunkSize: 8192,
      });

      expect(RNAudioStream.startRecording).toHaveBeenCalledWith(
        expect.objectContaining({
          sampleRate: 16000,
          channels: 1,
          format: 'pcm',
          enableAudioData: true,
          chunkSize: 8192,
        })
      );
    });

    it('should support bluetooth source', async () => {
      await audioStream.startRecording({ source: 'bluetooth' });
      expect(RNAudioStream.startRecording).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'bluetooth' })
      );
    });

    it('should throw if not initialized', async () => {
      (AudioStream as any).instance = null;
      const fresh = AudioStream.getInstance();
      await expect(fresh.startRecording()).rejects.toThrow('AudioStream is not initialized');
    });
  });

  describe('stopRecording', () => {
    it('should return file path from native', async () => {
      const filePath = await audioStream.stopRecording();
      expect(filePath).toBe('/tmp/recording_123.pcm');
      expect(RNAudioStream.stopRecording).toHaveBeenCalled();
    });

    it('should throw if not initialized', async () => {
      (AudioStream as any).instance = null;
      const fresh = AudioStream.getInstance();
      await expect(fresh.stopRecording()).rejects.toThrow('AudioStream is not initialized');
    });
  });

  describe('getRecordingLevel', () => {
    it('should return 0 by default', async () => {
      const level = await audioStream.getRecordingLevel();
      expect(level).toBe(0.0);
    });

    it('should return level from native', async () => {
      RNAudioStream.getRecordingLevel.mockResolvedValueOnce(0.75);
      const level = await audioStream.getRecordingLevel();
      expect(level).toBe(0.75);
    });
  });

  describe('getRecordingState', () => {
    it('should return idle by default', async () => {
      const state = await audioStream.getRecordingState();
      expect(state).toBe('idle');
    });

    it('should return recording state from native', async () => {
      RNAudioStream.getRecordingState.mockResolvedValueOnce(RecordingState.RECORDING);
      const state = await audioStream.getRecordingState();
      expect(state).toBe(RecordingState.RECORDING);
    });
  });
});
