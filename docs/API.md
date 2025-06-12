# API Documentation

## Table of Contents
- [AudioStream Class](#audiostream-class)
- [Types](#types)
- [Events](#events)
- [Error Handling](#error-handling)
- [Platform Specific APIs](#platform-specific-apis)

## AudioStream Class

The main class for audio streaming functionality. This is a singleton class - use `AudioStream.getInstance()` or the default export.

### Methods

#### `initialize(config?: AudioStreamConfig): Promise<void>`

Initialize the audio stream with optional configuration.

**Parameters:**
- `config` (optional): Configuration object

**Example:**
```typescript
await AudioStream.initialize({
  bufferSize: 64,
  enableBackgroundMode: true,
  logLevel: LogLevel.DEBUG
});
```

#### `destroy(): Promise<void>`

Clean up resources and destroy the audio stream instance.

**Example:**
```typescript
await AudioStream.destroy();
```

#### `startStream(url: string, config?: AudioStreamConfig): Promise<void>`

Start streaming from the specified URL.

**Parameters:**
- `url`: The audio stream URL
- `config` (optional): Stream-specific configuration that overrides initialization config

**Example:**
```typescript
await AudioStream.startStream('https://example.com/stream.mp3', {
  headers: {
    'Authorization': 'Bearer token'
  }
});
```

#### `stopStream(): Promise<void>`

Stop the current stream and clean up streaming resources.

#### `play(): Promise<void>`

Resume playback of a paused stream.

#### `pause(): Promise<void>`

Pause the current stream.

#### `stop(): Promise<void>`

Stop playback and reset to the beginning.

#### `seek(position: number): Promise<void>`

Seek to a specific position in seconds.

**Parameters:**
- `position`: Position in seconds (must be >= 0)

**Throws:**
- Error if position is negative

#### `setVolume(volume: number): Promise<void>`

Set the playback volume.

**Parameters:**
- `volume`: Volume level from 0.0 to 1.0

**Throws:**
- Error if volume is outside valid range

#### `getVolume(): Promise<number>`

Get the current volume level.

**Returns:** Current volume (0.0 to 1.0)

#### `setPlaybackRate(rate: number): Promise<void>`

Set the playback speed.

**Parameters:**
- `rate`: Playback rate from 0.5 to 2.0

**Throws:**
- Error if rate is outside valid range

#### `getPlaybackRate(): Promise<number>`

Get the current playback rate.

**Returns:** Current playback rate

#### `getState(): Promise<PlaybackState>`

Get the current playback state.

**Returns:** Current state (idle, loading, buffering, playing, paused, stopped, error, completed)

#### `getCurrentTime(): Promise<number>`

Get the current playback position.

**Returns:** Current position in seconds

#### `getDuration(): Promise<number>`

Get the total duration of the stream.

**Returns:** Duration in seconds (0 if unknown)

#### `getBufferedPercentage(): Promise<number>`

Get the percentage of buffered content.

**Returns:** Buffered percentage (0-100)

#### `getStats(): Promise<PlaybackStats>`

Get detailed playback statistics.

**Returns:** Statistics object with performance metrics

#### `getMetadata(): Promise<AudioMetadata | null>`

Get metadata from the current stream.

**Returns:** Metadata object or null if not available

#### `setEqualizer(bands: EqualizerBand[]): Promise<void>`

Set custom equalizer bands.

**Parameters:**
- `bands`: Array of frequency bands with gain values

#### `applyEqualizerPreset(preset: EqualizerPreset): Promise<void>`

Apply a predefined equalizer preset.

**Parameters:**
- `preset`: Equalizer preset object

#### `getEqualizerPresets(): Promise<EqualizerPreset[]>`

Get available equalizer presets.

**Returns:** Array of available presets

#### `addEventListener<K extends keyof AudioStreamCallbacks>(event: K, callback: AudioStreamCallbacks[K]): void`

Add an event listener.

**Parameters:**
- `event`: Event name
- `callback`: Callback function

#### `removeEventListener<K extends keyof AudioStreamCallbacks>(event: K, callback: AudioStreamCallbacks[K]): void`

Remove an event listener.

**Parameters:**
- `event`: Event name
- `callback`: Callback function to remove

#### `removeAllEventListeners(): void`

Remove all event listeners.

#### `clearCache(): Promise<void>`

Clear all cached audio data.

#### `getCacheSize(): Promise<number>`

Get the current cache size.

**Returns:** Cache size in bytes

#### `preloadStream(url: string, duration?: number): Promise<void>`

Preload a stream for faster playback.

**Parameters:**
- `url`: Stream URL to preload
- `duration` (optional): Duration in seconds to preload

#### `setNetworkPriority(priority: 'low' | 'normal' | 'high'): Promise<void>`

Set network priority for streaming.

**Parameters:**
- `priority`: Network priority level

## Types

### AudioStreamConfig

```typescript
interface AudioStreamConfig {
  // Buffer configuration
  bufferSize?: number;              // KB, default: 64
  prebufferThreshold?: number;      // KB, default: 16
  maxBufferSize?: number;           // KB, default: 512
  
  // Stream configuration
  chunkSize?: number;               // KB, default: 16
  protocol?: StreamingProtocol;
  reconnectAttempts?: number;       // default: 3
  reconnectDelay?: number;          // ms, default: 1000
  timeout?: number;                 // ms, default: 30000
  
  // Audio configuration
  format?: AudioFormat;
  sampleRate?: number;              // default: 44100
  channels?: number;                // default: 2
  bitRate?: number;                 // kbps
  
  // Playback configuration
  autoPlay?: boolean;               // default: true
  enableBackgroundMode?: boolean;   // default: false
  maintainAudioFocus?: boolean;     // default: true
  
  // Cache configuration
  enableCache?: boolean;            // default: false
  cacheSize?: number;               // MB, default: 100
  cachePath?: string;
  
  // Logging
  logLevel?: LogLevel;
  
  // Headers for HTTP requests
  headers?: Record<string, string>;
}
```

### PlaybackState

```typescript
enum PlaybackState {
  IDLE = 'idle',
  LOADING = 'loading',
  BUFFERING = 'buffering',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error',
  COMPLETED = 'completed'
}
```

### PlaybackStats

```typescript
interface PlaybackStats {
  bufferedDuration: number;    // seconds
  playedDuration: number;      // seconds
  totalDuration: number;       // seconds
  networkSpeed: number;        // KB/s
  latency: number;            // ms
  bufferHealth: number;       // 0-100
  droppedFrames: number;
  bitRate: number;           // kbps
}
```

### AudioMetadata

```typescript
interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: string;
  duration?: number;         // seconds
  artwork?: string;          // base64 or URL
  [key: string]: any;
}
```

### StreamError

```typescript
interface StreamError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}
```

## Events

### onStart
Fired when stream starts loading.

```typescript
AudioStream.addEventListener('onStart', () => {
  console.log('Stream started');
});
```

### onBuffer
Fired when buffering state changes.

```typescript
AudioStream.addEventListener('onBuffer', (isBuffering: boolean) => {
  console.log('Buffering:', isBuffering);
});
```

### onProgress
Fired periodically with playback progress.

```typescript
AudioStream.addEventListener('onProgress', (progress) => {
  console.log(`Progress: ${progress.currentTime}/${progress.duration}`);
});
```

### onError
Fired when an error occurs.

```typescript
AudioStream.addEventListener('onError', (error: StreamError) => {
  console.error('Error:', error.message);
  if (error.recoverable) {
    // Retry logic
  }
});
```

### onEnd
Fired when stream ends.

```typescript
AudioStream.addEventListener('onEnd', () => {
  console.log('Stream ended');
});
```

### onStateChange
Fired when playback state changes.

```typescript
AudioStream.addEventListener('onStateChange', (state: PlaybackState) => {
  console.log('State changed to:', state);
});
```

### onMetadata
Fired when metadata is received.

```typescript
AudioStream.addEventListener('onMetadata', (metadata: AudioMetadata) => {
  console.log('Metadata:', metadata);
});
```

### onStats
Fired periodically with playback statistics.

```typescript
AudioStream.addEventListener('onStats', (stats: PlaybackStats) => {
  console.log('Stats:', stats);
});
```

### onNetworkStateChange
Fired when network connectivity changes.

```typescript
AudioStream.addEventListener('onNetworkStateChange', (isConnected: boolean) => {
  console.log('Network connected:', isConnected);
});
```

## Error Handling

### Error Codes

```typescript
const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  DECODE_ERROR: 'DECODE_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  BUFFER_TIMEOUT: 'BUFFER_TIMEOUT',
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR',
  INVALID_STATE: 'INVALID_STATE',
  CACHE_ERROR: 'CACHE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};
```

### Error Recovery

```typescript
AudioStream.addEventListener('onError', (error) => {
  if (error.recoverable) {
    switch (error.code) {
      case ErrorCodes.NETWORK_ERROR:
        // Retry after delay
        setTimeout(() => {
          AudioStream.startStream(currentUrl);
        }, 3000);
        break;
      case ErrorCodes.BUFFER_TIMEOUT:
        // Increase buffer size and retry
        AudioStream.startStream(currentUrl, {
          bufferSize: 128
        });
        break;
      default:
        // Show error to user
        break;
    }
  }
});
```

## Platform Specific APIs

### iOS Only

#### `requestAudioFocus(): Promise<boolean>`
Request audio focus (handled automatically on iOS).

#### `abandonAudioFocus(): Promise<void>`
Abandon audio focus (handled automatically on iOS).

#### `setAudioSessionCategory(category: string): Promise<void>`
Set iOS audio session category.

**Categories:**
- `'playback'` - Background playback
- `'ambient'` - Mix with other audio
- `'soloAmbient'` - Don't mix with other audio

**Example:**
```typescript
if (Platform.OS === 'ios') {
  await AudioStream.setAudioSessionCategory('playback');
}
```

### Android Only

#### `requestAudioFocus(): Promise<boolean>`
Request audio focus from the system.

**Returns:** true if granted, false otherwise

**Example:**
```typescript
if (Platform.OS === 'android') {
  const granted = await AudioStream.requestAudioFocus();
  if (!granted) {
    console.warn('Audio focus not granted');
  }
}
```

#### `abandonAudioFocus(): Promise<void>`
Release audio focus.

## Best Practices

1. **Always initialize before use**
   ```typescript
   await AudioStream.initialize();
   ```

2. **Handle errors appropriately**
   ```typescript
   AudioStream.addEventListener('onError', handleError);
   ```

3. **Clean up when done**
   ```typescript
   await AudioStream.destroy();
   ```

4. **Check state before operations**
   ```typescript
   const state = await AudioStream.getState();
   if (state === PlaybackState.PLAYING) {
     await AudioStream.pause();
   }
   ```

5. **Use appropriate buffer sizes**
   - Smaller buffers (32KB) for low latency
   - Larger buffers (128KB) for poor networks

6. **Monitor statistics**
   ```typescript
   AudioStream.addEventListener('onStats', (stats) => {
     if (stats.bufferHealth < 50) {
       // Consider increasing buffer size
     }
   });
   ``` 