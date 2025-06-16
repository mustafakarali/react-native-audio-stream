/**
 * ElevenLabs Streaming Example
 * Using existing playFromData and appendToBuffer methods
 */

import AudioStream from '@mustafakarali/react-native-audio-stream';
import { Platform } from 'react-native';

/**
 * Stream audio from ElevenLabs TTS API
 * @param {string} text - Text to convert to speech
 * @param {Object} config - Configuration object
 * @param {string} config.apiKey - ElevenLabs API key
 * @param {string} config.voiceId - Voice ID to use
 * @param {string} [config.modelId='eleven_multilingual_v2'] - Model ID
 * @param {Function} [config.onProgress] - Progress callback
 */
export async function streamElevenLabsTTS(text, config) {
  const {
    apiKey,
    voiceId,
    modelId = 'eleven_multilingual_v2',
    onProgress
  } = config;

  const stream = AudioStream.getInstance();
  
  try {
    // Initialize audio stream
    await stream.initialize();
    onProgress?.('Initialized');

    // Make request to ElevenLabs API
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
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
          optimize_streaming_latency: 4,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    onProgress?.('Streaming started');

    // For Android: Use appendToBuffer for streaming
    if (Platform.OS === 'android') {
      const reader = response.body.getReader();
      let totalBytes = 0;
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Convert Uint8Array to base64
        const base64 = uint8ArrayToBase64(value);
        
        // Append to buffer
        await stream.appendToBuffer(base64);
        
        totalBytes += value.length;
        onProgress?.(`Received ${Math.round(totalBytes / 1024)}KB`);
        
        // Auto-play after first chunk
        if (isFirstChunk) {
          isFirstChunk = false;
          // appendToBuffer handles auto-play internally
        }
      }
    } else {
      // For iOS: Read entire response and play
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = uint8ArrayToBase64(uint8Array);
      
      await stream.playFromData(base64, { autoPlay: true });
    }

    onProgress?.('Streaming completed');
  } catch (error) {
    onProgress?.(`Error: ${error.message}`);
    throw error;
  }
}

/**
 * Convert Uint8Array to base64 string
 * @param {Uint8Array} uint8Array 
 * @returns {string} Base64 encoded string
 */
function uint8ArrayToBase64(uint8Array) {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  const chunks = [];
  
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    const chunk = uint8Array.subarray(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
  }
  
  return btoa(chunks.join(''));
}

/**
 * React component example
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet,
  ActivityIndicator 
} from 'react-native';

export function ElevenLabsStreamingDemo() {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('');
  
  // Replace with your actual API credentials
  const API_KEY = 'your-api-key';
  const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

  const handleStream = async () => {
    if (!text.trim()) {
      setStatus('Please enter some text');
      return;
    }

    setIsStreaming(true);
    
    try {
      await streamElevenLabsTTS(text, {
        apiKey: API_KEY,
        voiceId: VOICE_ID,
        onProgress: (message) => {
          setStatus(message);
        }
      });
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ElevenLabs TTS Streaming</Text>
      
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Enter text to convert to speech..."
        multiline
        numberOfLines={4}
      />
      
      <TouchableOpacity 
        style={[styles.button, isStreaming && styles.buttonDisabled]}
        onPress={handleStream}
        disabled={isStreaming}
      >
        {isStreaming ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Stream Audio</Text>
        )}
      </TouchableOpacity>
      
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  status: {
    marginTop: 20,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

// Usage example
export async function example() {
  const API_KEY = 'your-elevenlabs-api-key';
  const VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
  
  await streamElevenLabsTTS(
    'Hello! This is a test of the ElevenLabs streaming API.',
    {
      apiKey: API_KEY,
      voiceId: VOICE_ID,
      onProgress: (status) => console.log('Status:', status)
    }
  );
} 