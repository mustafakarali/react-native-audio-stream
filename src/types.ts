export enum AudioFormat {
  MP3 = 'mp3',
  AAC = 'aac',
  WAV = 'wav',
  OGG = 'ogg',
  FLAC = 'flac',
  PCM = 'pcm',
  HLS = 'hls',
  DASH = 'dash',
}

export enum StreamingProtocol {
  HTTP = 'http',
  HTTPS = 'https',
  WEBSOCKET = 'websocket',
  WEBSOCKET_SECURE = 'wss',
}

/**
 * Configuration for WebSocket audio streaming.
 * Supports binary audio data reception and bi-directional messaging.
 * Both iOS (NSURLSessionWebSocketTask) and Android (OkHttp WebSocket) are supported.
 */
export interface WebSocketStreamConfig {
  /** WebSocket URL (ws:// or wss://) */
  url: string;
  /** Optional WebSocket sub-protocols */
  protocols?: string[];
  /** Optional HTTP headers sent during the WebSocket handshake */
  headers?: Record<string, string>;
  /** Audio format of incoming binary data. Default: 'pcm' */
  audioFormat?: AudioFormat;
  /** Sample rate for PCM audio. Default: 44100 */
  sampleRate?: number;
  /** Number of audio channels. Default: 1 (mono) */
  channels?: number;
  /** Auto-play as soon as first audio data arrives. Default: true */
  autoPlay?: boolean;
  /** Enable auto-reconnect on connection drop. Default: true */
  autoReconnect?: boolean;
  /** Max reconnect attempts. Uses global reconnectAttempts if not set */
  reconnectAttempts?: number;
  /** Delay between reconnect attempts in ms. Uses global reconnectDelay if not set */
  reconnectDelay?: number;
}

export enum PlaybackState {
  IDLE = 'idle',
  LOADING = 'loading',
  BUFFERING = 'buffering',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error',
  COMPLETED = 'completed',
}

export enum RepeatMode {
  NONE = 'none',
  ONE = 'one',
  ALL = 'all',
}

export interface PlaylistItem {
  /** Unique ID for this item. Auto-generated UUID if not provided. */
  id?: string;
  /** Audio URL */
  url: string;
  /** Track title (shown in lock screen) */
  title?: string;
  /** Artist name */
  artist?: string;
  /** Album name */
  album?: string;
  /** Artwork URL or base64 */
  artwork?: string;
  /** Duration in seconds (0 if unknown) */
  duration?: number;
  /** Custom headers for this track's HTTP request */
  headers?: Record<string, string>;
}

export interface PlaylistState {
  /** Index of the currently playing item (-1 if empty) */
  currentIndex: number;
  /** Total number of items in queue */
  totalItems: number;
  /** Shuffle enabled */
  shuffle: boolean;
  /** Repeat mode */
  repeat: RepeatMode;
  /** Current track info */
  currentItem: PlaylistItem | null;
  /** Has next track */
  hasNext: boolean;
  /** Has previous track */
  hasPrevious: boolean;
}

// ─── Live Streaming Advanced ───

export interface LiveStreamConfig {
  /** Target latency in milliseconds for LL-HLS/LL-DASH */
  targetLatency?: number;
  /** Speed adjustment when catching up to live edge (default: 1.04) */
  catchUpSpeed?: number;
  /** Fall-behind threshold in seconds — triggers speed-up when exceeded */
  fallBehindThreshold?: number;
}

export interface LiveStreamState {
  /** Whether the current stream is a live stream */
  isLive: boolean;
  /** Offset from live edge in seconds (0 = at live edge) */
  liveEdgeOffset: number;
  /** DVR window size in seconds (0 if no DVR) */
  dvrWindowSize: number;
  /** Whether currently at the live edge */
  isAtLiveEdge: boolean;
  /** Target latency in milliseconds */
  targetLatencyMs: number;
}

