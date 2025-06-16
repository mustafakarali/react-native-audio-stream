/**
 * ElevenLabs Memory Streaming Örneği
 * React Native Audio Stream v1.11.0
 * 
 * Bu örnek, ElevenLabs TTS API'sini kullanarak gerçek zamanlı
 * ses streaming'i nasıl yapılacağını gösterir.
 */

import AudioStream from '@mustafakarali/react-native-audio-stream';
import { Platform } from 'react-native';

// ElevenLabs API ayarları
const ELEVENLABS_API_KEY = 'your-api-key-here';
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel voice
const MODEL_ID = 'eleven_multilingual_v2';

/**
 * Basit TTS streaming - Otomatik platform optimizasyonu
 */
async function simpleElevenLabsStream(text) {
  try {
    console.log('Starting simple TTS stream...');
    
    await AudioStream.streamTTS(text, {
      apiKey: ELEVENLABS_API_KEY,
      voiceId: VOICE_ID,
      model: MODEL_ID,
      onProgress: (status) => console.log('Status:', status)
    });
    
    console.log('TTS streaming completed!');
  } catch (error) {
    console.error('TTS streaming error:', error);
  }
}

/**
 * Manuel memory streaming kontrolü
 */
async function manualMemoryStreaming(text) {
  try {
    console.log('Starting manual memory streaming...');
    const startTime = Date.now();
    
    // AudioStream'i başlat
    const stream = AudioStream.getInstance();
    await stream.initialize();
    
    // Android için memory stream başlat
    if (Platform.OS === 'android') {
      await AudioStream.startMemoryStream({ autoPlay: true });
    }
    
    // ElevenLabs API'ye istek at
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
          optimize_streaming_latency: 4, // Maksimum optimizasyon
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    // Stream reader'ı al
    const reader = response.body.getReader();
    let totalBytes = 0;
    let chunkCount = 0;

    // Chunk'ları oku ve oynat
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkCount++;
      totalBytes += value.length;
      
      // Uint8Array'i base64'e çevir
      const base64 = btoa(String.fromCharCode(...value));
      
      // Platform'a göre streaming yap
      if (Platform.OS === 'android') {
        await AudioStream.appendToMemoryStream(base64);
      } else {
        await stream.appendToBuffer(base64);
      }
      
      console.log(`Chunk ${chunkCount}: ${value.length} bytes (Total: ${totalBytes} bytes)`);
    }

    // Android memory stream'i tamamla
    if (Platform.OS === 'android') {
      await AudioStream.completeMemoryStream();
    }

    const totalTime = Date.now() - startTime;
    console.log(`\nStreaming completed!`);
    console.log(`Total chunks: ${chunkCount}`);
    console.log(`Total bytes: ${totalBytes}`);
    console.log(`Total time: ${totalTime}ms`);
    
  } catch (error) {
    console.error('Manual streaming error:', error);
  }
}

/**
 * Gelişmiş streaming - Progress callback ile
 */
