/**
 * Simple ElevenLabs Example
 * @mustafakarali/react-native-audio-stream v1.10.1
 */

import AudioStream from '@mustafakarali/react-native-audio-stream';

// Initialize once at app startup
const stream = AudioStream.getInstance();
await stream.initialize();

// Example 1: Play complete audio (simple method)
async function playElevenLabsAudio(text, apiKey, voiceId) {
  try {
    // Make API request
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    // Get audio data
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    // Play audio
    await stream.playFromData(base64, { autoPlay: true });
    
    console.log('Audio playing successfully');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Example 2: Stream audio in chunks (for long content)
async function streamElevenLabsAudio(text, apiKey, voiceId) {
  try {
    // Use streaming endpoint
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
          optimize_streaming_latency: 4,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    let isFirstChunk = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Convert chunk to base64
      const base64 = uint8ArrayToBase64(value);
      
      // Append to buffer (Android will handle streaming)
      await stream.appendToBuffer(base64);
      
      console.log(`Received chunk: ${value.length} bytes`);
    }
    
    console.log('Streaming completed');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Helper function: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function: Convert Uint8Array to base64
function uint8ArrayToBase64(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// Usage
const API_KEY = 'your-api-key';
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// Method 1: Simple playback
await playElevenLabsAudio(
  'Hello, this is a test.',
  API_KEY,
  VOICE_ID
);

// Method 2: Streaming (better for long content)
await streamElevenLabsAudio(
  'This is a longer text that will be streamed in chunks for better performance.',
  API_KEY,
  VOICE_ID
); 