export interface DvrWindow {
  /** Start of the seekable range in seconds */
  start: number;
  /** End of the seekable range in seconds */
  end: number;
  /** Total duration of the DVR window in seconds */
  duration: number;
}

// ─── DRM ───

export type DRMType = 'widevine' | 'fairplay' | 'aes-128' | 'clearkey';

export interface DRMConfig {
  /** DRM system type */
  type: DRMType;
  /** License server URL */
  licenseUrl: string;
  /** Custom headers for license requests */
  headers?: Record<string, string>;
  /** FairPlay certificate URL (required for FairPlay) */
  certificateUrl?: string;
  /** Content ID for FairPlay (extracted from URI if not provided) */
  contentId?: string;
  /** Whether to persist license for offline playback */
  persistLicense?: boolean;
}

// ─── Recording & Audio Capture ───

export type RecordingFormat = 'pcm' | 'wav' | 'aac' | 'opus';
export type RecordingSource = 'mic' | 'bluetooth' | 'default';

export interface RecordingConfig {
  /** Sample rate in Hz. Default: 44100 */
  sampleRate?: number;
  /** Number of audio channels. Default: 1 (mono) */
  channels?: number;
  /** Audio format. Default: 'pcm' */
  format?: RecordingFormat;
  /** Input source. Default: 'default' */
  source?: RecordingSource;
  /** Enable raw PCM data events (base64 chunks). Default: false */
  enableAudioData?: boolean;
  /** Chunk size for PCM data events in bytes. Default: 4096 */
  chunkSize?: number;
}

export enum RecordingState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused',
  STOPPED = 'stopped',
}

// ─── Audio DSP ───

export interface AudioProcessingConfig {
  /** Echo cancellation. Default: false */
  aec?: boolean;
  /** Noise suppression. Default: false */
  noiseSuppression?: boolean;
  /** Automatic gain control. Default: false */
  agc?: boolean;
  /** Voice activity detection. Default: false */
  vad?: boolean;
  /** Silence detection threshold (0.0-1.0). Default: 0.05 */
  silenceThreshold?: number;
  /** Gain level for AGC (0.0-2.0). Default: 1.0 */
  gainLevel?: number;
}

export interface VADConfig {
  /** Minimum voice duration to trigger (ms). Default: 200 */
  minVoiceDuration?: number;
  /** Minimum silence duration to trigger silence event (ms). Default: 1000 */
  minSilenceDuration?: number;
  /** Detection sensitivity (0.0-1.0). Default: 0.5 */
  sensitivity?: number;
}

// ─── Audio Encoding & Publishing ───

export type AudioCodec = 'opus' | 'aac' | 'pcm';
export type PublishingProtocol = 'rtmp' | 'srt' | 'webrtc' | 'http';

export interface EncoderConfig {
  /** Audio codec. Default: 'opus' */
  codec?: AudioCodec;
  /** Bitrate in kbps. Default: 128 */
  bitrate?: number;
  /** Sample rate in Hz. Default: 48000 */
  sampleRate?: number;
  /** Number of channels. Default: 1 */
  channels?: number;
  /** Opus complexity (0-10). Default: 5 */
  complexity?: number;
}

export interface PublishConfig {
  /** Server URL to publish to */
  url: string;
  /** Publishing protocol */
  protocol: PublishingProtocol;
  /** Encoder configuration */
  encoder?: EncoderConfig;
  /** Stream key for RTMP/SRT */
  streamKey?: string;
  /** Custom headers for HTTP publishing */
  headers?: Record<string, string>;
  /** Maximum reconnect attempts. Default: 3 */
  reconnectAttempts?: number;
  /** SRT latency in ms. Default: 120 */
  srtLatency?: number;
}

export interface PublishingStats {
  /** Publishing state */
  isPublishing: boolean;
  /** Current encoding bitrate in kbps */
  bitrate: number;
  /** Dropped audio frames */
  droppedFrames: number;
  /** Publishing latency in ms */
  latency: number;
  /** Total bytes sent */
  bytesSent: number;
  /** Publishing duration in seconds */
  duration: number;
}

