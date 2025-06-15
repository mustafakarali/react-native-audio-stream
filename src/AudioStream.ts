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
      this.removeAllEventListeners();
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
        equalizerPreset = EQUALIZER_PRESETS[preset];
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
      
      // Set up event listeners
      this.setupNativeEventListeners();
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

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('AudioStream is not initialized. Call initialize() first.');
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
} 