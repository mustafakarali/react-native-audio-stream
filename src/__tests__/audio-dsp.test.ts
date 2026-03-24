import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';

const RNAudioStream = NativeModules.RNAudioStream;

describe('Audio DSP (AEC, NS, AGC, VAD)', () => {
  let audioStream: AudioStream;

  beforeEach(async () => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    RNAudioStream.initialize.mockResolvedValueOnce(true);
    await audioStream.initialize();
  });

  describe('enableAEC', () => {
    it('should enable AEC', async () => {
      await audioStream.enableAEC(true);
      expect(RNAudioStream.enableAEC).toHaveBeenCalledWith(true);
    });

    it('should disable AEC', async () => {
      await audioStream.enableAEC(false);
      expect(RNAudioStream.enableAEC).toHaveBeenCalledWith(false);
    });
  });

  describe('enableNoiseSuppression', () => {
    it('should enable NS', async () => {
      await audioStream.enableNoiseSuppression(true);
      expect(RNAudioStream.enableNoiseSuppression).toHaveBeenCalledWith(true);
    });

    it('should disable NS', async () => {
      await audioStream.enableNoiseSuppression(false);
      expect(RNAudioStream.enableNoiseSuppression).toHaveBeenCalledWith(false);
    });
  });

  describe('enableAGC', () => {
    it('should enable AGC', async () => {
      await audioStream.enableAGC(true);
      expect(RNAudioStream.enableAGC).toHaveBeenCalledWith(true);
    });

    it('should disable AGC', async () => {
      await audioStream.enableAGC(false);
      expect(RNAudioStream.enableAGC).toHaveBeenCalledWith(false);
    });
  });

  describe('enableVAD', () => {
    it('should enable VAD with default config', async () => {
      await audioStream.enableVAD();
      expect(RNAudioStream.enableVAD).toHaveBeenCalledWith({});
    });

    it('should enable VAD with custom sensitivity', async () => {
      await audioStream.enableVAD({ sensitivity: 0.8, minVoiceDuration: 300 });
      expect(RNAudioStream.enableVAD).toHaveBeenCalledWith(
        expect.objectContaining({ sensitivity: 0.8, minVoiceDuration: 300 })
      );
    });
  });

  describe('disableVAD', () => {
    it('should disable VAD', async () => {
      await audioStream.disableVAD();
      expect(RNAudioStream.disableVAD).toHaveBeenCalled();
    });
  });

  describe('setAudioProcessing', () => {
    it('should set all processing options at once', async () => {
      await audioStream.setAudioProcessing({
        aec: true,
        noiseSuppression: true,
        agc: false,
        vad: true,
        silenceThreshold: 0.1,
        gainLevel: 1.5,
      });
      expect(RNAudioStream.setAudioProcessing).toHaveBeenCalledWith(
        expect.objectContaining({
          aec: true,
          noiseSuppression: true,
          agc: false,
          vad: true,
        })
      );
    });

    it('should throw if not initialized', async () => {
      (AudioStream as any).instance = null;
      const fresh = AudioStream.getInstance();
      await expect(fresh.setAudioProcessing({ aec: true })).rejects.toThrow('AudioStream is not initialized');
    });
  });
});