// ─── CarPlay & Android Auto ───

export type MediaSessionAction = 'play' | 'pause' | 'stop' | 'skipNext' | 'skipPrevious' | 'seek';

export interface MediaSessionConfig {
  /** Enable CarPlay/Android Auto media session. Default: false */
  enabled?: boolean;
  /** Display title in car interface */
  title?: string;
  /** Display artist */
  artist?: string;
  /** Artwork URL */
  artworkUrl?: string;
  /** Supported media actions */
  supportedActions?: MediaSessionAction[];
}

export interface MediaBrowseItem {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Subtitle / artist */
  subtitle?: string;
  /** Artwork URL */
  artworkUrl?: string;
  /** Whether this item is playable or a browsable folder */
  playable: boolean;
  /** Children items (for folders) */
  children?: MediaBrowseItem[];
}

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARNING = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

export interface AudioStreamConfig {
  /** Buffer size in KB. Default: 64. Both platforms read this. */
  bufferSize?: number;
  /** Prebuffer threshold in KB — playback starts when this is filled. Default: 16. */
  prebufferThreshold?: number;
  /** Maximum buffer size in KB. Default: 512. Android: ExoPlayer DefaultLoadControl. */
  maxBufferSize?: number;
  
  /** Chunk size in KB for NSURLSession data delegate (iOS). Default: 16. */
  chunkSize?: number;
  /** Protocol hint. HTTP/HTTPS only. Default: HTTPS. */
  protocol?: StreamingProtocol;
  /** Number of automatic reconnect attempts on network error. Default: 3. Both platforms. */
  reconnectAttempts?: number;
  /** Delay between reconnect attempts in ms (exponential backoff). Default: 1000. Both platforms. */
  reconnectDelay?: number;
  /** Connection/read timeout in ms. Default: 30000. Android: OkHttp, iOS: NSURLSession. */
  timeout?: number;
  
  /**
   * Stream format hint. Auto-detected from URL extension or HTTP Content-Type header.
   * Set this only for `playFromData()` where URL detection is unavailable.
   */
  format?: AudioFormat;
  /**
   * Sample rate in Hz. Default: 44100.
   * Android: used in `startRealtimeStream`.
   * iOS: `AVAudioSession.setPreferredSampleRate:`.
   */
  sampleRate?: number;
  /** Number of audio channels. Default: 2. Used in realtime streaming. */
  channels?: number;
  /** Bit rate in kbps. Informational — actual rate depends on stream source. */
  bitRate?: number;
  
  /** Auto-play when stream is ready. Default: true. Both platforms. */
  autoPlay?: boolean;
  /**
   * Enable background audio playback. Default: false.
   * Android: starts ForegroundService with persistent notification.
   * iOS: sets AVAudioSessionCategoryPlayback + UIBackgroundModes audio.
   */
  enableBackgroundMode?: boolean;
  /** Maintain audio focus and duck other apps. Default: true. Both platforms. */
  maintainAudioFocus?: boolean;
  
  /** Enable stream caching. Default: false. Android: SimpleCache, iOS: NSCache. */
  enableCache?: boolean;
  /** Cache size in MB. Default: 100. */
  cacheSize?: number;
  /** Custom cache directory path. Default: platform cache directory. */
  cachePath?: string;
  
  /** Log verbosity. Default: WARNING. */
  logLevel?: LogLevel;
  
  /** Custom HTTP headers for stream requests. Both platforms. */
  headers?: Record<string, string>;
  /** HTTP method. Default: 'GET'. POST is partially supported. */
  method?: 'GET' | 'POST';
  /** Request body for POST method. */
  body?: string | Record<string, any>;
  
