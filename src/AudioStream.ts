import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

import {
  IAudioStream,
  AudioStreamConfig,
  AudioStreamCallbacks,
  PlaybackState,
  PlaybackStats,
  AudioMetadata,
  EqualizerBand,
  EqualizerPreset,
  StreamError,
  DEFAULT_CONFIG,
  EQUALIZER_PRESETS,
  ErrorCodes,
  AudioDeviceInfo,
  WebSocketStreamConfig,
  PlaylistItem,
  PlaylistState,
  RepeatMode,
  DvrWindow,
  LiveStreamState,
  RecordingConfig,
  RecordingState,
  AudioProcessingConfig,
  VADConfig,
  PublishConfig,
  PublishingStats,
  MediaSessionConfig,
  MediaBrowseItem,
} from './types';
import { logger } from './logger';

// Support both old and new architecture
const RNAudioStream = NativeModules.RNAudioStream;

export class AudioStream implements IAudioStream {
  private static instance: AudioStream | null = null;
  private eventEmitter: NativeEventEmitter;
  private eventListeners: Map<keyof AudioStreamCallbacks, Set<Function>> = new Map();
  private nativeEventSubscriptions: any[] = [];
  private config: AudioStreamConfig = DEFAULT_CONFIG;
  private currentUrl: string | null = null;
  private isInitialized = false;

  private constructor() {
    if (!RNAudioStream) {
      throw new Error(
        'RNAudioStream native module is not available. Please ensure the library is properly linked.'
      );
    }

    this.eventEmitter = new NativeEventEmitter(RNAudioStream);
    this.setupNativeEventListeners();
  }

  static getInstance(): AudioStream {
    if (!AudioStream.instance) {
      AudioStream.instance = new AudioStream();
    }
    return AudioStream.instance;
  }

  private setupNativeEventListeners(): void {
    // Map native events to callbacks
    const eventMappings: Array<[string, keyof AudioStreamCallbacks, (data: any) => any]> = [
      ['onStreamStart', 'onStart', () => undefined],
      ['onStreamBuffer', 'onBuffer', (data) => data.isBuffering],
      ['onStreamProgress', 'onProgress', (data) => ({
        currentTime: data.currentTime,
        duration: data.duration,
        percentage: data.percentage,
      })],
      ['onStreamError', 'onError', (data) => ({
        code: data.code,
        message: data.message,
        details: data.details,
        recoverable: data.recoverable,
      })],
      ['onStreamEnd', 'onEnd', () => undefined],
      ['onStreamStateChange', 'onStateChange', (data) => data.state],
      ['onStreamMetadata', 'onMetadata', (data) => data.metadata],
      ['onStreamStats', 'onStats', (data) => data.stats],
      ['onNetworkStateChange', 'onNetworkStateChange', (data) => ({
        isConnected: data.isConnected,
        type: data.type || undefined,
      })],
      ['onTrackChange', 'onTrackChange', (data) => data as PlaylistState],
      ['onQueueUpdate', 'onQueueUpdate', (data) => data as PlaylistState],
      // DRM events
      ['onLicenseAcquired', 'onLicenseAcquired', () => undefined],
      ['onLicenseError', 'onLicenseError', (data) => ({
        code: data.code || 'DRM_ERROR',
        message: data.message || 'License error',
        details: data.details,
        recoverable: data.recoverable ?? false,
      })],
      ['onKeyExpired', 'onKeyExpired', () => undefined],
      // VAD events
      ['onVoiceActivity', 'onVoiceActivity', (data) => data.isActive],
      ['onSilenceDetected', 'onSilenceDetected', () => undefined],
      // Recording events
      ['onAudioData', 'onAudioData', (data) => ({ data: data.data, bytesRead: data.bytesRead })],
      ['onRecordingLevel', 'onRecordingLevel', (data) => data.level],
    ];

    eventMappings.forEach(([nativeEvent, callbackKey, transformer]) => {
      const subscription = this.eventEmitter.addListener(nativeEvent, (data: any) => {
        logger.verbose(`Native event received: ${nativeEvent}`, data);
        const listeners = this.eventListeners.get(callbackKey);
        if (listeners) {
          const transformedData = transformer(data);
          listeners.forEach((listener) => {
            try {
              listener(transformedData);
            } catch (error) {
              logger.error(`Error in event listener ${callbackKey}:`, error);
            }
          });
        }
      });
      this.nativeEventSubscriptions.push(subscription);
    });
  }

