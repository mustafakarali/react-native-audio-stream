import React, { useState, useEffect } from 'react';
import { View, Button, TextInput, Text, ActivityIndicator, Alert, NativeEventEmitter, NativeModules } from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

const ELEVEN_LABS_API_KEY = '7ceab04a771c641dc82ae0b2e9877737'; // API key'inizi buraya koyun
const VOICE_ID = 'OcKmy6I5XAX8VsOyJ4r4'; // Sizin voice ID'niz

// Event emitter
const audioStreamEmitter = new NativeEventEmitter(NativeModules.RNAudioStream);

export default function ElevenLabsExample() {
  const [text, setText] = useState('Bir zamanlar, sayılar ülkesinde küçük bir sayı yaşarmış: adı Beş. Beş, diğer büyük sayılara göre kendini hep yetersiz hissedermiş. Bir gün, bir problemle karşılaşmış: Okuldaki matematik yarışmasında, toplamı on eden iki sayı bulmaları gerekiyormuş.\n' +
    '\n' +
    'Beş düşünmüş, taşınmış ve kendisi gibi başka bir sayıyla, yani yine Beş ile bir araya gelirse on edebileceğini fark etmiş. Hemen gidip diğer Beş\'i bulmuş. Birlikte jüriye gitmişler ve cevabı vermiş:\n' +
    '— "Biz, Beş ve Beş. Birlikte on ederiz!"\n' +
    '\n' +
    'Jüri çok mutlu olmuş. O günden sonra Beş, tek başına küçük görünse de, bir araya geldiğinde büyük sonuçlar ortaya çıkarabileceğini anlamış.\n' +
    'Artık kendine güveni tammış ve matematiğin en güzel tarafı olduğunu düşünüyormuş:\n' +
    '— "Yalnızken küçük olabilirsin, ama doğru birleştirildiğinde büyük şeyler başarabilirsin!"\n' +
    '\n' +
    'Ve Beş, matematiği daha çok sevmiş.');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    initializeAudioStream();

    // Event listeners
    const subscriptions = [];

    subscriptions.push(
      audioStreamEmitter.addListener('onStreamStateChange', (event) => {
        console.log('Stream state changed:', event.state);
        setStatus(`State: ${event.state}`);
        setIsPlaying(event.state === 'playing');
      })
    );

    subscriptions.push(
      audioStreamEmitter.addListener('onStreamError', (error) => {
        console.error('Stream error:', error);
        Alert.alert('Stream Error', error.message || 'Unknown error');
      })
    );

    subscriptions.push(
      audioStreamEmitter.addListener('onStreamProgress', (progress) => {
        setStatus(`Playing: ${Math.round(progress.currentTime)}s / ${Math.round(progress.duration)}s`);
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
        enableBackgroundMode: true,
        autoPlay: true,
        enableLogs: true,
      });
      setIsInitialized(true);
      console.log('AudioStream initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioStream:', error);
      Alert.alert('Error', 'Failed to initialize audio stream');
    }
  };

  const speak = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'AudioStream not initialized yet');
      return;
    }

    try {
      setLoading(true);
      setStatus('Fetching audio from ElevenLabs...');

      // ElevenLabs API'ye istek at
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
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
              style: 0,
              use_speaker_boost: true,
            },
            optimize_streaming_latency: 3,
            output_format: 'mp3_44100_128',
          }),
        }
      );

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      setStatus('Converting audio data...');

      // ArrayBuffer olarak al
      const arrayBuffer = await response.arrayBuffer();
      console.log('ArrayBuffer size:', arrayBuffer.byteLength);

      // Uint8Array'e çevir
      const uint8Array = new Uint8Array(arrayBuffer);

      // Base64'e çevir
      let binary = '';
      const chunkSize = 32 * 1024; // 32KB chunks

      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode(...chunk);
      }

      const base64Audio = btoa(binary);
      console.log('Base64 length:', base64Audio.length);

      setStatus('Playing audio directly from base64...');

      // Direkt base64'ten oynat (dosyaya kaydetmeden!)
      await AudioStream.playFromData(base64Audio, {
        autoPlay: true,
      });

      setStatus('Playing from base64 data');

    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', error.message);
      setStatus('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const stopAudio = async () => {
    try {
      await AudioStream.stop();
      setStatus('Stopped');
    } catch (error) {
      console.error('Stop error:', error);
    }
  };

  const pauseResumeAudio = async () => {
    try {
      if (isPlaying) {
        await AudioStream.pause();
        setStatus('Paused');
      } else {
        await AudioStream.play();
        setStatus('Playing');
      }
    } catch (error) {
      console.error('Pause/Resume error:', error);
    }
  };

  // Streaming versiyonu - chunk chunk oynatma
  const speakWithStreaming = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'AudioStream not initialized yet');
      return;
    }

    try {
      setLoading(true);
      setStatus('Starting stream...');

      // Önce boş stream başlat
      await AudioStream.startStream('', { autoPlay: true });

      setStatus('Fetching audio stream from ElevenLabs...');

      // ElevenLabs API'ye istek at
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
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
              style: 0,
              use_speaker_boost: true,
            },
            optimize_streaming_latency: 4, // Maksimum hız için
            output_format: 'mp3_44100_128',
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      setStatus('Streaming audio chunks...');

      // Stream olarak oku
      const reader = response.body.getReader();
      let chunksReceived = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunksReceived++;
        setStatus(`Streaming... (chunk ${chunksReceived})`);

        // Chunk'ı base64'e çevir
        const chunk = new Uint8Array(value);
        let binary = '';
        for (let i = 0; i < chunk.length; i++) {
          binary += String.fromCharCode(chunk[i]);
        }
        const base64Chunk = btoa(binary);

        // Buffer'a ekle
        await AudioStream.appendToBuffer(base64Chunk);
      }

      setStatus(`Stream completed (${chunksReceived} chunks)`);

    } catch (error) {
      console.error('Streaming error:', error);
      Alert.alert('Streaming Error', error.message);
      setStatus('Streaming error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        ElevenLabs TTS (Direct Base64)
      </Text>

      <Text style={{ marginBottom: 10, textAlign: 'center', color: isInitialized ? 'green' : 'red' }}>
        AudioStream: {isInitialized ? 'Initialized ✓' : 'Not initialized'}
      </Text>

      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 20,
          borderRadius: 5,
          minHeight: 80,
          textAlignVertical: 'top',
        }}
        value={text}
        onChangeText={setText}
        placeholder="Enter text to speak..."
        multiline
      />

      <Button
        title={loading ? 'Processing...' : 'Speak (Complete Data)'}
        onPress={speak}
        disabled={loading || !text.trim() || !isInitialized}
      />

      <View style={{ marginTop: 10 }}>
        <Button
          title={loading ? 'Processing...' : 'Speak (Streaming)'}
          onPress={speakWithStreaming}
          disabled={loading || !text.trim() || !isInitialized}
          color="#2196F3"
        />
      </View>

      <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-around' }}>
        <Button
          title={isPlaying ? 'Pause' : 'Resume'}
          onPress={pauseResumeAudio}
          color="orange"
        />
        <Button
          title="Stop"
          onPress={stopAudio}
          color="red"
        />
      </View>

      <Text style={{ marginTop: 20, textAlign: 'center', fontSize: 16 }}>
        Status: {status}
      </Text>

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      <Text style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#666' }}>
        Tip: "Streaming" versiyonu chunk chunk oynatır, daha hızlı başlar.
      </Text>
    </View>
  );
} 