  /** @platform ios — Enable recording (uses PlayAndRecord category). Default: false. */
  enableRecording?: boolean;
  /** @platform ios — Enable voice processing mode. Default: false. */
  voiceProcessing?: boolean;
  /** @platform ios — Spoken audio mode for podcasts/audiobooks. Default: false. */
  spokenAudio?: boolean;
  /** @platform ios — Long form audio routing policy. Default: false. */
  longFormAudio?: boolean;
  /** @platform ios — AirPods high quality recording (iOS 26+). Default: false. */
  enableAirPodsHighQuality?: boolean;
  /** @platform ios — AirPlay 2 enhanced buffering. Default: false. */
  enableEnhancedBuffering?: boolean;
  /** @platform ios — Spatial audio support. Default: false. */
  enableSpatialAudio?: boolean;

  /** DRM configuration for protected content */
  drm?: DRMConfig;

  /** Live stream configuration */
  liveStream?: LiveStreamConfig;
}

export interface PlaybackStats {
  bufferedDuration: number; // in seconds
  playedDuration: number; // in seconds
  totalDuration: number; // in seconds (if known)
  networkSpeed: number; // in KB/s
  latency: number; // in ms
  bufferHealth: number; // 0-100 percentage
  droppedFrames: number;
  bitRate: number; // actual bitrate in kbps
  bufferedPosition: number; // End position of buffer in seconds
  currentPosition: number; // Current playback position
  bufferedPercentage: number; // Percentage of total duration buffered
  isBuffering: boolean; // Currently buffering
  playWhenReady: boolean; // Will play when buffer is ready
}

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: string;
  duration?: number; // in seconds
  artwork?: string; // base64 or URL
  [key: string]: any; // Allow custom metadata
}

export interface EqualizerBand {
  frequency: number; // in Hz
  gain: number; // in dB (-12 to +12)
}

export interface EqualizerPreset {
  name: string;
  bands: EqualizerBand[];
}

export interface StreamError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

// Event callbacks
export interface AudioStreamCallbacks {
  onStart?: () => void;
  onBuffer?: (isBuffering: boolean) => void;
  onProgress?: (progress: {
    currentTime: number;
    duration: number;
    percentage: number;
  }) => void;
  onError?: (error: StreamError) => void;
  onEnd?: () => void;
  onStateChange?: (state: PlaybackState) => void;
  onMetadata?: (metadata: AudioMetadata) => void;
  onStats?: (stats: PlaybackStats) => void;
  onNetworkStateChange?: (state: { isConnected: boolean; type?: string }) => void;
  /** Fired when the current track changes in a playlist */
  onTrackChange?: (state: PlaylistState) => void;
  /** Fired when the queue is modified (add, remove, reorder) */
  onQueueUpdate?: (state: PlaylistState) => void;
  /** DRM: License successfully acquired */
  onLicenseAcquired?: () => void;
  /** DRM: License acquisition failed */
  onLicenseError?: (error: StreamError) => void;
  /** DRM: Content key expired */
  onKeyExpired?: () => void;
  /** VAD: Voice activity detected or ended */
  onVoiceActivity?: (isActive: boolean) => void;
  /** VAD: Silence detected (duration exceeded threshold) */
  onSilenceDetected?: () => void;
  /** Recording: Raw PCM audio data chunk (base64 encoded) */
  onAudioData?: (data: { data: string; bytesRead: number }) => void;
  /** Recording: Audio input level changed (0.0-1.0) */
  onRecordingLevel?: (level: number) => void;
}

export interface AudioDeviceInfo {
  portName: string;
  portType: string;
  uid: string;
  hasHardwareVoiceCallProcessing: boolean;
  channels: number;
}

// Main audio stream interface
export interface IAudioStream {
  // Lifecycle methods
  initialize(config?: AudioStreamConfig): Promise<void>;
  destroy(): Promise<void>;
  
  // Streaming methods
  startStream(url: string, config?: AudioStreamConfig): Promise<void>;
  stopStream(): Promise<void>;
  cancelStream(): Promise<void>;
  playFromData(base64Data: string, config?: AudioStreamConfig): Promise<void>;
  appendToBuffer(base64Data: string): Promise<void>;
  
  // Playback control
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(position: number): Promise<void>; // position in seconds
  
