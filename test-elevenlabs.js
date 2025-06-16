/**
 * ElevenLabs Memory Streaming Hızlı Test
 * 
 * Bu dosyayı direkt çalıştırarak test edebilirsiniz:
 * node test-elevenlabs.js
 */

// React Native ortamını simüle et
global.Platform = { OS: 'android' };
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

// Fetch polyfill (Node.js için)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// AudioStream mock
const AudioStream = {
  startMemoryStream: async (config) => {
    console.log('✅ Memory stream başlatıldı:', config);
    return true;
  },
  
  appendToMemoryStream: async (base64Data) => {
    console.log(`📦 Chunk eklendi: ${base64Data.length} karakter`);
    return true;
  },
  
  completeMemoryStream: async () => {
    console.log('✅ Memory stream tamamlandı');
    return true;
  },
  
  streamTTS: async function(text, config) {
    const { apiKey, voiceId, model = 'eleven_multilingual_v2', onProgress } = config;
    
    console.log('🎤 TTS Streaming başlatılıyor...');
    onProgress?.('Bağlanıyor...');
    
    // ElevenLabs API çağrısı
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
          optimize_streaming_latency: 4,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API hatası ${response.status}: ${error}`);
    }

    onProgress?.('Streaming...');
    
    // Memory stream başlat
    await this.startMemoryStream({ autoPlay: true });
    
    // Stream oku
    const reader = response.body.getReader();
    let totalBytes = 0;
    let chunkCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunkCount++;
      totalBytes += value.length;
      
      // Base64'e çevir
      const base64 = btoa(String.fromCharCode(...value));
      await this.appendToMemoryStream(base64);
      
      onProgress?.(`Alındı: ${Math.round(totalBytes / 1024)}KB (${chunkCount} chunk)`);
    }
    
    await this.completeMemoryStream();
    onProgress?.('Tamamlandı!');
    
    return { totalBytes, chunkCount };
  }
};

// Test fonksiyonu
async function testElevenLabsStreaming() {
  // ⚠️ BURAYA KENDİ API ANAHTARINIZI VE VOICE ID'NİZİ GİRİN
  const API_KEY = 'your-api-key-here';
  const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
  
  if (API_KEY === 'your-api-key-here') {
    console.error('❌ Lütfen API anahtarınızı girin!');
    console.log('\n📚 ElevenLabs API anahtarı almak için:');
    console.log('1. https://elevenlabs.io adresine gidin');
    console.log('2. Hesap oluşturun veya giriş yapın');
    console.log('3. Profile > API Keys bölümünden anahtarınızı kopyalayın');
    return;
  }

  const testTexts = [
    "Merhaba! Bu bir memory streaming testidir.",
    "React Native Audio Stream paketi ile gerçek zamanlı ses akışı yapılıyor.",
    "Android cihazlarda PipedInputStream kullanılarak düşük gecikme sağlanıyor."
  ];

  console.log('🚀 ElevenLabs Memory Streaming Test Başlıyor...\n');

  for (let i = 0; i < testTexts.length; i++) {
    console.log(`\n📝 Test ${i + 1}: "${testTexts[i]}"`);
    console.log('─'.repeat(50));
    
    const startTime = Date.now();
    
    try {
      const result = await AudioStream.streamTTS(testTexts[i], {
        apiKey: API_KEY,
        voiceId: VOICE_ID,
        onProgress: (status) => console.log(`   ${status}`)
      });
      
      const totalTime = Date.now() - startTime;
      
      console.log('\n📊 Sonuçlar:');
      console.log(`   ⏱️  Toplam süre: ${totalTime}ms`);
      console.log(`   📦 Chunk sayısı: ${result.chunkCount}`);
      console.log(`   💾 Toplam veri: ${(result.totalBytes / 1024).toFixed(2)}KB`);
      console.log(`   🚀 İlk chunk gecikmesi: ~${Math.round(totalTime / result.chunkCount)}ms`);
      
    } catch (error) {
      console.error(`\n❌ Hata: ${error.message}`);
      
      if (error.message.includes('401')) {
        console.log('\n⚠️  API anahtarınız geçersiz. Lütfen kontrol edin.');
      } else if (error.message.includes('429')) {
        console.log('\n⚠️  Rate limit aşıldı. Biraz bekleyin.');
      }
    }
    
    // Test arası bekleme
    if (i < testTexts.length - 1) {
      console.log('\n⏳ Sonraki test için 2 saniye bekleniyor...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n✅ Tüm testler tamamlandı!');
  console.log('\n💡 İpucu: Gerçek uygulamada AudioStream sınıfını import edin:');
  console.log("   import AudioStream from '@mustafakarali/react-native-audio-stream';");
}

// Detaylı performans testi
async function performanceTest() {
  const API_KEY = 'your-api-key-here';
  const VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
  
  if (API_KEY === 'your-api-key-here') {
    console.error('❌ API anahtarı gerekli!');
    return;
  }

  console.log('🏁 Performans Testi Başlıyor...\n');

  const testCases = [
    { text: "Kısa metin.", expectedTime: 1000 },
    { text: "Bu orta uzunlukta bir test metnidir. Birkaç cümle içerir ve yaklaşık 100 karakter uzunluğundadır.", expectedTime: 2000 },
    { text: "Bu çok uzun bir test metnidir. " + "Lorem ipsum dolor sit amet. ".repeat(10) + "Toplam 500+ karakter içerir ve streaming performansını test eder.", expectedTime: 4000 }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n📏 Metin uzunluğu: ${testCase.text.length} karakter`);
    
    const startTime = Date.now();
    let firstChunkTime = null;
    let metrics = {
      chunks: 0,
      bytes: 0
    };

    try {
      await AudioStream.streamTTS(testCase.text, {
        apiKey: API_KEY,
        voiceId: VOICE_ID,
        onProgress: (status) => {
          if (status.includes('Alındı') && !firstChunkTime) {
            firstChunkTime = Date.now() - startTime;
          }
          if (status.includes('chunk')) {
            const match = status.match(/(\d+)KB.*?(\d+) chunk/);
            if (match) {
              metrics.bytes = parseFloat(match[1]) * 1024;
              metrics.chunks = parseInt(match[2]);
            }
          }
        }
      });

      const totalTime = Date.now() - startTime;
      
      results.push({
        textLength: testCase.text.length,
        totalTime,
        firstChunkTime: firstChunkTime || 0,
        chunks: metrics.chunks,
        bytes: metrics.bytes,
        performance: totalTime <= testCase.expectedTime ? '✅ İYİ' : '⚠️ YAVAŞ'
      });

      console.log(`✅ Tamamlandı: ${totalTime}ms (Beklenen: <${testCase.expectedTime}ms)`);
      
    } catch (error) {
      console.error(`❌ Hata: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Özet rapor
  console.log('\n📊 PERFORMANS RAPORU');
  console.log('═'.repeat(60));
  console.log('Karakter | Toplam | İlk Chunk | Chunks | Veri    | Durum');
  console.log('─'.repeat(60));
  
  results.forEach(r => {
    console.log(
      `${r.textLength.toString().padEnd(8)} | ` +
      `${r.totalTime}ms`.padEnd(7) + ' | ' +
      `${r.firstChunkTime}ms`.padEnd(9) + ' | ' +
      `${r.chunks}`.padEnd(6) + ' | ' +
      `${(r.bytes/1024).toFixed(1)}KB`.padEnd(7) + ' | ' +
      r.performance
    );
  });

  // Ortalamalar
  if (results.length > 0) {
    const avgFirstChunk = results.reduce((a, b) => a + b.firstChunkTime, 0) / results.length;
    const avgTotal = results.reduce((a, b) => a + b.totalTime, 0) / results.length;
    
    console.log('─'.repeat(60));
    console.log(`\n📈 Ortalamalar:`);
    console.log(`   İlk chunk gecikmesi: ${Math.round(avgFirstChunk)}ms`);
    console.log(`   Toplam süre: ${Math.round(avgTotal)}ms`);
    console.log(`   Başarı oranı: ${results.filter(r => r.performance.includes('İYİ')).length}/${results.length}`);
  }
}

// Ana test
async function main() {
  console.log('🎯 ElevenLabs Memory Streaming Test Suite\n');
  console.log('1. Basit test için: node test-elevenlabs.js');
  console.log('2. Performans testi için: node test-elevenlabs.js perf\n');

  const args = process.argv.slice(2);
  
  if (args[0] === 'perf') {
    await performanceTest();
  } else {
    await testElevenLabsStreaming();
  }
}

// Çalıştır
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testElevenLabsStreaming, performanceTest }; 