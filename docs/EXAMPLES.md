# Examples

This document contains various examples of using the `@mustafakarali/react-native-audio-stream` package.

## Complete Demo Apps

### Buffer Demo
A comprehensive demo app showcasing all features with buffer visualization.

📁 [View Source Code](../examples/BufferDemo/)

**Features:**
- Real-time buffer visualization with progress bars
- Stream health monitoring (network speed, buffer health)
- Multiple working stream URLs for testing
- Playback controls with seeking
- Volume control
- Metadata display
- Cache management
- Error handling

**Screenshot Preview:**
The demo includes a clean Material Design UI with real-time statistics.

---

## Basic Usage Examples

### 1. Simple Audio Stream Player

```tsx
import React, { useEffect, useState } from 'react';
import { View, Button, Text } from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

export default function SimplePlayer() {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Initialize on mount
    AudioStream.initialize({
      bufferSize: 64,
      enableBackgroundMode: true,
    });

    // Cleanup on unmount
    return () => {
      AudioStream.destroy();
    };
  }, []);

  const playStream = async () => {
    try {
      await AudioStream.startStream('https://stream.radioparadise.com/aac-320');
      setIsPlaying(true);
    } catch (error) {
      console.error('Stream error:', error);
    }
  };

  const stopStream = async () => {
    try {
      await AudioStream.stop();
      setIsPlaying(false);
    } catch (error) {
      console.error('Stop error:', error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button
        title={isPlaying ? 'Stop' : 'Play'}
        onPress={isPlaying ? stopStream : playStream}
      />
    </View>
  );
}
```

### 2. Stream with Progress Tracking

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ProgressBar } from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

export default function ProgressPlayer() {
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });

  useEffect(() => {
    AudioStream.initialize();

    // Listen to progress updates
    const progressListener = AudioStream.addEventListener('onProgress', (data) => {
      setProgress({
        currentTime: data.currentTime,
        duration: data.duration,
      });
    });

    return () => {
      progressListener.remove();
      AudioStream.destroy();
    };
  }, []);

  const percentage = progress.duration > 0 
    ? (progress.currentTime / progress.duration) 
    : 0;

  return (
    <View style={{ padding: 20 }}>
      <Text>Progress: {Math.round(percentage * 100)}%</Text>
      <ProgressBar progress={percentage} />
      <Text>
        {formatTime(progress.currentTime)} / {formatTime(progress.duration)}
      </Text>
    </View>
  );
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

### 3. Buffer Monitoring

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

export default function BufferMonitor() {
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferPercentage, setBufferPercentage] = useState(0);

  useEffect(() => {
    AudioStream.initialize({
      bufferSize: 32, // Smaller buffer for testing
      prebufferThreshold: 16,
    });

    // Buffer state listener
    const bufferListener = AudioStream.addEventListener('onBuffer', (buffering) => {
      setIsBuffering(buffering);
    });

    // Periodically check buffer percentage
    const interval = setInterval(async () => {
      try {
        const percentage = await AudioStream.getBufferedPercentage();
        setBufferPercentage(percentage);
      } catch (error) {
        // Handle error
      }
    }, 500);

    return () => {
      bufferListener.remove();
      clearInterval(interval);
      AudioStream.destroy();
    };
  }, []);

  return (
    <View style={{ padding: 20 }}>
      <Text>Buffer Status: {isBuffering ? '⏳ Buffering...' : '✅ Ready'}</Text>
      <Text>Buffer Fill: {Math.round(bufferPercentage)}%</Text>
    </View>
  );
}
```

### 4. Metadata Display

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

export default function MetadataDisplay() {
  const [metadata, setMetadata] = useState({});

  useEffect(() => {
    AudioStream.initialize();

    // Metadata listener
    const metadataListener = AudioStream.addEventListener('onMetadata', (data) => {
      setMetadata(data);
    });

    return () => {
      metadataListener.remove();
      AudioStream.destroy();
    };
  }, []);

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Now Playing</Text>
      <Text>Artist: {metadata.artist || 'Unknown'}</Text>
      <Text>Title: {metadata.title || 'Unknown'}</Text>
      <Text>Album: {metadata.album || 'Unknown'}</Text>
    </View>
  );
}
```