  // Volume control
  setVolume(volume: number): Promise<void>; // 0.0 to 1.0
  getVolume(): Promise<number>;
  
  // Playback rate
  setPlaybackRate(rate: number): Promise<void>; // 0.5 to 2.0
  getPlaybackRate(): Promise<number>;

  // Mute control
  mute(): Promise<void>;
  unmute(): Promise<void>;
  isMuted(): Promise<boolean>;

  // Pitch control
  setPitch(pitch: number): Promise<void>; // 0.5 to 2.0
  getPitch(): Promise<number>;
  
  // State queries
  getState(): Promise<PlaybackState>;
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
  getBufferedPercentage(): Promise<number>;
  
  // Statistics
  getStats(): Promise<PlaybackStats>;
  
  // Metadata
  getMetadata(): Promise<AudioMetadata | null>;
  
  // Equalizer
  setEqualizer(bands: EqualizerBand[]): Promise<void>;
  getEqualizer(): Promise<EqualizerBand[]>;
  applyEqualizerPreset(preset: EqualizerPreset | number): Promise<void>;
  getEqualizerPresets(): Promise<EqualizerPreset[]>;
  
  // Event handling
  addEventListener<K extends keyof AudioStreamCallbacks>(
    event: K,
    callback: AudioStreamCallbacks[K]
  ): void;
  
  removeEventListener<K extends keyof AudioStreamCallbacks>(
    event: K,
    callback: AudioStreamCallbacks[K]
  ): void;
  
  removeAllEventListeners(): void;
  
  // Cache management
  clearCache(): Promise<void>;
  getCacheSize(): Promise<number>; // in bytes
  preloadStream(url: string, duration?: number): Promise<void>; // duration in seconds
  
  // Network
  setNetworkPriority(priority: 'low' | 'normal' | 'high'): Promise<void>;
  
  // Platform specific
  requestAudioFocus(): Promise<boolean>;
  abandonAudioFocus(): Promise<void>;
  setAudioSessionCategory(category: string): Promise<void>; // iOS specific
  
  // iOS 26 Features
  showInputPicker(): Promise<void>; // Show native input device picker (iOS 26+)
  getAvailableInputs(): Promise<AudioDeviceInfo[]>; // Get list of available input devices
  enableEnhancedBuffering(enable: boolean): Promise<void>; // Enable AirPlay 2 enhanced buffering
  enableSpatialAudio(enable: boolean): Promise<void>; // Enable spatial audio support
  useQueuePlayer(enable: boolean): Promise<void>; // Use AVQueuePlayer for enhanced features
  createRoutePickerView(): Promise<number>; // Create and return route picker view tag

  // Playlist & Queue
  setPlaylist(items: PlaylistItem[]): Promise<void>;
  addToQueue(item: PlaylistItem, position?: number): Promise<void>;
  removeFromQueue(index: number): Promise<void>;
  moveInQueue(fromIndex: number, toIndex: number): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  skipToIndex(index: number): Promise<void>;
  setShuffle(enabled: boolean): Promise<void>;
  setRepeat(mode: RepeatMode): Promise<void>;
  getPlaylistState(): Promise<PlaylistState>;
  getQueue(): Promise<PlaylistItem[]>;
  clearQueue(): Promise<void>;

  // Live Streaming Advanced
  seekToLiveEdge(): Promise<void>;
  getLiveEdgeOffset(): Promise<number>; // offset in seconds
  getDvrWindow(): Promise<DvrWindow>;
  setTargetLatency(latencyMs: number): Promise<void>;
  getLiveStreamState(): Promise<LiveStreamState>;

  // Recording & Audio Capture
  startRecording(config?: RecordingConfig): Promise<void>;
  stopRecording(): Promise<string>; // returns file path
  getRecordingLevel(): Promise<number>; // 0.0 to 1.0
  getRecordingState(): Promise<RecordingState>;

