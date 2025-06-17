import AudioStream from '@mustafakarali/react-native-audio-stream';
import { Platform } from 'react-native';

/**
 * Android için Optimize Edilmiş Gerçek Zamanlı Streaming Çözümü
 * 
 * Bu örnek, ElevenLabs gibi TTS servislerinden gelen ses akışını
 * en hızlı şekilde oynatmak için optimize edilmiştir.
 */

class OptimizedStreamingManager {
  constructor() {
    this.chunks = [];
    this.isPlaying = false;
    this.totalSize = 0;
    this.minPlaybackSize = 8192; // 8KB - Daha düşük gecikme için
  }

  /**
   * Ses verisini chunk chunk işle
   */
  async processStream(response) {
    const reader = response.body.getReader();
    let firstChunkTime = null;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (!firstChunkTime) {
          firstChunkTime = Date.now();
          console.log('İlk chunk alındı');
        }
        
        // Chunk'ı sakla
        this.chunks.push(value);
        this.totalSize += value.length;
        
        // Android için: Minimum boyuta ulaştıysa hemen oynat
        if (Platform.OS === 'android' && !this.isPlaying && this.totalSize >= this.minPlaybackSize) {
          const playbackStartTime = Date.now();
          const latency = playbackStartTime - firstChunkTime;
          console.log(`Oynatma başlıyor. Gecikme: ${latency}ms`);
          
          await this.startPlayback();
        }
      }
      
      // Kalan veriyi oynat
      if (!this.isPlaying && this.chunks.length > 0) {
        await this.startPlayback();
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Toplanan chunk'ları oynat
   */
  async startPlayback() {
    // Tüm chunk'ları birleştir
    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedArray = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.chunks) {
      combinedArray.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Base64'e çevir
    const base64Audio = this.uint8ArrayToBase64(combinedArray);
    
    // Oynat
    await AudioStream.playFromData(base64Audio, { autoPlay: true });
    this.isPlaying = true;
    
    // Belleği temizle
    this.chunks = [];
  }

  uint8ArrayToBase64(uint8Array) {
    let binary = '';
    const chunkSize = 8192;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    
    return btoa(binary);
  }
}

/**
 * ElevenLabs TTS Streaming Örneği
 */
export async function streamElevenLabsTTS(text, apiKey, voiceId) {
  const startTime = Date.now();
  console.log('Streaming başlatılıyor...');
  
  try {
    // 1. API isteği gönder
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
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
        optimize_streaming_latency: 3, // En düşük gecikme
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const responseTime = Date.now() - startTime;
    console.log(`API yanıt süresi: ${responseTime}ms`);

    // 2. Android için optimize edilmiş streaming
    if (Platform.OS === 'android') {
      const manager = new OptimizedStreamingManager();
      await manager.processStream(response);
    } else {
      // iOS için normal streaming
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const base64Chunk = btoa(String.fromCharCode(...value));
        await AudioStream.appendToBuffer(base64Chunk);
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`Toplam süre: ${totalTime}ms`);
    
  } catch (error) {
    console.error('Streaming hatası:', error);
    throw error;
  }
}

/**
 * Daha da hızlı: Paralel indirme ve oynatma
 */
export async function ultraFastStreaming(text, apiKey, voiceId) {
  console.log('Ultra hızlı streaming başlatılıyor...');
  
  // İki paralel istek gönder
  const promise1 = fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.substring(0, Math.floor(text.length / 2)), // İlk yarı
      model_id: 'eleven_turbo_v2', // Daha hızlı model
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });
  
  const promise2 = fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.substring(Math.floor(text.length / 2)), // İkinci yarı
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    }),
  });
  
  // İlk gelen yanıtı oynat
  const responses = await Promise.race([promise1, promise2]);
  const arrayBuffer = await responses.arrayBuffer();
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  
  await AudioStream.playFromData(base64Audio, { autoPlay: true });
}

/**
 * Kullanım Örneği
 */
export async function example() {
  const API_KEY = 'your-api-key';
  const VOICE_ID = 'your-voice-id';
  const text = 'Merhaba, bu gerçek zamanlı ses akışı örneğidir.';
  
  try {
    // Yöntem 1: Optimize edilmiş streaming
    await streamElevenLabsTTS(text, API_KEY, VOICE_ID);
    
    // Yöntem 2: Ultra hızlı (kısa metinler için)
    // await ultraFastStreaming(text, API_KEY, VOICE_ID);
    
  } catch (error) {
    console.error('Hata:', error);
  }
}

// ElevenLabs Working Streaming Example for React Native
// This solves the "response.body undefined" and "Malformed URL" issues

// React Native doesn't have native btoa, so we implement it
function btoa(input) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = String(input);
  let output = '';

  for (let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || (map = '=', i % 1);
    output += map.charAt(63 & block >> 8 - i % 1 * 8)) {

    charCode = str.charCodeAt(i += 3/4);

    if (charCode > 0xFF) {
      throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
    }

    block = block << 8 | charCode;
  }

  return output;
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// SOLUTION 1: Complete audio playback (most reliable)
export async function playCompleteAudio(text, apiKey, voiceId) {
  try {
    console.log('Starting ElevenLabs complete audio playback...');
    
    // Initialize AudioStream
    await AudioStream.initialize({
      bufferSize: 8192,
      autoPlay: true,
      enableLogs: true,
    });

    const instance = AudioStream.getInstance();

    // Fetch complete audio
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    // Convert to blob then to base64
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = reader.result;
          const base64Audio = base64data.split(',')[1]; // Remove data:audio/mpeg;base64, prefix
          
          console.log('Playing audio data...');
          await instance.playFromData(base64Audio, { autoPlay: true });
          console.log('Audio playback started successfully');
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
  } catch (error) {
    console.error('Audio playback error:', error);
    throw error;
  }
}

