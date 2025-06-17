# Real-Time Streaming with AndroidX Media3

This package now supports true byte-by-byte streaming on Android using AndroidX Media3's custom DataSource implementation.

## Features

- **True Streaming**: Audio starts playing as soon as first chunks arrive
- **Low Latency**: Minimal buffering for real-time applications
- **Byte-by-Byte**: Media3 reads data as it's written
- **PipedInputStream/OutputStream**: Efficient data transfer between threads

## API Methods (Android Only)

### startRealtimeStream(config)
Starts a real-time streaming session.

```javascript
await AudioStream.startRealtimeStream({
  autoPlay: true, // Start playing automatically
  bufferSize: 4096, // Optional buffer size
});
```

### appendRealtimeData(base64Data)
Appends audio data to the stream.

```javascript
const base64Chunk = arrayBufferToBase64(audioData);
await AudioStream.appendRealtimeData(base64Chunk);
```

### completeRealtimeStream()
Signals that streaming is complete.

```javascript
await AudioStream.completeRealtimeStream();
```

### getStreamingStats()
Gets current streaming statistics.

```javascript
const stats = await AudioStream.getStreamingStats();
// Returns: {
//   bytesWritten: number,
//   bytesRead: number,
//   isActive: boolean,
//   isReady: boolean
// }
```

## Example: ElevenLabs Real-Time Streaming

```javascript
import AudioStream from '@mustafakarali/react-native-audio-stream';
import { Platform } from 'react-native';

// Helper function
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.slice(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  
  return btoa(binary);
}

async function streamElevenLabsRealtime(text, apiKey, voiceId) {
  if (Platform.OS !== 'android') {
    throw new Error('Real-time streaming is only available on Android');
  }
  
  try {
    // Initialize
    await AudioStream.initialize({
      bufferSize: 4096,
      autoPlay: true,
    });

    // Get native module directly for Android-specific methods
    const NativeModule = NativeModules.RNAudioStream;
    
    // Start real-time stream
    await NativeModule.startRealtimeStream({ autoPlay: true });
    
    // Make streaming request
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    
    let lastProcessedIndex = 0;

    xhr.onprogress = async (event) => {
      if (xhr.response && xhr.response.byteLength > lastProcessedIndex) {
        // Get new chunk
        const newData = xhr.response.slice(lastProcessedIndex);
        const base64Chunk = arrayBufferToBase64(newData);
        
        // Append to stream
        await NativeModule.appendRealtimeData(base64Chunk);
        
        lastProcessedIndex = xhr.response.byteLength;
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        // Complete the stream
        await NativeModule.completeRealtimeStream();
        console.log('Streaming complete!');
      }
    };

    // Send request
    xhr.open('POST', `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`);
    xhr.setRequestHeader('xi-api-key', apiKey);
    xhr.setRequestHeader('Content-Type', 'application/json');
    
    xhr.send(JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
      optimize_streaming_latency: 3, // Lowest latency
    }));
    
  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}
```

## How It Works

1. **Custom DataSource**: `RealtimeStreamingDataSource` implements Media3's DataSource interface
2. **Piped Streams**: Uses PipedInputStream/PipedOutputStream for thread-safe data transfer
3. **Non-blocking**: Writer thread pumps data from queue to output stream
4. **Media3 Integration**: ProgressiveMediaSource reads bytes as they become available

## Performance Tips

- Use smaller chunks (2-8KB) for lower latency
- Set `optimize_streaming_latency: 3` in ElevenLabs API
- Monitor `getStreamingStats()` to track buffer levels
- XMLHttpRequest provides better streaming control than fetch in React Native

## Limitations

- Android only (iOS uses different audio APIs)
- Requires AndroidX Media3
- React Native's fetch doesn't support true streaming (use XMLHttpRequest)

## Troubleshooting

### "Malformed URL" Error
Don't use empty string for URL. The real-time methods handle URL internally.

### No Audio
Check that data is being written faster than it's being read using `getStreamingStats()`.

### High Latency
- Reduce chunk size
- Use `optimize_streaming_latency: 3` in TTS API
- Ensure network is fast enough

## Future Improvements

- iOS support using Audio Queue Services
- WebSocket support for bi-directional streaming
- Adaptive bitrate based on network conditions 