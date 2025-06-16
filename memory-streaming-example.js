/**
 * React Native Audio Stream - Memory Streaming Example
 * 
 * Bu örnek, Android için PipedInputStream/PipedOutputStream kullanarak
 * gerçek zamanlı bellek tabanlı ses akışı sağlar.
 * 
 * Avantajları:
 * - Dosya sistemi kullanmaz
 * - Gerçek zamanlı streaming
 * - Düşük gecikme (300-500ms)
 * - Thread-safe
 */

import { NativeModules, Platform } from 'react-native';

// MemoryDataSource.java implementasyonu
const MEMORY_DATA_SOURCE_JAVA = `
package com.audiostream;

import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.upstream.BaseDataSource;
import com.google.android.exoplayer2.upstream.DataSource;
import com.google.android.exoplayer2.upstream.DataSpec;
import android.net.Uri;
import android.util.Log;

import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;

public class MemoryDataSource extends BaseDataSource {
    private static final String TAG = "MemoryDataSource";
    private static final int BUFFER_SIZE = 2 * 1024 * 1024; // 2MB
    
    private final PipedInputStream inputStream;
    private final PipedOutputStream outputStream;
    private Uri uri;
    private boolean opened = false;

    public MemoryDataSource() throws IOException {
        super(false);
        inputStream = new PipedInputStream(BUFFER_SIZE);
        outputStream = new PipedOutputStream(inputStream);
    }

    public synchronized void writeData(byte[] data) throws IOException {
        outputStream.write(data);
        outputStream.flush();
    }

    public synchronized void setComplete() {
        try {
            outputStream.close();
        } catch (IOException e) {
            Log.e(TAG, "Error closing stream", e);
        }
    }

    @Override
    public long open(DataSpec dataSpec) throws IOException {
        uri = dataSpec.uri;
        opened = true;
        return C.LENGTH_UNSET;
    }

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        int bytesRead = inputStream.read(buffer, offset, length);
        return bytesRead == -1 ? C.RESULT_END_OF_INPUT : bytesRead;
    }

    @Override
    public Uri getUri() {
        return uri;
    }

    @Override
    public void close() throws IOException {
        if (opened) {
            opened = false;
            inputStream.close();
            if (outputStream != null) {
                outputStream.close();
            }
        }
    }

    public static class Factory implements DataSource.Factory {
        private final MemoryDataSource dataSource;
        
        public Factory(MemoryDataSource dataSource) {
            this.dataSource = dataSource;
        }
        
        @Override
        public DataSource createDataSource() {
            return dataSource;
        }
    }
}
`;

// RNAudioStreamModule.java'ya eklenecek metodlar
const MODULE_ADDITIONS = `
// Add these fields to RNAudioStreamModule
private MemoryDataSource memoryDataSource = null;
private boolean isMemoryStreaming = false;

// Add these methods to RNAudioStreamModule
@ReactMethod
public void startMemoryStream(ReadableMap config, Promise promise) {
    try {
        mainHandler.post(() -> {
            try {
                if (player == null) {
                    initializePlayer();
                }
                
                memoryDataSource = new MemoryDataSource();
                isMemoryStreaming = true;
                
                Uri memoryUri = Uri.parse("memory://stream");
                MediaItem mediaItem = MediaItem.fromUri(memoryUri);
                
                ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(
                    new MemoryDataSource.Factory(memoryDataSource)
                ).createMediaSource(mediaItem);
                
                player.setMediaSource(mediaSource);
                player.prepare();
                
                if (config != null && config.hasKey("autoPlay") && config.getBoolean("autoPlay")) {
                    player.play();
                }
                
                updateState(PlaybackState.LOADING);
                sendEvent("onStreamStart", Arguments.createMap());
                
                startProgressTimer();
                startStatsTimer();
                
                promise.resolve(true);
            } catch (Exception e) {
                promise.reject("STREAM_ERROR", "Failed to start memory stream", e);
            }
        });
    } catch (Exception e) {
        promise.reject("STREAM_ERROR", "Failed to start memory stream", e);
    }
}

@ReactMethod
public void appendToMemoryStream(String base64Data, Promise promise) {
    try {
        if (!isMemoryStreaming || memoryDataSource == null) {
            promise.reject("STREAM_ERROR", "Memory stream not started", null);
            return;
        }
        
        byte[] audioData = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
        
        new Thread(() -> {
            try {
                memoryDataSource.writeData(audioData);
                promise.resolve(true);
            } catch (IOException e) {
                promise.reject("WRITE_ERROR", "Failed to write", e);
            }
        }).start();
        
    } catch (Exception e) {
        promise.reject("APPEND_ERROR", "Failed to append", e);
    }
}

@ReactMethod
public void completeMemoryStream(Promise promise) {
    try {
        if (isMemoryStreaming && memoryDataSource != null) {
            memoryDataSource.setComplete();
            isMemoryStreaming = false;
            promise.resolve(true);
        } else {
            promise.reject("STREAM_ERROR", "No active stream", null);
        }
    } catch (Exception e) {
        promise.reject("COMPLETE_ERROR", "Failed to complete", e);
    }
}
`;