  // Audio DSP
  enableAEC(enabled: boolean): Promise<void>;
  enableNoiseSuppression(enabled: boolean): Promise<void>;
  enableAGC(enabled: boolean): Promise<void>;
  enableVAD(config?: VADConfig): Promise<void>;
  disableVAD(): Promise<void>;
  setAudioProcessing(config: AudioProcessingConfig): Promise<void>;

  // Audio Encoding & Publishing
  startPublishing(config: PublishConfig): Promise<void>;
  stopPublishing(): Promise<void>;
  getPublishingStats(): Promise<PublishingStats>;

  // CarPlay & Android Auto
  setMediaSessionConfig(config: MediaSessionConfig): Promise<void>;
  getMediaBrowseTree(): Promise<MediaBrowseItem[]>;
}

// Native module interface
export interface AudioStreamNativeModule {
  initialize(config: AudioStreamConfig): Promise<void>;
  destroy(): Promise<void>;
  startStream(url: string, config: AudioStreamConfig): Promise<void>;
  stopStream(): Promise<void>;
  cancelStream(): Promise<void>;
  playFromData(base64Data: string, config: AudioStreamConfig): Promise<void>;
  appendToBuffer(base64Data: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(position: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getVolume(): Promise<number>;
  setPlaybackRate(rate: number): Promise<void>;
  getPlaybackRate(): Promise<number>;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  isMuted(): Promise<boolean>;
  setPitch(pitch: number): Promise<void>;
  getPitch(): Promise<number>;
  getState(): Promise<PlaybackState>;
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
  getBufferedPercentage(): Promise<number>;
  getStats(): Promise<PlaybackStats>;
  getMetadata(): Promise<AudioMetadata | null>;
  setEqualizer(bands: EqualizerBand[]): Promise<void>;
  getEqualizer(): Promise<EqualizerBand[]>;
  clearCache(): Promise<void>;
  getCacheSize(): Promise<number>;
  preloadStream(url: string, duration?: number): Promise<void>;
  setNetworkPriority(priority: string): Promise<void>;
  requestAudioFocus(): Promise<boolean>;
  abandonAudioFocus(): Promise<void>;
  setAudioSessionCategory(category: string): Promise<void>;
  
  // iOS 26 Features
  showInputPicker(): Promise<void>;
  getAvailableInputs(): Promise<AudioDeviceInfo[]>;
  enableEnhancedBuffering(enable: boolean): Promise<void>;
  enableSpatialAudio(enable: boolean): Promise<void>;
  useQueuePlayer(enable: boolean): Promise<void>;
  createRoutePickerView(): Promise<number>;

  // Playlist & Queue
  setPlaylist(items: ReadonlyArray<Object>): Promise<void>;
  addToQueue(item: Object, position: number): Promise<void>;
  removeFromQueue(index: number): Promise<void>;
  moveInQueue(fromIndex: number, toIndex: number): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  skipToIndex(index: number): Promise<void>;
  setShuffle(enabled: boolean): Promise<void>;
  setRepeatMode(mode: string): Promise<void>;
  getPlaylistState(): Promise<Object>;
  getQueue(): Promise<ReadonlyArray<Object>>;
  clearQueue(): Promise<void>;

  // Live Streaming Advanced
  seekToLiveEdge(): Promise<void>;
  getLiveEdgeOffset(): Promise<number>;
  getDvrWindow(): Promise<Object>;
  setTargetLatency(latencyMs: number): Promise<void>;
  getLiveStreamState(): Promise<Object>;

  // Recording & Audio Capture
  startRecording(config: Object): Promise<void>;
  stopRecording(): Promise<string>;
  getRecordingLevel(): Promise<number>;
  getRecordingState(): Promise<string>;

  // Audio DSP
  enableAEC(enabled: boolean): Promise<void>;
  enableNoiseSuppression(enabled: boolean): Promise<void>;
  enableAGC(enabled: boolean): Promise<void>;
  enableVAD(config: Object): Promise<void>;
  disableVAD(): Promise<void>;
  setAudioProcessing(config: Object): Promise<void>;

  // Audio Encoding & Publishing
  startPublishing(config: Object): Promise<void>;
  stopPublishing(): Promise<void>;
  getPublishingStats(): Promise<Object>;

  // CarPlay & Android Auto
  setMediaSessionConfig(config: Object): Promise<void>;
  getMediaBrowseTree(): Promise<Object[]>;
}

// Error codes
export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  DECODE_ERROR: 'DECODE_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  BUFFER_TIMEOUT: 'BUFFER_TIMEOUT',
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR',
  INVALID_STATE: 'INVALID_STATE',
  INVALID_URL: 'INVALID_URL',
  CACHE_ERROR: 'CACHE_ERROR',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// Default configurations
export const DEFAULT_CONFIG: AudioStreamConfig = {
  bufferSize: 64,
  prebufferThreshold: 16,
  maxBufferSize: 512,
  chunkSize: 16,
  protocol: StreamingProtocol.HTTPS,
  reconnectAttempts: 3,
  reconnectDelay: 1000,
  timeout: 30000,
  sampleRate: 44100,
  channels: 2,
  autoPlay: true,
  enableBackgroundMode: false,
  maintainAudioFocus: true,
  enableCache: false,
  cacheSize: 100,
  logLevel: LogLevel.WARNING,
};

// Equalizer presets
export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  {
    name: 'Flat',
    bands: [
      { frequency: 60, gain: 0 },
      { frequency: 230, gain: 0 },
      { frequency: 910, gain: 0 },
      { frequency: 3600, gain: 0 },
      { frequency: 14000, gain: 0 },
    ],
  },
  {
    name: 'Bass Boost',
    bands: [
      { frequency: 60, gain: 6 },
      { frequency: 230, gain: 4 },
      { frequency: 910, gain: 0 },
      { frequency: 3600, gain: 0 },
      { frequency: 14000, gain: 0 },
    ],
  },
  {
    name: 'Treble Boost',
    bands: [
      { frequency: 60, gain: 0 },
      { frequency: 230, gain: 0 },
      { frequency: 910, gain: 0 },
      { frequency: 3600, gain: 4 },
      { frequency: 14000, gain: 6 },
    ],
  },
  {
    name: 'Vocal',
    bands: [
      { frequency: 60, gain: -2 },
      { frequency: 230, gain: 0 },
      { frequency: 910, gain: 4 },
      { frequency: 3600, gain: 4 },
      { frequency: 14000, gain: 0 },
    ],
  },
  {
    name: 'Rock',
    bands: [
      { frequency: 60, gain: 5 },
      { frequency: 230, gain: 3 },
      { frequency: 910, gain: -1 },
      { frequency: 3600, gain: 3 },
      { frequency: 14000, gain: 5 },
    ],
  },
  {
    name: 'Pop',
    bands: [
      { frequency: 60, gain: -1 },
      { frequency: 230, gain: 2 },
      { frequency: 910, gain: 4 },
      { frequency: 3600, gain: 3 },
      { frequency: 14000, gain: -1 },
    ],
  },
  {
    name: 'Jazz',
    bands: [
      { frequency: 60, gain: 3 },
      { frequency: 230, gain: 0 },
      { frequency: 910, gain: -2 },
      { frequency: 3600, gain: 2 },
      { frequency: 14000, gain: 3 },
    ],
  },
  {
    name: 'Dance',
    bands: [
      { frequency: 60, gain: 6 },
      { frequency: 230, gain: 0 },
      { frequency: 910, gain: 2 },
      { frequency: 3600, gain: 4 },
      { frequency: 14000, gain: 0 },
    ],
  },
  {
    name: 'Classical',
    bands: [
      { frequency: 60, gain: 0 },
      { frequency: 230, gain: 0 },
      { frequency: 910, gain: 0 },
      { frequency: 3600, gain: -3 },
      { frequency: 14000, gain: -3 },
    ],
  },
]; 