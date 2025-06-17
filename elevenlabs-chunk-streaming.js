// ElevenLabs Chunk Streaming Example for React Native
// This example demonstrates real-time audio streaming with chunks

import AudioStream from '@mustafakarali/react-native-audio-stream';

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ElevenLabs streaming with React Native Fetch API
export async function streamElevenLabsAudio(text, apiKey, voiceId) {
  try {
    console.log('Starting ElevenLabs streaming...');
    
    // Initialize AudioStream first
    await AudioStream.initialize({
      bufferSize: 4096,
      autoPlay: true,
      enableLogs: true,
    });

    const instance = AudioStream.getInstance();
    
    // For Android: Start with a data URL containing silent audio
    // This is a 0.1 second silent MP3 (base64)
    const SILENT_MP3_BASE64 = '//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcACA' +
      'gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA' + 
      '//////////////////////////////////////////////////////////////////8AAAA5TEFNRTMuOThyAc0AAAAAAAAAABQgJAUAQQABpAAAAnBo4FEuAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpBRABCAAADSAAAAETEFNRTMuOTguMgAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxFgD' +
      'wAABpAAAACAAADSAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    
    // Start with silent audio (Android workaround)
    console.log('Playing silent audio to initialize stream...');
    await instance.playFromData(SILENT_MP3_BASE64, { autoPlay: true });
    
    // Small delay to ensure player is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Make the streaming request
    console.log('Making ElevenLabs request...');
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
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

    console.log('Response received, starting to read chunks...');
    
    // Read the response as a stream
    const reader = response.body.getReader();
    let chunksReceived = 0;
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream complete!');
        console.log(`Total chunks: ${chunksReceived}, Total bytes: ${totalBytes}`);
        break;
      }

      // Convert chunk to base64
      const base64Chunk = arrayBufferToBase64(value.buffer);
      chunksReceived++;
      totalBytes += value.length;
      
      console.log(`Chunk ${chunksReceived}: ${value.length} bytes`);
      
      // Append chunk to the audio buffer
      await instance.appendToBuffer(base64Chunk);
    }

    console.log('Streaming completed successfully!');
    
  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  }
}

// Alternative approach using XMLHttpRequest for better control
export async function streamElevenLabsAudioXHR(text, apiKey, voiceId) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Starting ElevenLabs streaming with XMLHttpRequest...');
      
      // Initialize AudioStream
      await AudioStream.initialize({
        bufferSize: 4096,
        autoPlay: true,
        enableLogs: true,
      });

      const instance = AudioStream.getInstance();
      
      // Start with silent audio
      const SILENT_MP3_BASE64 = '//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcACA' +
        'gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA' + 
        '//////////////////////////////////////////////////////////////////8AAAA5TEFNRTMuOThyAc0AAAAAAAAAABQgJAUAQQABpAAAAnBo4FEuAAAAAAAA' +
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpBRABCAAADSAAAAETEFNRTMuOTguMgAA' +
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxFgD' +
        'wAABpAAAACAAADSAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
      
      await instance.playFromData(SILENT_MP3_BASE64, { autoPlay: true });
      await new Promise(resolve => setTimeout(resolve, 100));

      const xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      
      let chunksReceived = 0;
      let lastProcessedIndex = 0;

      xhr.onprogress = async (event) => {
        if (xhr.response && xhr.response.byteLength > lastProcessedIndex) {
          // Get the new chunk
          const newData = xhr.response.slice(lastProcessedIndex);
          const base64Chunk = arrayBufferToBase64(newData);
          
          chunksReceived++;
          console.log(`Chunk ${chunksReceived}: ${newData.byteLength} bytes`);
          
          // Append to buffer
          await instance.appendToBuffer(base64Chunk);
          
          lastProcessedIndex = xhr.response.byteLength;
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          console.log('Streaming completed successfully!');
          resolve();
        } else {
          reject(new Error(`Request failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network request failed'));
      };

      xhr.open('POST', `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`);
      xhr.setRequestHeader('xi-api-key', apiKey);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'audio/mpeg');
      
      xhr.send(JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }));
      
    } catch (error) {
      console.error('Streaming error:', error);
      reject(error);
    }
  });
}

// Example usage in a React Native component
export const ElevenLabsStreamingExample = () => {
  const handleStream = async () => {
    try {
      await streamElevenLabsAudio(
        'Hello, this is a test of real-time audio streaming with ElevenLabs.',
        'YOUR_API_KEY',
        'YOUR_VOICE_ID'
      );
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <View>
      <Button title="Stream Audio" onPress={handleStream} />
    </View>
  );
}; 