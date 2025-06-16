/**
 * Complete Working Example
 * @mustafakarali/react-native-audio-stream v1.10.1
 * 
 * This example shows how to:
 * 1. Play MP3 files from URL
 * 2. Play base64 audio data
 * 3. Stream audio from ElevenLabs TTS
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

// Audio stream instance
const audioStream = AudioStream.getInstance();

export default function CompleteAudioExample() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('Ready');
  
  // ElevenLabs settings
  const [apiKey, setApiKey] = useState('');
  const [voiceId, setVoiceId] = useState('21m00Tcm4TlvDq8ikWAM'); // Rachel
  const [textToSpeak, setTextToSpeak] = useState('Hello! This is a test of text to speech.');

  // Initialize audio stream
  useEffect(() => {
    initializeAudioStream();
    
    // Cleanup
    return () => {
      audioStream.destroy();
    };
  }, []);

  const initializeAudioStream = async () => {
    try {
      await audioStream.initialize({
        enableCache: true,
        enableLogs: true,
      });
      
      // Set up event listeners
      audioStream.addEventListener('onStreamStateChange', (event) => {
        setStatus(`State: ${event.state}`);
        setIsPlaying(event.state === 'playing');
      });
      
      audioStream.addEventListener('onStreamProgress', (event) => {
        setCurrentTime(event.currentTime);
        setDuration(event.duration);
      });
      
      audioStream.addEventListener('onStreamError', (event) => {
        Alert.alert('Error', event.message);
        setStatus('Error');
      });
      
      setIsInitialized(true);
      setStatus('Initialized');
    } catch (error) {
      Alert.alert('Initialization Error', error.message);
    }
  };

  // Example 1: Play MP3 from URL
  const playMP3FromURL = async () => {
    try {
      setStatus('Loading MP3...');
      await audioStream.startStream(
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        { autoPlay: true }
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Example 2: Play Base64 Audio
  const playBase64Audio = async () => {
    try {
      setStatus('Loading base64 audio...');
      
      // This is a very short beep sound in base64
      const base64Audio = 'SUQzAwAAAAAAIVRYWFgAAAANAAAAU29mdHdhcmUATGF2ZjU4LjI5LjEwMP/7kGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAA+gAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr///////////////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAAA';
      
      await audioStream.playFromData(base64Audio, { autoPlay: true });
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Example 3: ElevenLabs TTS
  const playElevenLabsTTS = async () => {
    if (!apiKey) {
      Alert.alert('API Key Required', 'Please enter your ElevenLabs API key');
      return;
    }

    try {
      setStatus('Calling ElevenLabs API...');
      
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
            text: textToSpeak,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      setStatus('Converting audio...');
      
      // Get audio data and convert to base64
      const arrayBuffer = await response.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      
      setStatus('Playing audio...');
      await audioStream.playFromData(base64, { autoPlay: true });
      
    } catch (error) {
      Alert.alert('ElevenLabs Error', error.message);
      setStatus('Error');
    }
  };

  // Example 4: Stream ElevenLabs (for longer content)
  const streamElevenLabsTTS = async () => {
    if (!apiKey) {
      Alert.alert('API Key Required', 'Please enter your ElevenLabs API key');
      return;
    }

    try {
      setStatus('Starting stream...');
      
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
            text: textToSpeak,
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
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      setStatus('Streaming audio...');
      
      const reader = response.body.getReader();
      let chunksReceived = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunksReceived++;
        setStatus(`Streaming... (chunk ${chunksReceived})`);
        
        // Convert chunk to base64
        const base64 = uint8ArrayToBase64(value);
        
        // Append to buffer
        await audioStream.appendToBuffer(base64);
      }
      
      setStatus('Stream completed');
      
    } catch (error) {
      Alert.alert('Streaming Error', error.message);
      setStatus('Error');
    }
  };

  // Playback controls
  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await audioStream.pause();
      } else {
        await audioStream.play();
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleStop = async () => {
    try {
      await audioStream.stop();
      setCurrentTime(0);
      setDuration(0);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Helper functions
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000; // 32KB chunks to avoid call stack size exceeded
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    
    return btoa(binary);
  }

  function uint8ArrayToBase64(uint8Array) {
    let binary = '';
    const chunkSize = 0x8000;
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    
    return btoa(binary);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Initializing...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>React Native Audio Stream</Text>
      <Text style={styles.version}>v1.10.1 Complete Example</Text>
      
      {/* Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{status}</Text>
        {duration > 0 && (
          <Text style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        )}
      </View>

      {/* Example 1: MP3 URL */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Play MP3 from URL</Text>
        <TouchableOpacity style={styles.button} onPress={playMP3FromURL}>
          <Text style={styles.buttonText}>Play Sample MP3</Text>
        </TouchableOpacity>
      </View>

      {/* Example 2: Base64 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Play Base64 Audio</Text>
        <TouchableOpacity style={styles.button} onPress={playBase64Audio}>
          <Text style={styles.buttonText}>Play Base64 Beep</Text>
        </TouchableOpacity>
      </View>

      {/* Example 3: ElevenLabs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. ElevenLabs Text-to-Speech</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Enter your ElevenLabs API key"
          value={apiKey}
          onChangeText={setApiKey}
          secureTextEntry
        />
        
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter text to speak"
          value={textToSpeak}
          onChangeText={setTextToSpeak}
          multiline
          numberOfLines={4}
        />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.buttonHalf]} 
            onPress={playElevenLabsTTS}
          >
            <Text style={styles.buttonText}>Play Complete</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.buttonHalf]} 
            onPress={streamElevenLabsTTS}
          >
            <Text style={styles.buttonText}>Stream Chunks</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Playback Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Playback Controls</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.buttonHalf]} 
            onPress={handlePlayPause}
          >
            <Text style={styles.buttonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.buttonHalf, styles.buttonStop]} 
            onPress={handleStop}
          >
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.infoText}>
          Get your ElevenLabs API key from: https://elevenlabs.io
        </Text>
        <Text style={styles.infoText}>
          Voice IDs: https://api.elevenlabs.io/v1/voices
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 5,
    color: '#333',
  },
  version: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonHalf: {
    flex: 0.48,
  },
  buttonStop: {
    backgroundColor: '#FF3B30',
  },
  info: {
    padding: 20,
    marginBottom: 40,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 5,
  },
});

// For direct testing (copy-paste into App.js)
// export default CompleteAudioExample; 