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