package com.audiostream;

import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.upstream.BaseDataSource;
import com.google.android.exoplayer2.upstream.DataSource;
import com.google.android.exoplayer2.upstream.DataSpec;
import com.google.android.exoplayer2.upstream.TransferListener;
import android.net.Uri;
import android.util.Log;

import java.io.IOException;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;

import androidx.annotation.Nullable;

/**
 * Memory-based DataSource for real-time audio streaming
 * Uses PipedInputStream/PipedOutputStream for thread-safe data transfer
 */
public class MemoryDataSource extends BaseDataSource {
    private static final String TAG = "MemoryDataSource";
    private static final int BUFFER_SIZE = 2 * 1024 * 1024; // 2MB buffer
    
    private final PipedInputStream inputStream;
    private final PipedOutputStream outputStream;
    private Uri uri;
    private boolean opened = false;
    private long totalBytesWritten = 0;
    private boolean isComplete = false;

    public MemoryDataSource() throws IOException {
        super(/* isNetwork= */ false);
        inputStream = new PipedInputStream(BUFFER_SIZE);
        outputStream = new PipedOutputStream(inputStream);
        Log.d(TAG, "MemoryDataSource created with " + BUFFER_SIZE + " bytes buffer");
    }

    /**
     * Write audio data chunk to the buffer
     */
    public synchronized void writeData(byte[] data) throws IOException {
        if (!isComplete && outputStream != null) {
            outputStream.write(data);
            outputStream.flush();
            totalBytesWritten += data.length;
            Log.d(TAG, "Written " + data.length + " bytes, total: " + totalBytesWritten);
        }
    }

    /**
     * Signal that no more data will be written
     */
    public synchronized void setComplete() {
        isComplete = true;
        try {
            if (outputStream != null) {
                outputStream.close();
                Log.d(TAG, "Stream marked as complete, total bytes: " + totalBytesWritten);
            }
        } catch (IOException e) {
            Log.e(TAG, "Error closing output stream", e);
        }
    }

    @Override
    public long open(DataSpec dataSpec) throws IOException {
        uri = dataSpec.uri;
        opened = true;
        transferInitializing(dataSpec);
        transferStarted(dataSpec);
        Log.d(TAG, "DataSource opened");
        return C.LENGTH_UNSET; // Unknown length for streaming
    }

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        if (!opened) {
            throw new IOException("DataSource is not opened");
        }

        int bytesRead = inputStream.read(buffer, offset, length);
        
        if (bytesRead > 0) {
            bytesTransferred(bytesRead);
        } else if (bytesRead == -1) {
            Log.d(TAG, "End of stream reached");
            return C.RESULT_END_OF_INPUT;
        }
        
        return bytesRead;
    }

    @Nullable
    @Override
    public Uri getUri() {
        return uri;
    }

    @Override
    public void close() throws IOException {
        if (opened) {
            opened = false;
            
            try {
                if (inputStream != null) {
                    inputStream.close();
                }
                if (outputStream != null && !isComplete) {
                    outputStream.close();
                }
            } finally {
                transferEnded();
            }
            
            Log.d(TAG, "DataSource closed");
        }
    }

    /**
     * Factory for creating MemoryDataSource instances
     */
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