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
  cancelStream(): Promise<boolean>;
  playFromData(base64Data: string, config: Object): Promise<boolean>;
  appendToBuffer(base64Data: string): Promise<boolean>;
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
  
  // iOS 26 Features
  showInputPicker(): Promise<boolean>;
  getAvailableInputs(): Promise<ReadonlyArray<Object>>;
  enableEnhancedBuffering(enable: boolean): Promise<boolean>;
  enableSpatialAudio(enable: boolean): Promise<boolean>;
  useQueuePlayer(enable: boolean): Promise<boolean>;
  createRoutePickerView(): Promise<number>;
  
  // Realtime PCM streaming (both platforms)
  startRealtimeStream(config: Object): Promise<boolean>;
  appendRealtimeData(base64Data: string): Promise<boolean>;
  completeRealtimeStream(): Promise<boolean>;
  getStreamingStats(): Promise<Object>;
  
  // WebSocket streaming (both platforms)
  startWebSocketStream(config: Object): Promise<boolean>;
  stopWebSocketStream(): Promise<boolean>;
  sendWebSocketMessage(data: string): Promise<boolean>;

  // Playlist & Queue (both platforms)
  setPlaylist(items: ReadonlyArray<Object>): Promise<boolean>;
  addToQueue(item: Object, position: number): Promise<boolean>;
  removeFromQueue(index: number): Promise<boolean>;
  moveInQueue(fromIndex: number, toIndex: number): Promise<boolean>;
  skipToNext(): Promise<boolean>;
  skipToPrevious(): Promise<boolean>;
  skipToIndex(index: number): Promise<boolean>;
  setShuffle(enabled: boolean): Promise<boolean>;
  setRepeatMode(mode: string): Promise<boolean>;
  getPlaylistState(): Promise<Object>;
  getQueue(): Promise<ReadonlyArray<Object>>;
  clearQueue(): Promise<boolean>;
  
  // Event emitter methods
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNAudioStream'); 