/**
 * TurboModule spec for react-native-audio-stream.
 * 
 * This codegen spec defines the native interface for the New Architecture.
 * React Native CLI will auto-generate C++/Java/ObjC bindings from this file.
 * 
 * @see https://reactnative.dev/docs/new-architecture-library-intro
 */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // ── Core ──
  initialize(config: Object): Promise<void>;
  destroy(): Promise<void>;
  startStream(url: string, config: Object): Promise<void>;
  stopStream(): Promise<void>;
  cancelStream(): Promise<void>;

  // ── Playback Controls ──
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(position: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  getState(): Promise<string>;
  getStats(): Promise<Object>;
  getDuration(): Promise<number>;
  getCurrentTime(): Promise<number>;
  getBufferedPercentage(): Promise<number>;

  // ── Mute/Pitch ──
  mute(): Promise<void>;
  unmute(): Promise<void>;
  isMuted(): Promise<boolean>;
  setPitch(pitch: number): Promise<void>;
  getPitch(): Promise<number>;

  // ── Equalizer ──
  setEqualizer(bands: Object[]): Promise<void>;
  resetEqualizer(): Promise<void>;
  applyEqualizerPreset(preset: string): Promise<void>;

  // ── Cache ──
  clearCache(): Promise<void>;
  getCacheSize(): Promise<number>;
  preloadStream(url: string, config: Object): Promise<void>;
  isStreamCached(url: string): Promise<boolean>;

  // ── Data Playback ──
  playFromData(base64Data: string, config: Object): Promise<void>;
  appendData(base64Data: string): Promise<void>;
  finalizeDataStream(): Promise<void>;

  // ── Memory Stream ──
  startMemoryStream(config: Object): Promise<void>;
  appendToMemoryStream(base64Data: string): Promise<void>;
  completeMemoryStream(): Promise<void>;

  // ── Realtime Streaming ──
  startRealtimeStream(config: Object): Promise<void>;
  sendRealtimeData(base64Data: string): Promise<void>;
  stopRealtimeStream(): Promise<void>;

  // ── WebSocket ──
  startWebSocketStream(config: Object): Promise<void>;
  stopWebSocketStream(): Promise<void>;

  // ── iOS-Specific ──
  showInputPicker(): Promise<void>;
  getAvailableInputs(): Promise<Object[]>;
  enableEnhancedBuffering(enable: boolean): Promise<void>;
  enableSpatialAudio(enable: boolean): Promise<void>;
  useQueuePlayer(enable: boolean): Promise<void>;
  createRoutePickerView(): Promise<number>;

  // ── Playlist & Queue ──
  setPlaylist(items: Object[]): Promise<void>;
  addToQueue(item: Object, position: number): Promise<void>;
  removeFromQueue(index: number): Promise<void>;
  moveInQueue(fromIndex: number, toIndex: number): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  skipToIndex(index: number): Promise<void>;
  setShuffle(enabled: boolean): Promise<void>;
  setRepeatMode(mode: string): Promise<void>;
  getPlaylistState(): Promise<Object>;
  getQueue(): Promise<Object[]>;
  clearQueue(): Promise<void>;

  // ── Live Streaming ──
  seekToLiveEdge(): Promise<void>;
  getLiveEdgeOffset(): Promise<number>;
  getDvrWindow(): Promise<Object>;
  setTargetLatency(latencyMs: number): Promise<void>;
  getLiveStreamState(): Promise<Object>;

  // ── Recording ──
  startRecording(config: Object): Promise<void>;
  stopRecording(): Promise<string>;
  getRecordingLevel(): Promise<number>;
  getRecordingState(): Promise<string>;

  // ── Audio DSP ──
  enableAEC(enabled: boolean): Promise<void>;
  enableNoiseSuppression(enabled: boolean): Promise<void>;
  enableAGC(enabled: boolean): Promise<void>;
  enableVAD(config: Object): Promise<void>;
  disableVAD(): Promise<void>;
  setAudioProcessing(config: Object): Promise<void>;

  // ── Publishing ──
  startPublishing(config: Object): Promise<void>;
  stopPublishing(): Promise<void>;
  getPublishingStats(): Promise<Object>;

  // ── Media Session / CarPlay / Android Auto ──
  setMediaSessionConfig(config: Object): Promise<void>;
  getMediaBrowseTree(): Promise<Object[]>;

  // ── DRM ──
  setDrmConfig(config: Object): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNAudioStream');
