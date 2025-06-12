import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { 
  AudioStreamConfig, 
  PlaybackState, 
  PlaybackStats, 
  AudioMetadata, 
  EqualizerBand 
} from './types';

export interface Spec extends TurboModule {
  initialize(config: Object): Promise<boolean>;
  destroy(): Promise<boolean>;
  startStream(url: string, config: Object): Promise<boolean>;
  stopStream(): Promise<boolean>;
  play(): Promise<boolean>;
  pause(): Promise<boolean>;
  stop(): Promise<boolean>;
  seek(position: number): Promise<boolean>;
  setVolume(volume: number): Promise<boolean>;
  getVolume(): Promise<number>;
  setPlaybackRate(rate: number): Promise<boolean>;
  getPlaybackRate(): Promise<number>;
  getState(): Promise<string>;
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
  getBufferedPercentage(): Promise<number>;
  getStats(): Promise<Object>;
  getMetadata(): Promise<Object | null>;
  setEqualizer(bands: ReadonlyArray<Object>): Promise<boolean>;
  getEqualizer(): Promise<ReadonlyArray<Object>>;
  clearCache(): Promise<boolean>;
  getCacheSize(): Promise<number>;
  preloadStream(url: string, duration?: number): Promise<boolean>;
  setNetworkPriority(priority: string): Promise<boolean>;
  requestAudioFocus(): Promise<boolean>;
  abandonAudioFocus(): Promise<boolean>;
  setAudioSessionCategory(category: string): Promise<boolean>;
  
  // Event emitter methods
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNAudioStream'); 