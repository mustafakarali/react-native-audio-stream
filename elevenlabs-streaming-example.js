import React, { useState, useEffect } from 'react';
import { 
  View, 
  Button, 
  TextInput, 
  Text, 
  ActivityIndicator, 
  Alert, 
  NativeEventEmitter, 
  NativeModules,
  Platform,
  StyleSheet 
} from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

const ELEVEN_LABS_API_KEY = '7ceab04a771c641dc82ae0b2e9877737'; // API key'inizi buraya koyun
const VOICE_ID = 'OcKmy6I5XAX8VsOyJ4r4'; // Sizin voice ID'niz

// Event emitter
const audioStreamEmitter = new NativeEventEmitter(NativeModules.RNAudioStream);

export default function ElevenLabsStreamingExample() {
  const [text, setText] = useState('Merhaba! Bu, ElevenLabs ile gerçek zamanlı ses akışı örneğidir. Metin uzadıkça, ses akışı chunk chunk oynatılacak ve daha hızlı başlayacaktır.');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Hazır');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamStats, setStreamStats] = useState(null);

  useEffect(() => {
    initializeAudioStream();

    // Event listeners
    const subscriptions = [];

    subscriptions.push(
      audioStreamEmitter.addListener('onStreamStateChange', (event) => {
        console.log('Stream state changed:', event.state);
        setStatus(`Durum: ${event.state}`);
        setIsPlaying(event.state === 'playing');
      })
    );

    subscriptions.push(
      audioStreamEmitter.addListener('onStreamError', (error) => {
        console.error('Stream error:', error);
        Alert.alert('Stream Hatası', error.message || 'Bilinmeyen hata');
        setLoading(false);
      })
    );

    subscriptions.push(
      audioStreamEmitter.addListener('onStreamProgress', (progress) => {
        setStatus(`Oynatılıyor: ${Math.round(progress.currentTime)}s / ${Math.round(progress.duration)}s`);
      })
    );

    subscriptions.push(
      audioStreamEmitter.addListener('onStreamEnd', () => {
        console.log('Stream ended');
        setStatus('Tamamlandı');
        setLoading(false);
      })
    );

    return () => {
      subscriptions.forEach(sub => sub.remove());
      AudioStream.destroy();
    };
  }, []);

  const initializeAudioStream = async () => {
    try {
      await AudioStream.initialize({
        bufferSize: 4096,
        autoPlay: true,
        enableLogs: true,
      });
      setIsInitialized(true);
      console.log('AudioStream başarıyla başlatıldı');
    } catch (error) {
      console.error('AudioStream başlatılamadı:', error);
      Alert.alert('Hata', 'Ses akışı başlatılamadı');
    }
  };

  // Yöntem 1: Complete Audio (En güvenilir)
  const streamWithCompleteAudio = async () => {
    if (!isInitialized) {
      Alert.alert('Hata', 'AudioStream henüz başlatılmadı');
      return;
    }

    try {
      setLoading(true);
      setStatus('ElevenLabs API\'ye bağlanılıyor...');

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': ELEVEN_LABS_API_KEY,
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
        const errorText = await response.text();
        throw new Error(`API Hatası: ${response.status} - ${errorText}`);
      }

      setStatus('Ses verisi alınıyor...');

      // Blob olarak al
      const blob = await response.blob();
      
      // FileReader ile base64'e çevir
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = reader.result;
          const base64Audio = base64data.split(',')[1]; // data:audio/mpeg;base64, kısmını kaldır
          
          setStatus('Ses oynatılıyor...');
          
          // Base64'ten oynat
          await AudioStream.playFromData(base64Audio, { autoPlay: true });
          
        } catch (err) {
          console.error('Oynatma hatası:', err);
          Alert.alert('Hata', 'Ses oynatılamadı');
        }
      };
      reader.onerror = () => {
        Alert.alert('Hata', 'Ses verisi okunamadı');
        setLoading(false);
      };
      reader.readAsDataURL(blob);

    } catch (error) {
      console.error('Hata:', error);
      Alert.alert('Hata', error.message);
      setStatus('Hata: ' + error.message);
      setLoading(false);
    }
  };

  // Yöntem 2: Simulated Streaming (Chunk'lara bölerek)
  const streamWithChunks = async () => {
    if (!isInitialized) {
      Alert.alert('Hata', 'AudioStream henüz başlatılmadı');
      return;
    }

    try {
      setLoading(true);
      setStatus('Streaming başlatılıyor...');

      // Önce silent MP3 ile stream başlat
      const SILENT_MP3 = '//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAABhAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      
      await AudioStream.playFromData(SILENT_MP3, { autoPlay: false });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setStatus('ElevenLabs API\'ye bağlanılıyor...');

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': ELEVEN_LABS_API_KEY,
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
        const errorText = await response.text();
        throw new Error(`API Hatası: ${response.status} - ${errorText}`);
      }

      setStatus('Ses verisi alınıyor ve chunk\'lara bölünüyor...');

      // Tüm veriyi al ve chunk'lara böl
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const totalSize = arrayBuffer.byteLength;
      const chunkSize = 4096; // 4KB chunks
      let offset = 0;
      let chunkNumber = 0;

      // İlk chunk'ı hemen oynat
      await AudioStream.play();

      while (offset < totalSize) {
        const chunk = arrayBuffer.slice(offset, Math.min(offset + chunkSize, totalSize));
        const uint8Array = new Uint8Array(chunk);
        
        // Base64'e çevir
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Chunk = btoa(binary);
        
        chunkNumber++;
        setStatus(`Chunk ${chunkNumber} oynatılıyor (${Math.round((offset / totalSize) * 100)}%)`);
        
        // Chunk'ı buffer'a ekle
        await AudioStream.appendToBuffer(base64Chunk);
        
        offset += chunkSize;
        
        // Küçük bir gecikme ekle (streaming simülasyonu)
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      setStatus(`Streaming tamamlandı (${chunkNumber} chunk)`);
      setLoading(false);

    } catch (error) {
      console.error('Streaming hatası:', error);
      Alert.alert('Streaming Hatası', error.message);
      setStatus('Hata: ' + error.message);
      setLoading(false);
    }
  };

  // Yöntem 3: Android Real-time Streaming (Sadece Android)
  const streamWithRealtimeAndroid = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Uyarı', 'Real-time streaming sadece Android\'de kullanılabilir');
      return;
    }

    if (!isInitialized) {
      Alert.alert('Hata', 'AudioStream henüz başlatılmadı');
      return;
    }

    try {
      setLoading(true);
      setStatus('Real-time streaming başlatılıyor...');

      // Native modülü al
      const RNAudioStream = NativeModules.RNAudioStream;
      
      // Real-time stream başlat
      await RNAudioStream.startRealtimeStream({ autoPlay: true });

      setStatus('ElevenLabs API\'ye bağlanılıyor...');

      // XMLHttpRequest kullan (daha iyi streaming kontrolü)
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      
      let chunksReceived = 0;
      let lastProcessedIndex = 0;
      let statsInterval;

      // Progress handler
      xhr.onprogress = async (event) => {
        if (xhr.response && xhr.response.byteLength > lastProcessedIndex) {
          try {
            // Yeni chunk'ı al
            const newData = xhr.response.slice(lastProcessedIndex);
            const uint8Array = new Uint8Array(newData);
            
            // Base64'e çevir
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const base64Chunk = btoa(binary);
            
            // Real-time stream'e ekle
            await RNAudioStream.appendRealtimeData(base64Chunk);
            
            chunksReceived++;
            lastProcessedIndex = xhr.response.byteLength;
            
            setStatus(`Real-time streaming: Chunk ${chunksReceived}`);
          } catch (err) {
            console.error('Chunk işleme hatası:', err);
          }
        }
      };

      // İstatistikleri göster
      statsInterval = setInterval(async () => {
        try {
          const stats = await RNAudioStream.getStreamingStats();
          setStreamStats(stats);
        } catch (err) {
          // İstatistik hatası önemsiz
        }
      }, 1000);

      xhr.onload = async () => {
        clearInterval(statsInterval);
        if (xhr.status === 200) {
          await RNAudioStream.completeRealtimeStream();
          setStatus(`Real-time streaming tamamlandı (${chunksReceived} chunk)`);
        } else {
          throw new Error(`HTTP ${xhr.status}`);
        }
        setLoading(false);
      };

      xhr.onerror = () => {
        clearInterval(statsInterval);
        setLoading(false);
        Alert.alert('Hata', 'Ağ hatası');
      };

      // İsteği gönder
      xhr.open('POST', `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`);
      xhr.setRequestHeader('xi-api-key', ELEVEN_LABS_API_KEY);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'audio/mpeg');
      
      xhr.send(JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
        optimize_streaming_latency: 3,
      }));

    } catch (error) {
      console.error('Real-time streaming hatası:', error);
      Alert.alert('Real-time Streaming Hatası', error.message);
      setStatus('Hata: ' + error.message);
      setLoading(false);
    }
  };

  const stopAudio = async () => {
    try {
      await AudioStream.stop();
      setStatus('Durduruldu');
      setStreamStats(null);
    } catch (error) {
      console.error('Durdurma hatası:', error);
    }
  };

  const pauseResumeAudio = async () => {
    try {
      if (isPlaying) {
        await AudioStream.pause();
        setStatus('Duraklatıldı');
      } else {
        await AudioStream.play();
        setStatus('Oynatılıyor');
      }
    } catch (error) {
      console.error('Duraklatma/Devam hatası:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        ElevenLabs TTS Streaming
      </Text>

      <Text style={[styles.statusText, { color: isInitialized ? 'green' : 'red' }]}>
        AudioStream: {isInitialized ? 'Başlatıldı ✓' : 'Başlatılmadı'}
      </Text>

      <TextInput
        style={styles.textInput}
        value={text}
        onChangeText={setText}
        placeholder="Konuşulacak metni girin..."
        multiline
      />

      <View style={styles.buttonContainer}>
        <Button
          title={loading ? 'İşleniyor...' : 'Yöntem 1: Complete Audio'}
          onPress={streamWithCompleteAudio}
          disabled={loading || !text.trim() || !isInitialized}
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title={loading ? 'İşleniyor...' : 'Yöntem 2: Chunk Streaming'}
          onPress={streamWithChunks}
          disabled={loading || !text.trim() || !isInitialized}
          color="#2196F3"
        />
      </View>

      {Platform.OS === 'android' && (
        <View style={styles.buttonContainer}>
          <Button
            title={loading ? 'İşleniyor...' : 'Yöntem 3: Real-time (Android)'}
            onPress={streamWithRealtimeAndroid}
            disabled={loading || !text.trim() || !isInitialized}
            color="#4CAF50"
          />
        </View>
      )}

      <View style={styles.controlsContainer}>
        <Button
          title={isPlaying ? 'Duraklat' : 'Devam Et'}
          onPress={pauseResumeAudio}
          color="orange"
        />
        <Button
          title="Durdur"
          onPress={stopAudio}
          color="red"
        />
      </View>

      <Text style={styles.statusLabel}>
        Durum: {status}
      </Text>

      {streamStats && Platform.OS === 'android' && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>Yazılan: {streamStats.bytesWritten} byte</Text>
          <Text style={styles.statsText}>Okunan: {streamStats.bytesRead} byte</Text>
        </View>
      )}

      {loading && <ActivityIndicator size="large" style={styles.loader} />}

      <Text style={styles.infoText}>
        💡 İpucu: {'\n'}
        • Yöntem 1: Tüm ses indirilir, sonra oynatılır{'\n'}
        • Yöntem 2: İndirilen ses chunk'lara bölünerek oynatılır{'\n'}
        {Platform.OS === 'android' && '• Yöntem 3: Gerçek byte-by-byte streaming (en hızlı)'}
      </Text>
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusText: {
    marginBottom: 10,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginVertical: 5,
  },
  controlsContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusLabel: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
  },
  statsContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  statsText: {
    fontSize: 12,
    color: '#666',
  },
  loader: {
    marginTop: 20,
  },
  infoText: {
    marginTop: 20,
    textAlign: 'left',
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
}); 