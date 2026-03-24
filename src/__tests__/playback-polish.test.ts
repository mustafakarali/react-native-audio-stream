import { NativeModules } from 'react-native';
import { AudioStream } from '../AudioStream';

const RNAudioStream = NativeModules.RNAudioStream;

describe('Playback Polish — Mute & Pitch', () => {
  let audioStream: AudioStream;

  beforeEach(async () => {
    jest.clearAllMocks();
    (AudioStream as any).instance = null;
    audioStream = AudioStream.getInstance();
    RNAudioStream.initialize.mockResolvedValueOnce(true);
    await audioStream.initialize();
  });

  // ─── Mute Control ───

  describe('mute', () => {
    it('should call native mute', async () => {
      await audioStream.mute();
      expect(RNAudioStream.mute).toHaveBeenCalled();
    });

    it('should throw if not initialized', async () => {
      (AudioStream as any).instance = null;
      const fresh = AudioStream.getInstance();
      await expect(fresh.mute()).rejects.toThrow('AudioStream is not initialized');
    });
  });

  describe('unmute', () => {
    it('should call native unmute', async () => {
      await audioStream.unmute();
      expect(RNAudioStream.unmute).toHaveBeenCalled();
    });

    it('should throw if not initialized', async () => {
      (AudioStream as any).instance = null;
      const fresh = AudioStream.getInstance();
      await expect(fresh.unmute()).rejects.toThrow('AudioStream is not initialized');
    });
  });

  describe('isMuted', () => {
    it('should return false by default', async () => {
      const muted = await audioStream.isMuted();
      expect(muted).toBe(false);
      expect(RNAudioStream.isMuted).toHaveBeenCalled();
    });

    it('should return true after muting', async () => {
      RNAudioStream.isMuted.mockResolvedValueOnce(true);
      const muted = await audioStream.isMuted();
      expect(muted).toBe(true);
    });
  });

  // ─── Pitch Control ───

  describe('setPitch', () => {
    it('should call native setPitch with valid pitch', async () => {
      await audioStream.setPitch(1.5);
      expect(RNAudioStream.setPitch).toHaveBeenCalledWith(1.5);
    });

    it('should accept minimum pitch 0.5', async () => {
      await audioStream.setPitch(0.5);
      expect(RNAudioStream.setPitch).toHaveBeenCalledWith(0.5);
    });

    it('should accept maximum pitch 2.0', async () => {
      await audioStream.setPitch(2.0);
      expect(RNAudioStream.setPitch).toHaveBeenCalledWith(2.0);
    });

    it('should throw on pitch below 0.5', async () => {
      await expect(audioStream.setPitch(0.3)).rejects.toThrow(
        'Pitch must be between 0.5 and 2.0'
      );
    });

    it('should throw on pitch above 2.0', async () => {
      await expect(audioStream.setPitch(2.5)).rejects.toThrow(
        'Pitch must be between 0.5 and 2.0'
      );
    });

    it('should throw if not initialized', async () => {
      (AudioStream as any).instance = null;
      const fresh = AudioStream.getInstance();
      await expect(fresh.setPitch(1.0)).rejects.toThrow('AudioStream is not initialized');
    });
  });

  describe('getPitch', () => {
    it('should return 1.0 by default', async () => {
      const pitch = await audioStream.getPitch();
      expect(pitch).toBe(1.0);
      expect(RNAudioStream.getPitch).toHaveBeenCalled();
    });

    it('should return custom pitch value', async () => {
      RNAudioStream.getPitch.mockResolvedValueOnce(0.8);
      const pitch = await audioStream.getPitch();
      expect(pitch).toBe(0.8);
    });
  });

  // ─── Mute + Volume interaction ───

  describe('mute/unmute + volume interaction', () => {
    it('should mute and unmute independently from volume', async () => {
      await audioStream.mute();
      expect(RNAudioStream.mute).toHaveBeenCalled();

      await audioStream.unmute();
      expect(RNAudioStream.unmute).toHaveBeenCalled();
    });

    it('should be able to set volume while muted', async () => {
      await audioStream.mute();
      await audioStream.setVolume(0.5);
      expect(RNAudioStream.setVolume).toHaveBeenCalledWith(0.5);
    });
  });
});
