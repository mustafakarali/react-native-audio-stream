# React Native Audio Stream - Usage Guide

## Installation

```bash
npm install @mustafakarali/react-native-audio-stream@1.10.1
# OR
yarn add @mustafakarali/react-native-audio-stream@1.10.1
```

### iOS Setup
```bash
cd ios && pod install
```

### Android Setup
No additional setup required.

## Quick Start

1. Copy `quick-test.js` content into your `App.js`
2. Run your app
3. Test the three examples

## Full Example

See `complete-example.js` for a comprehensive example with:
- MP3 playback from URL
- Base64 audio playback
- ElevenLabs Text-to-Speech
- Streaming support
- Playback controls

## Basic Usage

```javascript
import AudioStream from '@mustafakarali/react-native-audio-stream';

// Get instance
const stream = AudioStream.getInstance();

// Initialize
await stream.initialize();

// Play MP3 from URL
await stream.startStream('https://example.com/audio.mp3', { autoPlay: true });

// Play base64 audio
await stream.playFromData(base64AudioData, { autoPlay: true });

// Control playback
await stream.play();
await stream.pause();
await stream.stop();
```

## ElevenLabs Integration

```javascript
// Simple method - play complete audio
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
  {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: 'Your text here',
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  }
);

const arrayBuffer = await response.arrayBuffer();
const base64 = arrayBufferToBase64(arrayBuffer);
await stream.playFromData(base64, { autoPlay: true });
```

## Helper Functions

```javascript
// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  
  return btoa(binary);
}
```

## Events

```javascript
// Listen to events
stream.addEventListener('onStreamStateChange', (event) => {
  console.log('State:', event.state);
});

stream.addEventListener('onStreamProgress', (event) => {
  console.log('Progress:', event.currentTime, '/', event.duration);
});

stream.addEventListener('onStreamError', (event) => {
  console.error('Error:', event.message);
});
```

## Getting ElevenLabs API Key

1. Go to https://elevenlabs.io
2. Sign up or log in
3. Go to Profile → API Keys
4. Create new API key

## Voice IDs

Popular voices:
- Rachel: `21m00Tcm4TlvDq8ikWAM`
- Domi: `AZnzlk1XvdvUeBnXmlld`
- Bella: `EXAVITQu4vr4xnSDxMaL`

Get all voices: https://api.elevenlabs.io/v1/voices 