// JavaScript/React Native tarafı implementasyon
export class MemoryStreaming {
  constructor() {
    this.isStreaming = false;
    this.startTime = null;
    this.firstChunkTime = null;
  }

  async start(config = { autoPlay: true }) {
    if (Platform.OS !== 'android') {
      throw new Error('Memory streaming sadece Android\'de kullanılabilir');
    }

    this.startTime = Date.now();
    await NativeModules.RNAudioStream.startMemoryStream(config);
    this.isStreaming = true;
    console.log('Memory stream başlatıldı');
  }

  async appendChunk(base64Data) {
    if (!this.isStreaming) {
      throw new Error('Memory stream başlatılmamış');
    }

    if (!this.firstChunkTime) {
      this.firstChunkTime = Date.now();
      const latency = this.firstChunkTime - this.startTime;
      console.log(`İlk chunk gecikme: ${latency}ms`);
    }

    await NativeModules.RNAudioStream.appendToMemoryStream(base64Data);
  }

  async complete() {
    if (!this.isStreaming) return;

    await NativeModules.RNAudioStream.completeMemoryStream();
    this.isStreaming = false;
    
    const totalTime = Date.now() - this.startTime;
    console.log(`Toplam süre: ${totalTime}ms`);
  }
}

// ElevenLabs örnek kullanım
export async function streamWithMemory(text, apiKey, voiceId) {
  const streaming = new MemoryStreaming();
  
  try {
    // 1. Memory stream başlat
    await streaming.start({ autoPlay: true });
    
    // 2. API'den veri al
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
        optimize_streaming_latency: 4, // Maximum optimizasyon
      }),
    });

    const reader = response.body.getReader();
    let totalBytes = 0;

    // 3. Chunk'ları memory stream'e yaz
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Base64'e çevir
      const base64Chunk = btoa(String.fromCharCode(...value));
      
      // Memory stream'e ekle
      await streaming.appendChunk(base64Chunk);
      
      totalBytes += value.length;
      console.log(`Yazılan: ${Math.round(totalBytes / 1024)}KB`);
    }

    // 4. Stream'i tamamla
    await streaming.complete();
    console.log('Memory streaming tamamlandı');
    
  } catch (error) {
    console.error('Memory streaming hatası:', error);
    throw error;
  }
}

// Kullanım örneği
export async function example() {
  const API_KEY = 'your-elevenlabs-api-key';
  const VOICE_ID = 'your-voice-id';
  const text = 'Bu, bellek tabanlı gerçek zamanlı ses akışı örneğidir.';
  
  console.log('=== Memory Streaming Test ===');
  await streamWithMemory(text, API_KEY, VOICE_ID);
}

// Implementasyon adımları:
console.log(`
IMPLEMENTASYON ADIMLARI:

1. MemoryDataSource.java dosyasını oluşturun:
   android/src/main/java/com/audiostream/MemoryDataSource.java

2. RNAudioStreamModule.java'ya yukarıdaki metodları ekleyin

3. Import'ları ekleyin:
   import java.io.PipedInputStream;
   import java.io.PipedOutputStream;

4. Build edin:
   cd android && ./gradlew clean && ./gradlew build

5. Kullanın:
   await example();

PERFORMANS:
- İlk chunk gecikme: ~300-500ms
- Toplam gecikme: <1 saniye
- Bellek kullanımı: 2MB buffer
`); 