# Audio Stream Buffer Demo

This is a comprehensive demo app showing all features of the `@mustafakarali/react-native-audio-stream` package with a focus on buffer visualization and stream health monitoring.

## Features Demonstrated

- **Buffer Visualization**: Real-time display of buffer progress and status
- **Stream Health Monitoring**: Network speed, buffer health, and latency indicators
- **Multiple Stream Sources**: Various working stream URLs for testing
- **Playback Controls**: Play, pause, stop, and seek functionality
- **Volume Control**: Adjustable volume with slider
- **Metadata Display**: Shows artist, title, and album information
- **Cache Management**: Clear cache and view cache size
- **Error Handling**: Comprehensive error messages and recovery

## Setup

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Install the audio stream package:
```bash
npm install @mustafakarali/react-native-audio-stream@latest
# or
yarn add @mustafakarali/react-native-audio-stream@latest
```

3. Install additional required dependency:
```bash
npm install @react-native-community/slider
# or
yarn add @react-native-community/slider
```

4. For iOS, install pods:
```bash
cd ios && pod install
```

## Buffer Configuration

This demo uses small buffer sizes for quick playback start:
- **Buffer Size**: 16 KB
- **Prebuffer Threshold**: 8 KB  
- **Max Buffer**: 128 KB

These settings prioritize quick playback start over stability. Adjust these values in the `initializeAudioStream` function for different use cases.

## Key Components

### BufferVisualizer
A custom component that shows:
- Current playback position
- Buffered content (light blue background)
- Buffering animation (pulsing indicator)
- Seek functionality

### Stream Statistics
Real-time display of:
- Buffer health percentage
- Network speed (KB/s)
- Buffered duration
- Bitrate
- Total played duration
- Network latency

## Working Stream URLs

The demo includes several tested and working stream URLs:
- **MP3 Files**: Direct MP3 file URLs
- **Radio Streams**: Various internet radio stations
- **Different Formats**: AAC and MP3 streams

## Troubleshooting

### Stream won't play
- Check if the URL is accessible
- Verify internet connection
- Some streams may be geo-restricted

### Buffer issues
- Increase buffer sizes for poor network conditions
- Check network speed indicator
- Monitor buffer health percentage

### Android specific
- Ensure audio focus is granted
- Check for INTERNET permission in AndroidManifest.xml

### iOS specific
- Enable background audio capability if needed
- Check for proper audio session configuration

## Screenshots

The demo includes:
- Clean Material Design UI
- Real-time buffer visualization
- Comprehensive stream statistics
- Error handling with user-friendly messages 