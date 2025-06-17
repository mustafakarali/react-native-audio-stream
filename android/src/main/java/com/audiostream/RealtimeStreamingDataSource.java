package com.audiostream;

import android.net.Uri;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.BaseDataSource;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.DataSourceException;
import androidx.media3.datasource.TransferListener;

import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Custom DataSource for real-time byte-by-byte streaming with AndroidX Media3
 * This allows feeding audio data chunk by chunk as it arrives
 */
@UnstableApi
public class RealtimeStreamingDataSource extends BaseDataSource {
    private static final String TAG = "RealtimeStreamingDS";
    
    // DataSource.Factory implementation for Media3
    public static class Factory implements DataSource.Factory {
        private final RealtimeStreamingDataSource dataSource;
        
        public Factory(RealtimeStreamingDataSource dataSource) {
            this.dataSource = dataSource;
        }
        
        @Override
        public DataSource createDataSource() {
            return dataSource;
        }
    }
    
    private PipedInputStream inputStream;
    private PipedOutputStream outputStream;
    private final AtomicBoolean isOpen = new AtomicBoolean(false);
    private final AtomicBoolean isComplete = new AtomicBoolean(false);
    private long totalBytesWritten = 0;
    private long totalBytesRead = 0;
    private long lastReadTime = 0;
    
    public RealtimeStreamingDataSource() {
        super(/* isNetwork= */ true);
    }
    
    @Override
    public long open(DataSpec dataSpec) throws DataSourceException {
        try {
            if (isOpen.get()) {
                close();
            }
            
            // Create piped streams with a larger buffer for real-time streaming
            outputStream = new PipedOutputStream();
            inputStream = new PipedInputStream(outputStream, 1024 * 1024); // 1MB buffer
            
            isOpen.set(true);
            isComplete.set(false);
            totalBytesWritten = 0;
            totalBytesRead = 0;
            lastReadTime = System.currentTimeMillis();
            
            Log.i(TAG, "Opened real-time streaming data source");
            
            transferStarted(dataSpec);
            
            return C.LENGTH_UNSET; // Unknown length for streaming
        } catch (IOException e) {
            throw new DataSourceException(e, PlaybackException.ERROR_CODE_IO_UNSPECIFIED);
        }
    }
    
    @Override
    public int read(byte[] buffer, int offset, int length) throws DataSourceException {
        if (!isOpen.get()) {
            throw new DataSourceException(
                "Data source is not open",
                null,
                PlaybackException.ERROR_CODE_IO_UNSPECIFIED
            );
        }
        
        try {
            int bytesRead = inputStream.read(buffer, offset, length);
            
            if (bytesRead > 0) {
                totalBytesRead += bytesRead;
                lastReadTime = System.currentTimeMillis();
                bytesTransferred(bytesRead);
            }
            
            return bytesRead;
        } catch (IOException e) {
            if (isComplete.get()) {
                // Normal end of stream
                return C.RESULT_END_OF_INPUT;
            }
            // Fixed: Use PlaybackException error code
            throw new DataSourceException(
                e,
                PlaybackException.ERROR_CODE_IO_UNSPECIFIED
            );
        }
    }
    
    @Override
    @Nullable
    public Uri getUri() {
        return isOpen.get() ? Uri.parse("streaming://realtime") : null;
    }
    
    @Override
    public void close() throws DataSourceException {
        if (isOpen.compareAndSet(true, false)) {
            try {
                if (outputStream != null) {
                    outputStream.close();
                    outputStream = null;
                }
                if (inputStream != null) {
                    inputStream.close();
                    inputStream = null;
                }
                
                Log.i(TAG, String.format("Closed data source. Total bytes: written=%d, read=%d",
                    totalBytesWritten, totalBytesRead));
                
                transferEnded();
            } catch (IOException e) {
                throw new DataSourceException(e, PlaybackException.ERROR_CODE_IO_UNSPECIFIED);
            }
        }
    }
    
    /**
     * Append audio data to the stream
     * This method is thread-safe and can be called from any thread
     */
    public synchronized void appendData(byte[] data) throws IOException {
        if (!isOpen.get() || outputStream == null) {
            throw new IOException("Data source is not open");
        }
        
        if (isComplete.get()) {
            throw new IOException("Stream has been completed");
        }
        
        outputStream.write(data);
        outputStream.flush();
        totalBytesWritten += data.length;
        
        Log.d(TAG, String.format("Appended %d bytes, total: %d", data.length, totalBytesWritten));
    }
    
    /**
     * Signal that no more data will be written to the stream
     */
    public synchronized void complete() {
        if (isOpen.get() && outputStream != null && !isComplete.get()) {
            try {
                outputStream.close();
                isComplete.set(true);
                Log.i(TAG, "Stream completed. Total bytes written: " + totalBytesWritten);
            } catch (IOException e) {
                Log.e(TAG, "Error completing stream", e);
            }
        }
    }
    
    /**
     * Get streaming statistics
     */
    public String getStats() {
        long currentTime = System.currentTimeMillis();
        long timeSinceLastRead = currentTime - lastReadTime;
        
        return String.format(
            "Streaming stats: written=%d, read=%d, buffered=%d, isComplete=%s, timeSinceLastRead=%dms",
            totalBytesWritten,
            totalBytesRead,
            totalBytesWritten - totalBytesRead,
            isComplete.get(),
            timeSinceLastRead
        );
    }
    
    /**
     * Check if the stream is ready for reading
     */
    public boolean isReady() {
        return isOpen.get() && (totalBytesWritten > totalBytesRead || isComplete.get());
    }
} 