### 5. Error Handling

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

export default function ErrorHandling() {
  const [error, setError] = useState(null);
  const [state, setState] = useState('idle');

  useEffect(() => {
    AudioStream.initialize();

    // State change listener
    const stateListener = AudioStream.addEventListener('onStateChange', (newState) => {
      setState(newState);
    });

    // Error listener
    const errorListener = AudioStream.addEventListener('onError', (error) => {
      setError(error);
      Alert.alert(
        'Stream Error',
        error.message,
        [
          { text: 'Retry', onPress: retryStream },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    });

    return () => {
      stateListener.remove();
      errorListener.remove();
      AudioStream.destroy();
    };
  }, []);

  const retryStream = async () => {
    setError(null);
    // Retry logic here
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>State: {state}</Text>
      {error && (
        <Text style={{ color: 'red' }}>Error: {error.message}</Text>
      )}
    </View>
  );
}
```

### 6. Stream Statistics

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

export default function StreamStats() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    AudioStream.initialize();

    // Statistics listener
    const statsListener = AudioStream.addEventListener('onStats', (data) => {
      setStats(data.stats);
    });

    return () => {
      statsListener.remove();
      AudioStream.destroy();
    };
  }, []);

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Stream Statistics</Text>
      <Text>Network Speed: {Math.round(stats.networkSpeed || 0)} KB/s</Text>
      <Text>Buffer Health: {Math.round(stats.bufferHealth || 0)}%</Text>
      <Text>Bitrate: {Math.round(stats.bitRate || 0)} kbps</Text>
      <Text>Latency: {stats.latency || 0} ms</Text>
    </View>
  );
}
```

## Working Stream URLs

Here are some tested and working stream URLs you can use:

```javascript
const STREAM_URLS = {
  // Music streams
  radioParadiseAAC: 'https://stream.radioparadise.com/aac-320',
  radioParadiseMP3: 'https://stream.radioparadise.com/mp3-320',
  classicalRadio: 'https://live.musopen.org:8085/streamvbr0',
  jazzRadio: 'https://jazz.streamr.ru/jazz-64.mp3',
  
  // Test files
  mp3Sample: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  shortAudio: 'https://cdn.pixabay.com/download/audio/2021/11/25/audio_91b32e02f9.mp3',
};
```

## Tips and Best Practices

### Buffer Configuration

For different use cases, adjust buffer sizes:

```javascript
// Quick start, less stable
AudioStream.initialize({
  bufferSize: 16,
  prebufferThreshold: 8,
  maxBufferSize: 128,
});

// Balanced
AudioStream.initialize({
  bufferSize: 64,
  prebufferThreshold: 32,
  maxBufferSize: 512,
});

// Stable, slower start
AudioStream.initialize({
  bufferSize: 128,
  prebufferThreshold: 64,
  maxBufferSize: 1024,
});
```

### Performance Optimization

1. **Debounce UI updates**: Don't update UI on every progress event
2. **Use appropriate buffer sizes**: Match your use case
3. **Handle errors gracefully**: Implement retry logic
4. **Clean up properly**: Always call destroy() when done

### Platform Specific

**Android:**
```javascript
// Request audio focus
const granted = await AudioStream.requestAudioFocus();
```

**iOS:**
```javascript
// Configure for background playback
AudioStream.initialize({
  enableBackgroundMode: true,
  maintainAudioFocus: true,
});
```

## Troubleshooting Common Issues

### Stream won't start
- Check internet connection
- Verify stream URL is accessible
- Ensure proper permissions (INTERNET on Android)

### Buffering issues
- Increase buffer sizes
- Check network speed
- Verify stream bitrate compatibility

### Memory leaks
- Always remove event listeners
- Call destroy() on unmount
- Avoid creating multiple instances

## Need More Help?

- Check the [API Documentation](./API.md)
- View the [Complete Demo App](../examples/BufferDemo/)
- Report issues on [GitHub](https://github.com/mustafakarali/react-native-audio-stream/issues) 