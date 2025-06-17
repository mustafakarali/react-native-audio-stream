# Android Implementation Details

## Media3 Migration Status

The library has been successfully migrated from ExoPlayer2 to AndroidX Media3. All imports and APIs have been updated to use Media3 packages.

## Supported Stream Types

### 1. HLS (HTTP Live Streaming)
- **Detection**: URLs ending with `.m3u8` or containing `playlist.m3u8`
- **Implementation**: Uses `HlsMediaSource`
- **MIME Type**: `application/x-mpegURL`

### 2. DASH (Dynamic Adaptive Streaming over HTTP)
- **Detection**: URLs ending with `.mpd`
- **Implementation**: Uses `DashMediaSource`
- **MIME Type**: `application/dash+xml`

### 3. SmoothStreaming
- **Detection**: URLs ending with `.ism` or `.ism/Manifest`
- **Implementation**: Uses `SsMediaSource`
- **MIME Type**: `application/vnd.ms-sstr+xml`

### 4. Progressive Media (Regular Audio Files)
- **Formats**: MP3, AAC, WAV, OGG, FLAC, etc.
- **Implementation**: Uses `ProgressiveMediaSource`
- **Supports**: HTTP/HTTPS URLs and local file paths

### 5. Base64 Audio Data
- **Method**: `playFromData(base64Data, config)`
- **Implementation**: Uses `ByteArrayDataSource` with base64 decoded data

### 6. Streaming Chunks
- **Method**: `appendToBuffer(base64Data)`
- **Implementation**: Writes chunks to temporary file and plays progressively

## Features

### Audio Focus Management
- Handles audio focus requests and changes
- Pauses/resumes based on focus events
- Supports Android 8.0+ focus request API

### Caching
- Uses Media3's `SimpleCache` with LRU eviction
- Configurable cache size
- Can be enabled/disabled per stream

### Buffering
- Customizable buffer sizes
- Adaptive buffering with `DefaultLoadControl`
- Real-time buffer statistics

### Network
- OkHttp integration for better network performance
- Custom headers support
- Bandwidth monitoring with `DefaultBandwidthMeter`

### Background Playback
- Maintains playback when app goes to background
- Requires audio focus for uninterrupted playback

### Error Handling
- Comprehensive error codes and messages
- Network, decoder, and format error detection
- Recoverable vs non-recoverable error distinction

## API Methods

### Initialization
- `initialize(config)` - Initialize the player
- `destroy()` - Clean up resources

### Playback Control
- `startStream(url, config)` - Start streaming from URL
- `play()` - Resume playback
- `pause()` - Pause playback
- `stop()` - Stop and reset playback
- `seek(position)` - Seek to position in seconds

### Volume & Speed
- `setVolume(volume)` - Set volume (0.0 to 1.0)
- `getVolume()` - Get current volume
- `setPlaybackRate(rate)` - Set playback speed
- `getPlaybackRate()` - Get current playback speed

### State & Progress
- `getState()` - Get current playback state
- `getCurrentTime()` - Get current position
- `getDuration()` - Get total duration
- `getBufferedPercentage()` - Get buffered percentage

### Statistics
- `getStats()` - Get detailed playback statistics
- `getMetadata()` - Get media metadata

### Cache Management
- `clearCache()` - Clear cache
- `getCacheSize()` - Get cache size in bytes
- `preloadStream(url, duration)` - Preload stream

### Audio Focus
- `requestAudioFocus()` - Request audio focus
- `abandonAudioFocus()` - Release audio focus

## Event System

Events are sent via React Native's event emitter:

- `onStreamStateChange` - Playback state changes
- `onStreamProgress` - Progress updates
- `onStreamBuffer` - Buffering status
- `onStreamError` - Error events
- `onStreamEnd` - Stream completed
- `onStreamMetadata` - Metadata updates
- `onStreamStats` - Statistics updates

## Notes

### POST Request Limitation
POST requests with body are not fully supported by ExoPlayer/Media3. For TTS services that require POST, use `playFromData()` with the audio response.

### RTSP Support
RTSP is not currently implemented but can be added by:
1. Adding `androidx.media3:media3-exoplayer-rtsp:1.2.0` dependency
2. Importing `RtspMediaSource`
3. Adding RTSP detection and handling in `startStream()`

### Equalizer
ExoPlayer/Media3 doesn't have built-in equalizer. The current implementation returns a mock equalizer. For real equalizer support, Android's AudioEffect API would need to be integrated.

## Testing

To test the implementation:

```javascript
// Test HLS
await AudioStream.startStream('https://example.com/stream.m3u8');

// Test DASH  
await AudioStream.startStream('https://example.com/stream.mpd');

// Test SmoothStreaming
await AudioStream.startStream('https://example.com/stream.ism/Manifest');

// Test MP3
await AudioStream.startStream('https://example.com/audio.mp3');

// Test Base64
await AudioStream.playFromData(base64AudioData);

// Test Streaming
await AudioStream.appendToBuffer(base64Chunk1);
await AudioStream.appendToBuffer(base64Chunk2);
``` 