async function advancedElevenLabsStream(text) {
  const stream = AudioStream.getInstance();
  
  try {
    // Event listener'ları ekle
    stream.addEventListener('onStreamStateChange', (state) => {
      console.log('Stream state:', state.state);
    });
    
    stream.addEventListener('onStreamProgress', (progress) => {
      console.log(`Progress: ${progress.currentTime}s / ${progress.duration}s`);
    });
    
    stream.addEventListener('onStreamError', (error) => {
      console.error('Stream error:', error);
    });

    // Memory streaming ile TTS başlat
    console.log('Starting advanced TTS stream...');
    const startTime = Date.now();
    
    if (Platform.OS === 'android') {
      await AudioStream.startMemoryStream({ autoPlay: true });
    }

    // Custom fetch ile daha fazla kontrol
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75, // Daha yüksek benzerlik
          },
          optimize_streaming_latency: 4,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    // Streaming metrics
    let firstChunkTime = null;
    let totalBytes = 0;
    let chunkCount = 0;

    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstChunkTime) {
        firstChunkTime = Date.now() - startTime;
        console.log(`First chunk received in: ${firstChunkTime}ms`);
      }

      chunkCount++;
      totalBytes += value.length;
      
      // Base64 conversion
      const base64 = btoa(String.fromCharCode(...value));
      
      if (Platform.OS === 'android') {
        await AudioStream.appendToMemoryStream(base64);
      } else {
        await stream.appendToBuffer(base64);
      }
    }

    if (Platform.OS === 'android') {
      await AudioStream.completeMemoryStream();
    }

    const totalTime = Date.now() - startTime;
    console.log('\n=== Streaming Metrics ===');
    console.log(`First chunk latency: ${firstChunkTime}ms`);
    console.log(`Total streaming time: ${totalTime}ms`);
    console.log(`Total chunks: ${chunkCount}`);
    console.log(`Total data: ${(totalBytes / 1024).toFixed(2)}KB`);
    console.log(`Average chunk size: ${(totalBytes / chunkCount / 1024).toFixed(2)}KB`);
    
  } catch (error) {
    console.error('Advanced streaming error:', error);
  } finally {
    // Cleanup
    stream.removeAllEventListeners();
  }
}

/**
 * Test fonksiyonları
 */
export async function testSimpleStreaming() {
  await simpleElevenLabsStream(
    "Merhaba! Bu, React Native Audio Stream paketi ile ElevenLabs " +
    "memory streaming örneğidir. Gerçek zamanlı ses akışı test ediliyor."
  );
}

export async function testManualStreaming() {
  await manualMemoryStreaming(
    "Bu manuel memory streaming örneğidir. Android'de PipedInputStream " +
    "kullanılarak düşük gecikmeli ses akışı sağlanıyor."
  );
}

export async function testAdvancedStreaming() {
  await advancedElevenLabsStream(
    "Gelişmiş streaming örneği çalışıyor. Bu örnekte detaylı metrikler " +
    "ve hata yönetimi ile birlikte profesyonel seviye streaming yapılıyor. " +
    "Gecikme süreleri ve veri transferi istatistikleri toplanıyor."
  );
}

/**
 * React Native Component Örneği
 */
import React, { useState } from 'react';
import { View, Button, TextInput, Text, StyleSheet } from 'react-native';

export function ElevenLabsStreamingDemo() {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState('');

  const handleStream = async () => {
    if (!text.trim()) {
      setStatus('Lütfen bir metin girin');
      return;
    }

    setIsStreaming(true);
    setStatus('Streaming başlatılıyor...');

    try {
      await AudioStream.streamTTS(text, {
        apiKey: ELEVENLABS_API_KEY,
        voiceId: VOICE_ID,
        onProgress: (progressStatus) => {
          setStatus(progressStatus);
        }
      });
      
      setStatus('Streaming tamamlandı!');
    } catch (error) {
      setStatus(`Hata: ${error.message}`);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ElevenLabs Memory Streaming</Text>
      
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Seslendirilecek metni girin..."
        multiline
      />
      
      <Button
        title={isStreaming ? "Streaming..." : "Seslendirmeyi Başlat"}
        onPress={handleStream}
        disabled={isStreaming}
      />
      
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  status: {
    marginTop: 20,
    textAlign: 'center',
    color: '#666',
  },
});

// Kullanım
console.log(`
🎯 ElevenLabs Memory Streaming Kullanım Örnekleri:

1. Basit kullanım:
   await testSimpleStreaming();

2. Manuel kontrol:
   await testManualStreaming();

3. Gelişmiş kullanım:
   await testAdvancedStreaming();

4. React Native Component:
   <ElevenLabsStreamingDemo />

⚡ Önemli: API anahtarınızı ve voice ID'nizi güncellemeyi unutmayın!
`); 