/**
 * React Native Audio Stream - Basit Kullanım Örnekleri
 * v1.11.0
 */

import AudioStream from '@mustafakarali/react-native-audio-stream';

// 1. TEMEL KULLANIM - MP3 Dosyası Oynatma
async function playMP3() {
  // Initialize
  await AudioStream.initialize();
  
  // Play MP3
  await AudioStream.startStream('https://example.com/audio.mp3', {
    autoPlay: true
  });
  
  // Kontroller
  await AudioStream.pause();
  await AudioStream.play();
  await AudioStream.stop();
}

// 2. BASE64 SES OYNATMA (ElevenLabs API Response)
async function playBase64Audio(base64Data) {
  await AudioStream.initialize();
  await AudioStream.playFromData(base64Data, { autoPlay: true });
}

// 3. GERÇEK ZAMANLI STREAMING (Yeni!)
async function streamElevenLabs(text, apiKey, voiceId) {
  await AudioStream.initialize();
  
  // Otomatik platform optimizasyonu
  await AudioStream.streamTTS(text, {
    apiKey: apiKey,
    voiceId: voiceId,
    onProgress: (status) => console.log(status)
  });
}

// 4. MANUEL MEMORY STREAMING (Android)
async function manualMemoryStream() {
  if (Platform.OS === 'android') {
    // Memory stream başlat
    await AudioStream.startMemoryStream({ autoPlay: true });
    
    // Chunk'ları ekle
    await AudioStream.appendToMemoryStream(base64Chunk1);
    await AudioStream.appendToMemoryStream(base64Chunk2);
    
    // Tamamla
    await AudioStream.completeMemoryStream();
  }
}

// 5. EVENT HANDLING
function setupEvents() {
  const stream = AudioStream.getInstance();
  
  stream.addEventListener('onStreamStateChange', (state) => {
    console.log('State:', state.state);
  });
  
  stream.addEventListener('onStreamProgress', (progress) => {
    console.log(`Progress: ${progress.currentTime}s / ${progress.duration}s`);
  });
  
  stream.addEventListener('onStreamError', (error) => {
    console.error('Error:', error.message);
  });
}

// 6. ELEVENLABS İLE HIZLI KULLANIM
async function quickTTS() {
  const API_KEY = 'your-api-key';
  const VOICE_ID = 'your-voice-id';
  
  // Tek satırda TTS
  await AudioStream.streamTTS('Merhaba dünya!', {
    apiKey: API_KEY,
    voiceId: VOICE_ID
  });
}

// 7. ÖZEL STREAMING İMPLEMENTASYONU
async function customStreaming(apiEndpoint) {
  // Veriyi al
  const response = await fetch(apiEndpoint);
  const reader = response.body.getReader();
  
  // Android için memory streaming
  if (Platform.OS === 'android') {
    await AudioStream.startMemoryStream({ autoPlay: true });
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Uint8Array'i base64'e çevir
      const base64 = btoa(String.fromCharCode(...value));
      await AudioStream.appendToMemoryStream(base64);
    }
    
    await AudioStream.completeMemoryStream();
  } else {
    // iOS için normal streaming
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const base64 = btoa(String.fromCharCode(...value));
      await AudioStream.appendToBuffer(base64);
    }
  }
}

// 8. HER ŞEYİ BİR ARADA
export default class AudioPlayer {
  constructor() {
    this.stream = AudioStream.getInstance();
  }
  
  async init() {
    await this.stream.initialize({
      enableCache: true,
      cacheSize: 50, // MB
      enableLogs: true
    });
    
    this.setupEvents();
  }
  
  setupEvents() {
    this.stream.addEventListener('onStreamStateChange', this.handleStateChange);
    this.stream.addEventListener('onStreamError', this.handleError);
  }
  
  handleStateChange = (state) => {
    console.log('State changed:', state.state);
  }
  
  handleError = (error) => {
    console.error('Stream error:', error);
  }
  
  async playURL(url) {
    await this.stream.startStream(url, { autoPlay: true });
  }
  
  async playTTS(text, apiKey, voiceId) {
    await AudioStream.streamTTS(text, { apiKey, voiceId });
  }
  
  async cleanup() {
    await this.stream.destroy();
  }
}

// KULLANIM ÖRNEĞİ
async function main() {
  const player = new AudioPlayer();
  await player.init();
  
  // URL oynat
  await player.playURL('https://example.com/audio.mp3');
  
  // TTS oynat
  await player.playTTS('Merhaba!', 'api-key', 'voice-id');
  
  // Temizle
  await player.cleanup();
}

console.log(`
📦 @mustafakarali/react-native-audio-stream v1.11.0

✨ YENİ ÖZELLİKLER:
- Memory-based streaming (Android)
- Otomatik platform optimizasyonu
- Basit TTS entegrasyonu
- Gelişmiş hata yönetimi

🚀 PERFORMANS:
- İlk ses: <500ms (Memory streaming)
- Gecikme: 300-700ms (Optimum koşullarda)
- Bellek: 2MB buffer

📱 PLATFORM DESTEĞİ:
- Android: Memory streaming ile gerçek zamanlı
- iOS: appendToBuffer ile chunk streaming

🔗 DOKÜMANTASYON:
https://github.com/mustafakarali/react-native-audio-stream
`); 