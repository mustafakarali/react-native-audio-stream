import { NativeModules, Platform } from 'react-native';
import AudioStream from './AudioStream';

const { RNAudioStream } = NativeModules;

/**
 * MemoryStreaming - Gerçek zamanlı bellekte ses akışı
 * 
 * Android için PipedInputStream/PipedOutputStream tabanlı çözüm
 * Dosya sistemi kullanmadan direkt bellekte streaming
 */
export class MemoryStreaming {
  private isStreaming = false;
  private chunkCount = 0;

  /**
   * Bellek tabanlı streaming başlat
   */
  async start(config?: { autoPlay?: boolean }): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('Memory streaming is only available on Android');
    }

    await RNAudioStream.startMemoryStream(config || { autoPlay: true });
    this.isStreaming = true;
  }

  /**
   * Ses chunk'ı ekle
   * @param base64Data - Base64 encoded audio chunk
   */
  async appendChunk(base64Data: string): Promise<void> {
    if (!this.isStreaming) {
      throw new Error('Memory stream not started');
    }

    await RNAudioStream.appendToMemoryStream(base64Data);
    this.chunkCount++;
  }

  /**
   * Streaming'i tamamla
   */
  async complete(): Promise<void> {
    if (!this.isStreaming) {
      return;
    }

    await RNAudioStream.completeMemoryStream();
    this.isStreaming = false;
  }

  /**
   * Durum bilgisi
   */
  getStatus() {
    return {
      isStreaming: this.isStreaming,
      chunksAppended: this.chunkCount
    };
  }
}

/**
 * ElevenLabs için optimize edilmiş memory streaming
 */
export async function memoryStreamElevenLabs(
  text: string,
  apiKey: string,
  voiceId: string,
  onProgress?: (status: string) => void
): Promise<void> {
  const streaming = new MemoryStreaming();
  
  try {
    onProgress?.('Starting memory stream...');
    
    // Memory stream başlat
    await streaming.start({ autoPlay: true });
    
    onProgress?.('Fetching audio...');
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
        optimize_streaming_latency: 4, // Maximum optimization
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const reader = response.body!.getReader();
    let totalBytes = 0;
    
    onProgress?.('Streaming audio...');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Convert to base64
      const base64Chunk = btoa(String.fromCharCode(...value));
      
      // Append to memory stream
      await streaming.appendChunk(base64Chunk);
      
      totalBytes += value.length;
      onProgress?.(`Streaming: ${Math.round(totalBytes / 1024)}KB`);
    }

    // Complete the stream
    await streaming.complete();
    onProgress?.('Completed');
    
  } catch (error) {
    onProgress?.(`Error: ${error.message}`);
    throw error;
  }
}

/**
 * Kullanım örneği
 */
export async function exampleMemoryStreaming() {
  const API_KEY = 'your-api-key';
  const VOICE_ID = 'your-voice-id';
  
  try {
    console.log('Starting memory streaming...');
    const startTime = Date.now();
    
    await memoryStreamElevenLabs(
      'Bu gerçek zamanlı bellek tabanlı ses akışı örneğidir.',
      API_KEY,
      VOICE_ID,
      (status) => console.log(status)
    );
    
    const totalTime = Date.now() - startTime;
    console.log(`Total time: ${totalTime}ms`);
    
  } catch (error) {
    console.error('Memory streaming error:', error);
  }
} 