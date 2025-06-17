/**
 * ElevenLabs TTS Streaming - Çalışan Örnek
 * Bu örnek buffered streaming (Method 2) kullanır
 */

import AudioStream from '@mustafakarali/react-native-audio-stream';

const ELEVENLABS_API_KEY = '7ceab04a771c641dc82ae0b2e9877737';
const VOICE_ID = 'OcKmy6I5XAX8VsOyJ4r4';

// AudioStream'i başlat
const initializeAudioStream = async () => {
  try {
    await AudioStream.initialize({
      enableCache: true,
      cacheSize: 50 * 1024 * 1024, // 50MB
      prebufferDuration: 2,
      bufferDuration: 10,
    });
    console.log('AudioStream başlatıldı');
  } catch (error) {
    console.error('AudioStream başlatma hatası:', error);
  }
};

// Method 1: Complete Audio (ÇALIŞIYOR)
export const playCompleteAudio = async (text) => {
  try {
    console.log('Complete audio başlatılıyor...');
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Tüm veriyi al ve base64'e çevir
    const audioData = await response.arrayBuffer();
    const base64Audio = btoa(
      new Uint8Array(audioData).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    // playFromData ile çal
    await AudioStream.playFromData(base64Audio, {
      autoPlay: true,
      volume: 1.0,
    });

    console.log('Complete audio çalıyor');
  } catch (error) {
    console.error('Complete audio hatası:', error);
  }
};

// Method 2: Buffered Streaming (FIXED)
export const playBufferedStreaming = async (text) => {
  try {
    console.log('Buffered streaming başlatılıyor...');
    
    // Önce boş bir stream başlat
    await AudioStream.startStream('buffered://stream', {
      autoPlay: true,
      enableCache: true,
      prebufferDuration: 1,
    });

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
          optimize_streaming_latency: 3,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    let totalChunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log(`Streaming tamamlandı. Toplam chunk: ${totalChunks}`);
        break;
      }

      // Chunk'ı base64'e çevir
      const base64Chunk = btoa(
        new Uint8Array(value).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      // Buffer'a ekle
      await AudioStream.appendToBuffer(base64Chunk);
      totalChunks++;
      console.log(`Chunk ${totalChunks} eklendi (${value.byteLength} bytes)`);
    }

  } catch (error) {
    console.error('Buffered streaming hatası:', error);
  }
};

// Method 3: Alternatif - Sequential Playback
export const playSequentialChunks = async (text) => {
  try {
    console.log('Sequential playback başlatılıyor...');
    
    const chunks = [];
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
          optimize_streaming_latency: 3,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    
    // Önce tüm chunk'ları topla
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
    }

    console.log(`${chunks.length} chunk toplandı`);

    // Chunk'ları birleştir ve çal
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const mergedArray = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      mergedArray.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // Base64'e çevir ve çal
    const base64Audio = btoa(
      Array.from(mergedArray).map(byte => String.fromCharCode(byte)).join('')
    );

    await AudioStream.playFromData(base64Audio, {
      autoPlay: true,
      volume: 1.0,
    });

    console.log('Sequential playback başladı');

  } catch (error) {
    console.error('Sequential playback hatası:', error);
  }
};

// Test fonksiyonu
export const testElevenLabsStreaming = async () => {
  await initializeAudioStream();

  const testText = "Merhaba! Bu bir test mesajıdır. ElevenLabs text-to-speech API'si ile ses sentezleme yapıyoruz.";

  console.log('\n=== METHOD 1: Complete Audio ===');
  await playCompleteAudio(testText);
  
  // 5 saniye bekle
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n=== METHOD 2: Buffered Streaming ===');
  await playBufferedStreaming(testText);
  
  // 5 saniye bekle
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n=== METHOD 3: Sequential Chunks ===');
  await playSequentialChunks(testText);
};

// React Native component'te kullanım örneği:
/*
import { playCompleteAudio, playBufferedStreaming, playSequentialChunks } from './elevenlabs-streaming-fixed';

// Component içinde:
const handlePlayTTS = async (method) => {
  const text = "Test metni";
  
  switch(method) {
    case 1:
      await playCompleteAudio(text);
      break;
    case 2:
      await playBufferedStreaming(text);
      break;
    case 3:
      await playSequentialChunks(text);
      break;
  }
};
*/ 