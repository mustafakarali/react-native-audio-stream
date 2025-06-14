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

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARNING = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

export interface AudioStreamConfig {
  // Buffer configuration
  bufferSize?: number; // in KB, default: 64
  prebufferThreshold?: number; // in KB, default: 16
  maxBufferSize?: number; // in KB, default: 512
  
  // Stream configuration
  chunkSize?: number; // in KB, default: 16
  protocol?: StreamingProtocol;
  reconnectAttempts?: number; // default: 3
  reconnectDelay?: number; // in ms, default: 1000
  timeout?: number; // in ms, default: 30000
  
  // Audio configuration
  format?: AudioFormat;
  sampleRate?: number; // default: 44100
  channels?: number; // default: 2
  bitRate?: number; // in kbps
  
  // Playback configuration
  autoPlay?: boolean; // default: true
  enableBackgroundMode?: boolean; // default: false
  maintainAudioFocus?: boolean; // default: true
  
  // Cache configuration
  enableCache?: boolean; // default: false
  cacheSize?: number; // in MB, default: 100
  cachePath?: string;
  
  // Logging
  logLevel?: LogLevel;
  
  // Headers for HTTP requests
  headers?: Record<string, string>;
  
  // iOS 26 Features
  enableRecording?: boolean; // default: false
  voiceProcessing?: boolean; // default: false
  spokenAudio?: boolean; // default: false - for podcasts, audiobooks
  longFormAudio?: boolean; // default: false - enables long form audio routing policy
  enableAirPodsHighQuality?: boolean; // default: false - iOS 26 AirPods high quality recording
  enableEnhancedBuffering?: boolean; // default: false - AirPlay 2 enhanced buffering
  enableSpatialAudio?: boolean; // default: false - spatial audio support
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
}

// Native module interface
export interface AudioStreamNativeModule {
  initialize(config: AudioStreamConfig): Promise<void>;
  destroy(): Promise<void>;
  startStream(url: string, config: AudioStreamConfig): Promise<void>;
  stopStream(): Promise<void>;
  cancelStream(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(position: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getVolume(): Promise<number>;
  setPlaybackRate(rate: number): Promise<void>;
  getPlaybackRate(): Promise<number>;
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
  CACHE_ERROR: 'CACHE_ERROR',
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