// ElevenLabs Working Streaming Example for React Native
// This handles React Native's fetch limitations

import AudioStream from '@mustafakarali/react-native-audio-stream';
import { Platform } from 'react-native';

// Helper to convert base64 to binary string for btoa
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

// ElevenLabs streaming that works on React Native
export async function streamElevenLabsAudio(text, apiKey, voiceId, onProgress) {
  try {
    console.log('Starting ElevenLabs streaming...');
    
    // Initialize AudioStream
    await AudioStream.initialize({
      bufferSize: 4096,
      autoPlay: true,
      enableLogs: true,
    });

    const instance = AudioStream.getInstance();
    
    // First, try the complete audio approach for reliability
    console.log('Fetching complete audio from ElevenLabs...');
    
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

    // For React Native, we need to get the response as blob first
    const blob = await response.blob();
    
    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result;
        const base64Audio = base64data.split(',')[1]; // Remove data:audio/mpeg;base64, prefix
        
        console.log('Audio data received, playing...');
        instance.playFromData(base64Audio, { autoPlay: true })
          .then(() => {
            console.log('Audio playback started successfully');
            resolve();
          })
          .catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}

// Chunked streaming using react-native-fetch-blob or rn-fetch-blob (needs to be installed)
// This is the proper way to handle streaming on React Native
export async function streamElevenLabsChunked(text, apiKey, voiceId, onProgress) {
  try {
    console.log('Starting chunked ElevenLabs streaming...');
    
    // Initialize AudioStream
    await AudioStream.initialize({
      bufferSize: 4096,
      autoPlay: true,
      enableLogs: true,
    });

    const instance = AudioStream.getInstance();
    
    // First, we need to initialize the player with some data
    // Use a very short silent MP3 to start
    const SILENT_MP3 = '//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAABhAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
    
    console.log('Initializing player with silent audio...');
    await instance.playFromData(SILENT_MP3, { autoPlay: false });
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Now start playing
    await instance.play();
    
    // Alternative approach: Use XMLHttpRequest which might work better
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track received chunks
      let totalBytes = 0;
      let chunksAppended = 0;
      
      xhr.open('POST', `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`);
      xhr.setRequestHeader('xi-api-key', apiKey);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'audio/mpeg');
      xhr.responseType = 'arraybuffer';
      
      // Process data as it arrives
      let lastProcessedLength = 0;
      
      xhr.onreadystatechange = async function() {
        if (xhr.readyState === 3 || xhr.readyState === 4) { // LOADING or DONE
          try {
            if (xhr.response && xhr.response.byteLength > lastProcessedLength) {
              const newData = xhr.response.slice(lastProcessedLength);
              const base64Chunk = arrayBufferToBase64(newData);
              
              console.log(`Appending chunk ${++chunksAppended}: ${newData.byteLength} bytes`);
              await instance.appendToBuffer(base64Chunk);
              
              lastProcessedLength = xhr.response.byteLength;
              totalBytes = lastProcessedLength;
              
              if (onProgress) {
                onProgress({
                  chunksReceived: chunksAppended,
                  totalBytes: totalBytes
                });
              }
            }
          } catch (err) {
            console.error('Error processing chunk:', err);
          }
        }
        
        if (xhr.readyState === 4) { // DONE
          if (xhr.status === 200) {
            console.log(`Streaming complete! Total: ${chunksAppended} chunks, ${totalBytes} bytes`);
            resolve();
          } else {
            reject(new Error(`Request failed with status ${xhr.status}`));
          }
        }
      };
      
      xhr.onerror = () => reject(new Error('Network request failed'));
      
      xhr.send(JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }));
    });
    
  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}

// Example React Native component
import React, { useState } from 'react';
import { View, Button, Text, ActivityIndicator, Alert } from 'react-native';

export const ElevenLabsStreamExample = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  
  const handleCompleteStream = async () => {
    setIsLoading(true);
    try {
      await streamElevenLabsAudio(
        'Hello, this is a test of ElevenLabs text to speech streaming.',
        'YOUR_API_KEY',
        'YOUR_VOICE_ID'
      );
      Alert.alert('Success', 'Audio played successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleChunkedStream = async () => {
    setIsLoading(true);
    setProgress(null);
    try {
      await streamElevenLabsChunked(
        'This is a test of chunked audio streaming with ElevenLabs.',
        'YOUR_API_KEY', 
        'YOUR_VOICE_ID',
        (prog) => setProgress(prog)
      );
      Alert.alert('Success', 'Streaming completed');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 20 }}>ElevenLabs Streaming</Text>
      
      <Button 
        title="Play Complete Audio" 
        onPress={handleCompleteStream}
        disabled={isLoading}
      />
      
      <View style={{ height: 20 }} />
      
      <Button 
        title="Stream Chunked Audio" 
        onPress={handleChunkedStream}
        disabled={isLoading}
      />
      
      {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
      
      {progress && (
        <Text style={{ marginTop: 20 }}>
          Chunks: {progress.chunksReceived}, Bytes: {progress.totalBytes}
        </Text>
      )}
    </View>
  );
}; 