  async initialize(config?: AudioStreamConfig): Promise<void> {
    if (this.isInitialized) {
      logger.warn('AudioStream is already initialized, skipping...');
      return;
    }
    
    try {
      logger.info('Initializing AudioStream');
      this.config = { ...DEFAULT_CONFIG, ...config };
      
      if (config?.logLevel !== undefined) {
        logger.setLogLevel(config.logLevel);
      }

      await RNAudioStream.initialize(this.config);
      this.isInitialized = true;
      logger.info('AudioStream initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AudioStream:', error);
      throw this.createError(ErrorCodes.INITIALIZATION_ERROR, 'Failed to initialize audio stream', error);
    }
  }

  async destroy(): Promise<void> {
    try {
      logger.info('Destroying AudioStream');
      
      // Clean up event subscriptions
      this.nativeEventSubscriptions.forEach((subscription) => subscription.remove());
      this.nativeEventSubscriptions = [];
      this.eventListeners.clear();

      await RNAudioStream.destroy();
      this.isInitialized = false;
      this.currentUrl = null;
      
      logger.info('AudioStream destroyed successfully');
    } catch (error) {
      logger.error('Failed to destroy AudioStream:', error);
      throw error;
    }
  }

  async startStream(url: string, config?: AudioStreamConfig): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info(`Starting stream: ${url}`);
      const streamConfig = { ...this.config, ...config };
      
      logger.time('startStream');
      await RNAudioStream.startStream(url, streamConfig);
      logger.timeEnd('startStream');
      
