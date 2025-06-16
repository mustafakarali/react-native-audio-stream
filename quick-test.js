/**
 * Quick Test Example
 * Copy this into your App.js to test quickly
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Button, TextInput, Alert } from 'react-native';
import AudioStream from '@mustafakarali/react-native-audio-stream';

const stream = AudioStream.getInstance();

export default function App() {
  const [status, setStatus] = useState('Initializing...');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    // Initialize
    stream.initialize().then(() => {
      setStatus('Ready');
      
      // Listen to events
      stream.addEventListener('onStreamStateChange', (e) => {
        setStatus(`State: ${e.state}`);
      });
    });
  }, []);

  // Test 1: Play MP3
  const testMP3 = async () => {
    try {
      await stream.startStream(
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        { autoPlay: true }
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Test 2: Play Base64
  const testBase64 = async () => {
    try {
      // Short beep sound
      const base64 = 'SUQzAwAAAAAAIVRYWFgAAAANAAAAU29mdHdhcmUATGF2ZjU4LjI5LjEwMP/7kGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAA+gAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVWqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr///////////////////////////////////////////8AAAAATGF2YzU4LjU0AAAAAAAAAAAAAAAAJAAAAAAAAAAAAA';
      await stream.playFromData(base64, { autoPlay: true });
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // Test 3: ElevenLabs TTS
  const testElevenLabs = async () => {
    if (!apiKey) {
      Alert.alert('Error', 'Please enter your API key');
      return;
    }

    try {
      setStatus('Calling API...');
      
      const response = await fetch(
        'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: 'Hello! This is a test of ElevenLabs text to speech.',
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      setStatus('Converting...');
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      
      // Convert in chunks to avoid stack overflow
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, chunk);
      }
      
      const base64 = btoa(binary);
      
      setStatus('Playing...');
      await stream.playFromData(base64, { autoPlay: true });
      
    } catch (error) {
      Alert.alert('Error', error.message);
      setStatus('Error');
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 50 }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>Audio Stream Test</Text>
      <Text style={{ marginBottom: 20 }}>Status: {status}</Text>
      
      <Button title="Test 1: Play MP3" onPress={testMP3} />
      <View style={{ height: 10 }} />
      
      <Button title="Test 2: Play Base64" onPress={testBase64} />
      <View style={{ height: 10 }} />
      
      <TextInput
        placeholder="Enter ElevenLabs API Key"
        value={apiKey}
        onChangeText={setApiKey}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginTop: 20,
          marginBottom: 10,
        }}
      />
      
      <Button title="Test 3: ElevenLabs TTS" onPress={testElevenLabs} />
    </View>
  );
} 