// SOLUTION 2: Chunked streaming with file-based approach
// This creates a streaming experience even though we download the complete file
export async function streamWithFileApproach(text, apiKey, voiceId, onProgress) {
  try {
    console.log('Starting file-based streaming...');
    
    // Initialize AudioStream
    await AudioStream.initialize({
      bufferSize: 4096,
      autoPlay: true,
      enableLogs: true,
    });

    const instance = AudioStream.getInstance();

    // Start with a data URL for a silent MP3 (to avoid Malformed URL error)
    const SILENT_MP3_DATA_URL = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAABhAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
    
    // Start stream with data URL instead of empty string
    await instance.startStream(SILENT_MP3_DATA_URL, { 
      autoPlay: true,
      useCache: false 
    });
    
    // Small delay to ensure player is ready
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Now fetch the actual audio
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    const blob = await response.blob();
    
    // Convert blob to arraybuffer for chunking simulation
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const totalSize = arrayBuffer.byteLength;
    const chunkSize = 4096; // 4KB chunks
    let offset = 0;
    let chunkNumber = 0;

    // Simulate streaming by processing in chunks
    while (offset < totalSize) {
      const chunk = arrayBuffer.slice(offset, Math.min(offset + chunkSize, totalSize));
      const base64Chunk = arrayBufferToBase64(chunk);
      
      chunkNumber++;
      console.log(`Processing chunk ${chunkNumber}: ${chunk.byteLength} bytes`);
      
      // Append chunk to buffer
      await instance.appendToBuffer(base64Chunk);
      
      // Report progress
      if (onProgress) {
        onProgress({
          chunksReceived: chunkNumber,
          bytesReceived: offset + chunk.byteLength,
          totalBytes: totalSize,
          percentage: Math.round(((offset + chunk.byteLength) / totalSize) * 100)
        });
      }
      
      offset += chunkSize;
      
      // Small delay to simulate network streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`Streaming complete! Total chunks: ${chunkNumber}`);
    
  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}

// SOLUTION 3: Using the stream endpoint with proper initialization
export async function streamAudioProper(text, apiKey, voiceId) {
  try {
    console.log('Starting proper streaming...');
    
    // Initialize AudioStream
    await AudioStream.initialize({
      bufferSize: 4096,
      autoPlay: true,
      enableLogs: true,
    });

    const instance = AudioStream.getInstance();

    // For streaming endpoint, we can use direct URL streaming
    // Create the request body
    const requestBody = {
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
      },
    };

    // Option 1: Direct URL streaming (if your backend supports it)
    const streamUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
    
    // Start stream with POST configuration
    await instance.startStream(streamUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: requestBody,
      autoPlay: true,
      useCache: false,
    });
    
    console.log('Streaming started successfully');
    
  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}

// Example React Native Component
import React, { useState } from 'react';
import { View, Button, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';

export const ElevenLabsExample = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [method, setMethod] = useState('');
  
  const API_KEY = 'YOUR_API_KEY_HERE';
  const VOICE_ID = 'YOUR_VOICE_ID_HERE';
  const TEST_TEXT = 'Hello! This is a test of ElevenLabs text to speech streaming in React Native.';
  
  const handleCompletePlayback = async () => {
    setIsLoading(true);
    setMethod('Complete Playback');
    setProgress(null);
    
    try {
      await playCompleteAudio(TEST_TEXT, API_KEY, VOICE_ID);
      Alert.alert('Success', 'Audio played successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStreamingPlayback = async () => {
    setIsLoading(true);
    setMethod('Chunked Streaming');
    setProgress(null);
    
    try {
      await streamWithFileApproach(
        TEST_TEXT, 
        API_KEY, 
        VOICE_ID,
        (prog) => setProgress(prog)
      );
      Alert.alert('Success', 'Streaming completed');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDirectStreaming = async () => {
    setIsLoading(true);
    setMethod('Direct URL Streaming');
    setProgress(null);
    
    try {
      await streamAudioProper(TEST_TEXT, API_KEY, VOICE_ID);
      Alert.alert('Success', 'Direct streaming started');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ElevenLabs Streaming Solutions</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Method 1: Complete Audio</Text>
        <Text style={styles.description}>Downloads complete audio then plays</Text>
        <Button 
          title="Play Complete Audio" 
          onPress={handleCompletePlayback}
          disabled={isLoading}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Method 2: Chunked Simulation</Text>
        <Text style={styles.description}>Downloads then streams in chunks</Text>
        <Button 
          title="Stream with Chunks" 
          onPress={handleStreamingPlayback}
          disabled={isLoading}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Method 3: Direct POST Stream</Text>
        <Text style={styles.description}>Direct streaming with POST body</Text>
        <Button 
          title="Direct Stream" 
          onPress={handleDirectStreaming}
          disabled={isLoading}
        />
      </View>
      
      {isLoading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <Text style={styles.methodText}>Using: {method}</Text>
        </View>
      )}
      
      {progress && (
        <View style={styles.progress}>
          <Text style={styles.progressText}>
            Progress: {progress.percentage}%
          </Text>
          <Text style={styles.progressText}>
            Chunks: {progress.chunksReceived}
          </Text>
          <Text style={styles.progressText}>
            Bytes: {progress.bytesReceived} / {progress.totalBytes}
          </Text>
        </View>
      )}
    </View>
  );
};

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
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  loading: {
    marginTop: 20,
    alignItems: 'center',
  },
  methodText: {
    marginTop: 10,
    fontSize: 16,
    color: '#007AFF',
  },
  progress: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 5,
  },
}); 