      this.currentUrl = url;
      logger.info('Stream started successfully');
    } catch (error) {
      logger.error('Failed to start stream:', error);
      throw this.createError(ErrorCodes.NETWORK_ERROR, 'Failed to start stream', error);
    }
  }

  async stopStream(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info('Stopping stream');
      await RNAudioStream.stopStream();
      this.currentUrl = null;
      // Note: we intentionally do NOT remove user event listeners here.
      // Users may want to re-use their listeners for the next stream.
      // They can call removeAllEventListeners() explicitly if needed.
    } catch (error) {
      logger.error('Failed to stop stream:', error);
      throw error;
    }
  }

  async play(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug('Playing');
      await RNAudioStream.play();
      logger.logPlaybackEvent('play');
    } catch (error) {
      logger.error('Failed to play:', error);
      throw this.createError(ErrorCodes.INVALID_STATE, 'Failed to play', error);
    }
  }

  async pause(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug('Pausing');
      await RNAudioStream.pause();
      logger.logPlaybackEvent('pause');
    } catch (error) {
      logger.error('Failed to pause:', error);
      throw this.createError(ErrorCodes.INVALID_STATE, 'Failed to pause', error);
    }
  }

  async stop(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug('Stopping');
      await RNAudioStream.stop();
      logger.logPlaybackEvent('stop');
    } catch (error) {
      logger.error('Failed to stop:', error);
      throw error;
    }
  }

  async cancelStream(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info('Cancelling stream');
      await RNAudioStream.cancelStream();
      this.currentUrl = null;
      logger.info('Stream cancelled successfully');
    } catch (error) {
      logger.error('Failed to cancel stream:', error);
      throw error;
    }
  }

  async seek(position: number): Promise<void> {
    this.ensureInitialized();
    
    if (position < 0) {
      throw new Error('Seek position cannot be negative');
    }
    
    try {
      logger.debug(`Seeking to ${position}s`);
      await RNAudioStream.seek(position);
      logger.logPlaybackEvent('seek', { position });
    } catch (error) {
      logger.error('Failed to seek:', error);
      throw this.createError(ErrorCodes.INVALID_STATE, 'Failed to seek', error);
    }
  }

  async setVolume(volume: number): Promise<void> {
    this.ensureInitialized();
    
    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0.0 and 1.0');
    }
    
    try {
      logger.debug(`Setting volume to ${volume}`);
      await RNAudioStream.setVolume(volume);
    } catch (error) {
      logger.error('Failed to set volume:', error);
      throw error;
    }
  }

  async getVolume(): Promise<number> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getVolume();
    } catch (error) {
      logger.error('Failed to get volume:', error);
      throw error;
    }
  }

  async setPlaybackRate(rate: number): Promise<void> {
    this.ensureInitialized();
    
    if (rate < 0.5 || rate > 2.0) {
      throw new Error('Playback rate must be between 0.5 and 2.0');
    }
    
    try {
      logger.debug(`Setting playback rate to ${rate}`);
      await RNAudioStream.setPlaybackRate(rate);
      logger.logPlaybackEvent('playbackRateChange', { rate });
    } catch (error) {
      logger.error('Failed to set playback rate:', error);
      throw error;
    }
  }

  async getPlaybackRate(): Promise<number> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getPlaybackRate();
    } catch (error) {
      logger.error('Failed to get playback rate:', error);
      throw error;
    }
  }

  async mute(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug('Muting');
      await RNAudioStream.mute();
      logger.logPlaybackEvent('mute');
    } catch (error) {
      logger.error('Failed to mute:', error);
      throw error;
    }
  }

  async unmute(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug('Unmuting');
      await RNAudioStream.unmute();
      logger.logPlaybackEvent('unmute');
    } catch (error) {
      logger.error('Failed to unmute:', error);
      throw error;
    }
  }

  async isMuted(): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.isMuted();
    } catch (error) {
      logger.error('Failed to get mute state:', error);
      throw error;
    }
  }

  async setPitch(pitch: number): Promise<void> {
    this.ensureInitialized();
    
    if (pitch < 0.5 || pitch > 2.0) {
      throw new Error('Pitch must be between 0.5 and 2.0');
    }
    
    try {
      logger.debug(`Setting pitch to ${pitch}`);
      await RNAudioStream.setPitch(pitch);
      logger.logPlaybackEvent('pitchChange', { pitch });
    } catch (error) {
      logger.error('Failed to set pitch:', error);
      throw error;
    }
  }

  async getPitch(): Promise<number> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getPitch();
    } catch (error) {
      logger.error('Failed to get pitch:', error);
      throw error;
    }
  }

  async getState(): Promise<PlaybackState> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getState();
    } catch (error) {
      logger.error('Failed to get state:', error);
      throw error;
    }
  }

  async getCurrentTime(): Promise<number> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getCurrentTime();
    } catch (error) {
      logger.error('Failed to get current time:', error);
      throw error;
    }
  }

  async getDuration(): Promise<number> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getDuration();
    } catch (error) {
      logger.error('Failed to get duration:', error);
      throw error;
    }
  }

  async getBufferedPercentage(): Promise<number> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getBufferedPercentage();
    } catch (error) {
      logger.error('Failed to get buffered percentage:', error);
      throw error;
    }
  }

  async getStats(): Promise<PlaybackStats> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getStats();
    } catch (error) {
      logger.error('Failed to get stats:', error);
      throw error;
    }
  }

  async getMetadata(): Promise<AudioMetadata | null> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getMetadata();
    } catch (error) {
      logger.error('Failed to get metadata:', error);
      throw error;
    }
  }

  async setEqualizer(bands: EqualizerBand[]): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug('Setting equalizer', bands);
      await RNAudioStream.setEqualizer(bands);
    } catch (error) {
      logger.error('Failed to set equalizer:', error);
      throw error;
    }
  }

  async getEqualizer(): Promise<EqualizerBand[]> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getEqualizer();
    } catch (error) {
      logger.error('Failed to get equalizer:', error);
      throw error;
    }
  }

  async applyEqualizerPreset(preset: EqualizerPreset | number): Promise<void> {
    this.ensureInitialized();
    
    try {
      let equalizerPreset: EqualizerPreset;
      
      if (typeof preset === 'number') {
        // If preset is a number (index), get the preset from the list
        if (preset < 0 || preset >= EQUALIZER_PRESETS.length) {
          throw new Error(`Invalid preset index: ${preset}. Must be between 0 and ${EQUALIZER_PRESETS.length - 1}`);
        }
        equalizerPreset = EQUALIZER_PRESETS[preset]!;
        logger.info(`Applying equalizer preset by index: ${preset} (${equalizerPreset.name})`);
      } else {
        // If preset is an object
        equalizerPreset = preset;
        logger.info(`Applying equalizer preset: ${equalizerPreset.name}`);
      }
      
      await this.setEqualizer(equalizerPreset.bands);
    } catch (error) {
      logger.error('Failed to apply equalizer preset:', error);
      throw error;
    }
  }

  async getEqualizerPresets(): Promise<EqualizerPreset[]> {
    return EQUALIZER_PRESETS;
  }

  addEventListener<K extends keyof AudioStreamCallbacks>(
    event: K,
    callback: AudioStreamCallbacks[K]
  ): void {
    if (!callback) return;
    
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)!.add(callback as Function);
    logger.verbose(`Added event listener for ${event}`);
  }

  removeEventListener<K extends keyof AudioStreamCallbacks>(
    event: K,
    callback: AudioStreamCallbacks[K]
  ): void {
    if (!callback) return;
    
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback as Function);
      logger.verbose(`Removed event listener for ${event}`);
    }
  }

  removeAllEventListeners(): void {
    this.eventListeners.clear();
    logger.verbose('Removed all event listeners');
  }

  async clearCache(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info('Clearing cache');
      await RNAudioStream.clearCache();
      logger.info('Cache cleared successfully');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      throw this.createError(ErrorCodes.CACHE_ERROR, 'Failed to clear cache', error);
    }
  }

  async getCacheSize(): Promise<number> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getCacheSize();
    } catch (error) {
      logger.error('Failed to get cache size:', error);
      throw error;
    }
  }

  async preloadStream(url: string, duration?: number): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info(`Preloading stream: ${url}, duration: ${duration}s`);
      await RNAudioStream.preloadStream(url, duration);
      logger.info('Stream preloaded successfully');
    } catch (error) {
      logger.error('Failed to preload stream:', error);
      throw this.createError(ErrorCodes.NETWORK_ERROR, 'Failed to preload stream', error);
    }
  }

  async setNetworkPriority(priority: 'low' | 'normal' | 'high'): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Setting network priority to ${priority}`);
      await RNAudioStream.setNetworkPriority(priority);
    } catch (error) {
      logger.error('Failed to set network priority:', error);
      throw error;
    }
  }

  async requestAudioFocus(): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      logger.debug('Requesting audio focus');
      const granted = await RNAudioStream.requestAudioFocus();
      logger.debug(`Audio focus ${granted ? 'granted' : 'denied'}`);
      return granted;
    } catch (error) {
      logger.error('Failed to request audio focus:', error);
      throw error;
    }
  }

  async abandonAudioFocus(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug('Abandoning audio focus');
      await RNAudioStream.abandonAudioFocus();
    } catch (error) {
      logger.error('Failed to abandon audio focus:', error);
      throw error;
    }
  }

  async setAudioSessionCategory(category: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug(`Setting audio session category to ${category}`);
      await RNAudioStream.setAudioSessionCategory(category);
    } catch (error) {
      logger.error('Failed to set audio session category:', error);
      throw error;
    }
  }

  // iOS 26 Features
  async showInputPicker(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info('Showing input picker');
      await RNAudioStream.showInputPicker();
      logger.info('Input picker shown successfully');
    } catch (error) {
      logger.error('Failed to show input picker:', error);
      throw this.createError(ErrorCodes.UNSUPPORTED_FORMAT, 'Failed to show input picker', error);
    }
  }

  async getAvailableInputs(): Promise<AudioDeviceInfo[]> {
    this.ensureInitialized();
    
    try {
      logger.debug('Getting available inputs');
      const inputs = await RNAudioStream.getAvailableInputs();
      logger.debug(`Found ${inputs.length} available inputs`);
      return inputs;
    } catch (error) {
      logger.error('Failed to get available inputs:', error);
      throw error;
    }
  }

  async enableEnhancedBuffering(enable: boolean): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info(`${enable ? 'Enabling' : 'Disabling'} enhanced buffering`);
      await RNAudioStream.enableEnhancedBuffering(enable);
      logger.info(`Enhanced buffering ${enable ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      logger.error('Failed to set enhanced buffering:', error);
      throw error;
    }
  }

  async enableSpatialAudio(enable: boolean): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info(`${enable ? 'Enabling' : 'Disabling'} spatial audio`);
      await RNAudioStream.enableSpatialAudio(enable);
      logger.info(`Spatial audio ${enable ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      logger.error('Failed to set spatial audio:', error);
      throw error;
    }
  }

  async useQueuePlayer(enable: boolean): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info(`${enable ? 'Using' : 'Not using'} queue player`);
      await RNAudioStream.useQueuePlayer(enable);
      logger.info(`Queue player ${enable ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      logger.error('Failed to set queue player:', error);
      throw error;
    }
  }

  async createRoutePickerView(): Promise<number> {
    this.ensureInitialized();
    
    try {
      logger.info('Creating route picker view');
      const viewTag = await RNAudioStream.createRoutePickerView();
      logger.info(`Route picker view created with tag: ${viewTag}`);
      return viewTag;
    } catch (error) {
      logger.error('Failed to create route picker view:', error);
      throw error;
    }
  }

  async playFromData(base64Data: string, config?: AudioStreamConfig): Promise<void> {
    this.ensureInitialized();
    
    try {
      const mergedConfig = { ...this.config, ...config };
      
      logger.info('Playing from binary data');
      logger.debug('Data size:', base64Data.length, 'characters');
      
      await RNAudioStream.playFromData(base64Data, mergedConfig);
      // Native event listeners are already set up in constructor —
      // do NOT call setupNativeEventListeners() again (causes listener leak).
    } catch (error) {
      logger.error('Failed to play from data:', error);
      throw error;
    }
  }

  async appendToBuffer(base64Data: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug('Appending to buffer, size:', base64Data.length, 'characters');
      await RNAudioStream.appendToBuffer(base64Data);
    } catch (error) {
      logger.error('Failed to append to buffer:', error);
      throw error;
    }
  }

  // Real-time streaming methods (both platforms)
  async startRealtimeStream(config?: AudioStreamConfig): Promise<void> {
    this.ensureInitialized();
    
    try {
      const mergedConfig = { ...this.config, ...config };
      logger.info('Starting real-time stream');
      
      await RNAudioStream.startRealtimeStream(mergedConfig);
      // Native event listeners are already set up in constructor —
      // do NOT call setupNativeEventListeners() again (causes listener leak).
    } catch (error) {
      logger.error('Failed to start real-time stream:', error);
      throw error;
    }
  }

  async appendRealtimeData(base64Data: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.debug('Appending real-time data, size:', base64Data.length, 'characters');
      await RNAudioStream.appendRealtimeData(base64Data);
    } catch (error) {
      logger.error('Failed to append real-time data:', error);
      throw error;
    }
  }

  async completeRealtimeStream(): Promise<void> {
    this.ensureInitialized();
    
    try {
      logger.info('Completing real-time stream');
      await RNAudioStream.completeRealtimeStream();
    } catch (error) {
      logger.error('Failed to complete real-time stream:', error);
      throw error;
    }
  }

  async getStreamingStats(): Promise<{
    bytesWritten: number;
    bytesRead: number;
    isActive: boolean;
    isReady: boolean;
  }> {
    this.ensureInitialized();
    
    try {
      return await RNAudioStream.getStreamingStats();
    } catch (error) {
      logger.error('Failed to get streaming stats:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      const err = new Error('AudioStream is not initialized. Call initialize() first.') as Error & { code: string };
      err.code = ErrorCodes.INITIALIZATION_ERROR;
      throw err;
    }
  }

  private createError(code: string, message: string, originalError?: any): StreamError {
    return {
      code,
      message,
      details: originalError,
      recoverable: code === ErrorCodes.NETWORK_ERROR || code === ErrorCodes.BUFFER_TIMEOUT,
    };
  }

  /**
   * Start memory-based streaming (Android only)
   * @platform android
   */
  static async startMemoryStream(config?: AudioStreamConfig): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('Memory streaming is only available on Android');
    }
    return RNAudioStream.startMemoryStream(config || { autoPlay: true });
  }

  /**
   * Append audio chunk to memory stream (Android only)
   * @platform android
   */
  static async appendToMemoryStream(base64Data: string): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('Memory streaming is only available on Android');
    }
    return RNAudioStream.appendToMemoryStream(base64Data);
  }

  /**
   * Complete memory stream (Android only)
   * @platform android
   */
  static async completeMemoryStream(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      throw new Error('Memory streaming is only available on Android');
    }
    return RNAudioStream.completeMemoryStream();
  }

  // ─── WebSocket Streaming ───

  /**
   * Start a WebSocket audio stream.
   * Connects to the WebSocket server and plays incoming binary audio data in real-time.
   * Both iOS (NSURLSessionWebSocketTask) and Android (OkHttp WebSocket) are supported.
   *
   * @param config - WebSocket stream configuration
   */
  async startWebSocketStream(config: WebSocketStreamConfig): Promise<void> {
    if (!this.isInitialized) {
      throw this.createError(
        ErrorCodes.INITIALIZATION_ERROR,
        'AudioStream must be initialized before starting WebSocket stream'
      );
    }

    if (!config.url) {
      throw this.createError(ErrorCodes.INVALID_URL, 'WebSocket URL is required');
    }

    const wsConfig = {
      url: config.url,
      protocols: config.protocols || [],
      headers: config.headers || {},
      audioFormat: config.audioFormat || 'pcm',
      sampleRate: config.sampleRate || 44100,
      channels: config.channels || 1,
      autoPlay: config.autoPlay !== false,
      autoReconnect: config.autoReconnect !== false,
      reconnectAttempts: config.reconnectAttempts || this.config.reconnectAttempts || 3,
      reconnectDelay: config.reconnectDelay || this.config.reconnectDelay || 1000,
    };

    logger.info('Starting WebSocket stream:', wsConfig.url);
    await RNAudioStream.startWebSocketStream(wsConfig);
  }

  /**
   * Stop the active WebSocket audio stream.
   * Closes the WebSocket connection and stops audio playback.
   */
  async stopWebSocketStream(): Promise<void> {
    logger.info('Stopping WebSocket stream');
    await RNAudioStream.stopWebSocketStream();
  }

  /**
   * Send a message to the WebSocket server.
   * Useful for bi-directional communication (e.g., VoIP signaling, control messages).
   *
   * @param data - String data to send
   */
  async sendWebSocketMessage(data: string): Promise<void> {
    await RNAudioStream.sendWebSocketMessage(data);
  }

  // ─── Playlist & Queue Management ───

  /**
   * Set the playlist with an array of tracks.
   * Replaces the current queue and starts playing from index 0.
   */
  async setPlaylist(items: PlaylistItem[]): Promise<void> {
    this.ensureInitialized();
    if (!items || items.length === 0) {
      throw this.createError(ErrorCodes.INVALID_STATE, 'Playlist must contain at least one item');
    }
    // Generate IDs for items that don't have one
    const itemsWithIds = items.map((item, i) => ({
      ...item,
      id: item.id || `track-${Date.now()}-${i}`,
    }));
    logger.info(`Setting playlist with ${itemsWithIds.length} items`);
    await RNAudioStream.setPlaylist(itemsWithIds);
  }

  /**
   * Add a track to the queue at the specified position.
   * @param item - Track to add
   * @param position - Insert position (default: end of queue)
   */
  async addToQueue(item: PlaylistItem, position?: number): Promise<void> {
    this.ensureInitialized();
    const itemWithId = {
      ...item,
      id: item.id || `track-${Date.now()}`,
    };
    logger.info(`Adding to queue at position ${position ?? 'end'}:`, itemWithId.url);
    await RNAudioStream.addToQueue(itemWithId, position ?? -1);
  }

  /**
   * Remove a track from the queue by index.
   */
  async removeFromQueue(index: number): Promise<void> {
    this.ensureInitialized();
    logger.info(`Removing from queue at index ${index}`);
    await RNAudioStream.removeFromQueue(index);
  }

  /**
   * Move a track within the queue.
   */
  async moveInQueue(fromIndex: number, toIndex: number): Promise<void> {
    this.ensureInitialized();
    logger.info(`Moving in queue: ${fromIndex} → ${toIndex}`);
    await RNAudioStream.moveInQueue(fromIndex, toIndex);
  }

  /**
   * Skip to the next track in the queue.
   */
  async skipToNext(): Promise<void> {
    this.ensureInitialized();
    logger.info('Skipping to next track');
    await RNAudioStream.skipToNext();
  }

  /**
   * Skip to the previous track in the queue.
   */
  async skipToPrevious(): Promise<void> {
    this.ensureInitialized();
    logger.info('Skipping to previous track');
    await RNAudioStream.skipToPrevious();
  }

  /**
   * Skip to a specific track by index.
   */
  async skipToIndex(index: number): Promise<void> {
    this.ensureInitialized();
    logger.info(`Skipping to index ${index}`);
    await RNAudioStream.skipToIndex(index);
  }

  /**
   * Enable or disable shuffle mode.
   */
  async setShuffle(enabled: boolean): Promise<void> {
    this.ensureInitialized();
    logger.info(`Shuffle ${enabled ? 'enabled' : 'disabled'}`);
    await RNAudioStream.setShuffle(enabled);
  }

  /**
   * Set repeat mode: none, one (repeat current track), or all (repeat entire queue).
   */
  async setRepeat(mode: RepeatMode): Promise<void> {
    this.ensureInitialized();
    logger.info(`Repeat mode set to: ${mode}`);
    await RNAudioStream.setRepeatMode(mode);
  }

  /**
   * Get the current playlist state (current index, shuffle, repeat, track info).
   */
  async getPlaylistState(): Promise<PlaylistState> {
    this.ensureInitialized();
    return await RNAudioStream.getPlaylistState() as unknown as PlaylistState;
  }

  /**
   * Get the full queue of tracks.
   */
  async getQueue(): Promise<PlaylistItem[]> {
    this.ensureInitialized();
    return await RNAudioStream.getQueue() as unknown as PlaylistItem[];
  }

  /**
   * Clear the entire queue and stop playback.
   */
  async clearQueue(): Promise<void> {
    this.ensureInitialized();
    logger.info('Clearing queue');
    await RNAudioStream.clearQueue();
  }

  // ─── Live Streaming Advanced ───

  /**
   * Seek to the live edge of the current live stream.
   * Throws if the current stream is not a live stream.
   */
  async seekToLiveEdge(): Promise<void> {
    this.ensureInitialized();
    logger.info('Seeking to live edge');
    await RNAudioStream.seekToLiveEdge();
  }

  /**
   * Get the current offset from the live edge in seconds.
   * Returns 0 if at the live edge, positive value if behind.
   */
  async getLiveEdgeOffset(): Promise<number> {
    this.ensureInitialized();
    return await RNAudioStream.getLiveEdgeOffset();
  }

  /**
   * Get the DVR (seekable) window of the current live stream.
   * Returns start, end, and duration in seconds.
   */
  async getDvrWindow(): Promise<DvrWindow> {
    this.ensureInitialized();
    return await RNAudioStream.getDvrWindow() as unknown as DvrWindow;
  }

  /**
   * Set the target latency for LL-HLS/LL-DASH streams.
   * @param latencyMs - Target latency in milliseconds
   */
  async setTargetLatency(latencyMs: number): Promise<void> {
    this.ensureInitialized();
    if (latencyMs < 0) {
      throw new Error('Target latency must be non-negative');
    }
    logger.info(`Setting target latency to ${latencyMs}ms`);
    await RNAudioStream.setTargetLatency(latencyMs);
  }

  /**
   * Get the current live stream state including isLive, offset, DVR window size.
   */
  async getLiveStreamState(): Promise<LiveStreamState> {
    this.ensureInitialized();
    return await RNAudioStream.getLiveStreamState() as unknown as LiveStreamState;
  }

  // ─── Recording & Audio Capture ───

  /**
   * Start audio recording from microphone.
   * @param config - Recording configuration (sampleRate, channels, format, source)
   */
  async startRecording(config?: RecordingConfig): Promise<void> {
    this.ensureInitialized();

    try {
      const recordingConfig = config || {};
      logger.info('Starting recording', recordingConfig);
      await RNAudioStream.startRecording(recordingConfig);
      logger.logPlaybackEvent('recordingStart', recordingConfig);
    } catch (error) {
      logger.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop audio recording.
   * @returns Path to the recorded audio file
   */
  async stopRecording(): Promise<string> {
    this.ensureInitialized();

    try {
      logger.info('Stopping recording');
      const filePath = await RNAudioStream.stopRecording();
      logger.logPlaybackEvent('recordingStop', { filePath });
      return filePath;
    } catch (error) {
      logger.error('Failed to stop recording:', error);
      throw error;
    }
  }

  /**
   * Get the current audio input level (0.0 to 1.0).
   */
  async getRecordingLevel(): Promise<number> {
    this.ensureInitialized();

    try {
      return await RNAudioStream.getRecordingLevel();
    } catch (error) {
      logger.error('Failed to get recording level:', error);
      throw error;
    }
  }

  /**
   * Get the current recording state.
   */
  async getRecordingState(): Promise<RecordingState> {
    this.ensureInitialized();

    try {
      return await RNAudioStream.getRecordingState() as RecordingState;
    } catch (error) {
      logger.error('Failed to get recording state:', error);
      throw error;
    }
  }

  // ─── Audio DSP ───

  /**
   * Enable/disable Acoustic Echo Cancellation.
   * Android: AcousticEchoCanceler. iOS: voiceProcessingIO.
   */
  async enableAEC(enabled: boolean): Promise<void> {
    this.ensureInitialized();
    logger.info(`AEC ${enabled ? 'enabled' : 'disabled'}`);
    await RNAudioStream.enableAEC(enabled);
  }

  /**
   * Enable/disable Noise Suppression.
   * Android: NoiseSuppressor. iOS: voiceProcessingIO.
   */
  async enableNoiseSuppression(enabled: boolean): Promise<void> {
    this.ensureInitialized();
    logger.info(`Noise suppression ${enabled ? 'enabled' : 'disabled'}`);
    await RNAudioStream.enableNoiseSuppression(enabled);
  }

  /**
   * Enable/disable Automatic Gain Control.
   * Android: AutomaticGainControl. iOS: voiceProcessingIO.
   */
  async enableAGC(enabled: boolean): Promise<void> {
    this.ensureInitialized();
    logger.info(`AGC ${enabled ? 'enabled' : 'disabled'}`);
    await RNAudioStream.enableAGC(enabled);
  }

  /**
   * Enable Voice Activity Detection with optional configuration.
   * Emits 'onVoiceActivity' and 'onSilenceDetected' events.
   */
  async enableVAD(config?: VADConfig): Promise<void> {
    this.ensureInitialized();
    logger.info('Enabling VAD', config);
    await RNAudioStream.enableVAD(config || {});
  }

  /**
   * Disable Voice Activity Detection.
   */
  async disableVAD(): Promise<void> {
    this.ensureInitialized();
    logger.info('Disabling VAD');
    await RNAudioStream.disableVAD();
  }

  /**
   * Set all audio processing options at once.
   */
  async setAudioProcessing(config: AudioProcessingConfig): Promise<void> {
    this.ensureInitialized();
    logger.info('Setting audio processing', config);
    await RNAudioStream.setAudioProcessing(config);
  }

  // ─── Audio Encoding & Publishing ───

  /**
   * Start publishing audio to a server.
   * Supports RTMP, SRT, WebRTC, and HTTP protocols.
   * @param config - Publishing configuration (url, protocol, encoder settings)
   */
  async startPublishing(config: PublishConfig): Promise<void> {
    this.ensureInitialized();

    if (!config.url) {
      throw new Error('Publishing URL is required');
    }
    if (!config.protocol) {
      throw new Error('Publishing protocol is required');
    }

    try {
      logger.info(`Starting publishing to ${config.url} via ${config.protocol}`);
      await RNAudioStream.startPublishing(config);
      logger.logPlaybackEvent('publishingStart', { url: config.url, protocol: config.protocol });
    } catch (error) {
      logger.error('Failed to start publishing:', error);
      throw error;
    }
  }

  /**
   * Stop publishing audio.
   */
  async stopPublishing(): Promise<void> {
    this.ensureInitialized();

    try {
      logger.info('Stopping publishing');
      await RNAudioStream.stopPublishing();
      logger.logPlaybackEvent('publishingStop', {});
    } catch (error) {
      logger.error('Failed to stop publishing:', error);
      throw error;
    }
  }

  /**
   * Get current publishing statistics.
   */
  async getPublishingStats(): Promise<PublishingStats> {
    this.ensureInitialized();

    try {
      return await RNAudioStream.getPublishingStats() as unknown as PublishingStats;
    } catch (error) {
      logger.error('Failed to get publishing stats:', error);
      throw error;
    }
  }

  // ─── CarPlay & Android Auto ───

  /**
   * Configure media session for CarPlay/Android Auto.
   */
  async setMediaSessionConfig(config: MediaSessionConfig): Promise<void> {
    this.ensureInitialized();
    logger.info('Setting media session config', config);
    await RNAudioStream.setMediaSessionConfig(config);
  }

  /**
   * Get the media browse tree for CarPlay/Android Auto.
   */
  async getMediaBrowseTree(): Promise<MediaBrowseItem[]> {
    this.ensureInitialized();
    return await RNAudioStream.getMediaBrowseTree() as unknown as MediaBrowseItem[];
  }
} 