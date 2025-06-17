package com.audiostream;

import android.net.Uri;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.datasource.BaseDataSource;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.DataSourceException;

import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Custom DataSource for real-time byte-by-byte streaming with AndroidX Media3
 * This allows feeding audio data chunk by chunk as it arrives
 */
public class RealtimeStreamingDataSource extends BaseDataSource {
    private static final String TAG = "RealtimeStreamingDS";
    private static final int PIPE_SIZE = 1024 * 128; // 128KB pipe buffer
    
    private PipedInputStream inputStream;
    private PipedOutputStream outputStream;
    private AtomicBoolean isOpened = new AtomicBoolean(false);
    private AtomicBoolean isComplete = new AtomicBoolean(false);
    private Uri uri;
    private long totalBytesWritten = 0;
    private long totalBytesRead = 0;
    
    public static class Factory implements DataSource.Factory {
        private final RealtimeStreamingDataSource dataSource;
        
        public Factory(RealtimeStreamingDataSource dataSource) {
            this.dataSource = dataSource;
        }
        
        @Override
        public RealtimeStreamingDataSource createDataSource() {
            return dataSource;
        }
    }

    public RealtimeStreamingDataSource() {
        super(true); // isNetwork = true for streaming behavior
    }

    @Override
    public long open(DataSpec dataSpec) throws IOException {
        if (isOpened.getAndSet(true)) {
            throw new IOException("DataSource is already opened");
        }
        
        uri = dataSpec.uri;
        
        // Create piped streams for data transfer
        outputStream = new PipedOutputStream();
        inputStream = new PipedInputStream(outputStream, PIPE_SIZE);
        
        Log.d(TAG, "DataSource opened for streaming");
        
        transferStarted(dataSpec);
        
        // Return LENGTH_UNSET for unknown/streaming length
        return C.LENGTH_UNSET;
    }

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        if (!isOpened.get()) {
            throw new IOException("DataSource is not opened");
        }
        
        if (inputStream == null) {
            return C.RESULT_END_OF_INPUT;
        }
        
        // This is where Media3 reads bytes - it will block if no data available
        int bytesRead;
        try {
            // Check if stream is complete and no more data
            if (isComplete.get() && inputStream.available() == 0) {
                return C.RESULT_END_OF_INPUT;
            }
            
            // Read available bytes (this may block)
            bytesRead = inputStream.read(buffer, offset, length);
            
            if (bytesRead == -1) {
                return C.RESULT_END_OF_INPUT;
            }
            
            totalBytesRead += bytesRead;
            bytesTransferred(bytesRead);
            
            Log.v(TAG, "Read " + bytesRead + " bytes, total: " + totalBytesRead);
            
        } catch (IOException e) {
            if (isComplete.get()) {
                // Normal end of stream
                return C.RESULT_END_OF_INPUT;
            }
            throw new DataSourceException(e);
        }
        
        return bytesRead;
    }

    @Override
    @Nullable
    public Uri getUri() {
        return uri;
    }

    @Override
    public void close() throws IOException {
        if (isOpened.getAndSet(false)) {
            try {
                if (inputStream != null) {
                    inputStream.close();
                    inputStream = null;
                }
                
                if (outputStream != null) {
                    outputStream.close();
                    outputStream = null;
                }
                
                Log.d(TAG, "DataSource closed. Total written: " + totalBytesWritten + ", read: " + totalBytesRead);
            } finally {
                transferEnded();
            }
        }
    }

    /**
     * Append audio chunk to the stream
     * This is called from the main thread when new data arrives
     */
    public synchronized void appendChunk(byte[] data) throws IOException {
        if (!isOpened.get() || outputStream == null) {
            throw new IOException("DataSource is not ready for writing");
        }
        
        if (isComplete.get()) {
            throw new IOException("Stream is already completed");
        }
        
        try {
            outputStream.write(data);
            outputStream.flush();
            totalBytesWritten += data.length;
            
            Log.d(TAG, "Appended chunk: " + data.length + " bytes, total: " + totalBytesWritten);
        } catch (IOException e) {
            Log.e(TAG, "Failed to write chunk", e);
            throw e;
        }
    }

    /**
     * Signal that streaming is complete
     */
    public synchronized void completeStream() {
        if (!isComplete.getAndSet(true)) {
            try {
                if (outputStream != null) {
                    outputStream.close();
                }
                Log.d(TAG, "Stream completed. Total bytes: " + totalBytesWritten);
            } catch (IOException e) {
                Log.e(TAG, "Error closing output stream", e);
            }
        }
    }

    /**
     * Check if the stream is ready for reading
     */
    public boolean isReady() {
        return isOpened.get() && inputStream != null;
    }

    /**
     * Get total bytes written so far
     */
    public long getTotalBytesWritten() {
        return totalBytesWritten;
    }

    /**
     * Get total bytes read so far
     */
    public long getTotalBytesRead() {
        return totalBytesRead;
    }
} 