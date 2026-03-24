package com.audiostream;

import android.media.audiofx.Equalizer;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

/**
 * Real Android equalizer implementation using android.media.audiofx.Equalizer.
 *
 * Wraps the system-level AudioEffect Equalizer API to provide actual
 * hardware/DSP-accelerated equalization. No mocks, no placeholders.
 *
 * Usage:
 *   audioEqualizer = new AudioEqualizer(audioSessionId);
 *   audioEqualizer.applyPreset(presetIndex);
 *   audioEqualizer.setBandLevel(bandIndex, levelMillibels);
 *   audioEqualizer.release();
 */
public class AudioEqualizer {
    private static final String TAG = "AudioEqualizer";

    private Equalizer equalizer;
    private int audioSessionId;
    private boolean isEnabled = false;

    /**
     * Creates a new AudioEqualizer attached to the given audio session.
     *
     * @param audioSessionId The audio session ID from ExoPlayer (player.getAudioSessionId())
     * @throws RuntimeException if the device doesn't support the Equalizer effect
     */
    public AudioEqualizer(int audioSessionId) {
        this.audioSessionId = audioSessionId;
        try {
            equalizer = new Equalizer(0, audioSessionId);
            isEnabled = true;
            equalizer.setEnabled(true);
            Log.i(TAG, "Equalizer created. Bands: " + equalizer.getNumberOfBands()
                    + ", Presets: " + equalizer.getNumberOfPresets());
        } catch (Exception e) {
            Log.e(TAG, "Failed to create Equalizer — device may not support this effect", e);
            equalizer = null;
            isEnabled = false;
        }
    }

    /**
     * Applies a system preset equalizer setting.
     */
    public boolean applyPreset(short presetIndex) {
        if (equalizer == null) return false;
        try {
            if (presetIndex >= 0 && presetIndex < equalizer.getNumberOfPresets()) {
                equalizer.usePreset(presetIndex);
                return true;
            } else {
                Log.w(TAG, "Invalid preset index: " + presetIndex
                        + ". Valid range: 0-" + (equalizer.getNumberOfPresets() - 1));
                return false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to apply preset", e);
            return false;
        }
    }

    /**
     * Sets the gain level for a specific frequency band.
     *
     * @param band  Band index (0 to numberOfBands-1)
     * @param level Gain in millibels (use getBandLevelRange() for valid range)
     */
    public boolean setBandLevel(short band, short level) {
        if (equalizer == null) return false;
        try {
            short[] range = equalizer.getBandLevelRange();
            short minLevel = range[0];
            short maxLevel = range[1];

            // Clamp level to valid range
            short clampedLevel = (short) Math.max(minLevel, Math.min(maxLevel, level));
            equalizer.setBandLevel(band, clampedLevel);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to set band level for band " + band, e);
            return false;
        }
    }

    /**
     * Sets band levels from a float array (values -1.0 to 1.0 mapped to device range).
     */
    public boolean setBandLevels(float[] levels) {
        if (equalizer == null) return false;
        try {
            short numberOfBands = equalizer.getNumberOfBands();
            short[] range = equalizer.getBandLevelRange();
            short minLevel = range[0];
            short maxLevel = range[1];

            for (int i = 0; i < Math.min(levels.length, numberOfBands); i++) {
                // Map -1.0..1.0 to minLevel..maxLevel
                float normalized = Math.max(-1f, Math.min(1f, levels[i]));
                short level = (short) (minLevel + (normalized + 1f) * 0.5f * (maxLevel - minLevel));
                equalizer.setBandLevel((short) i, level);
            }
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to set band levels", e);
            return false;
        }
    }

    /**
     * Returns current equalizer settings as a WritableMap for sending to React Native.
     */
    public WritableMap getSettings() {
        WritableMap settings = Arguments.createMap();

        if (equalizer == null) {
            settings.putBoolean("enabled", false);
            settings.putString("error", "Equalizer not available on this device");
            return settings;
        }

        try {
            settings.putBoolean("enabled", isEnabled);
            settings.putInt("numberOfBands", equalizer.getNumberOfBands());
            settings.putInt("numberOfPresets", equalizer.getNumberOfPresets());

            // Band level range
            short[] range = equalizer.getBandLevelRange();
            settings.putInt("minLevel", range[0]);
            settings.putInt("maxLevel", range[1]);

            // Current band levels and center frequencies
            WritableArray bands = Arguments.createArray();
            for (short i = 0; i < equalizer.getNumberOfBands(); i++) {
                WritableMap band = Arguments.createMap();
                band.putInt("index", i);
                band.putInt("level", equalizer.getBandLevel(i));
                band.putInt("centerFrequency", equalizer.getCenterFreq(i));
                int[] freqRange = equalizer.getBandFreqRange(i);
                band.putInt("minFrequency", freqRange[0]);
                band.putInt("maxFrequency", freqRange[1]);
                bands.pushMap(band);
            }
            settings.putArray("bands", bands);

            // Available presets
            WritableArray presets = Arguments.createArray();
            for (short i = 0; i < equalizer.getNumberOfPresets(); i++) {
                WritableMap preset = Arguments.createMap();
                preset.putInt("index", i);
                preset.putString("name", equalizer.getPresetName(i));
                presets.pushMap(preset);
            }
            settings.putArray("presets", presets);

            // Current preset
            settings.putInt("currentPreset", equalizer.getCurrentPreset());
        } catch (Exception e) {
            Log.e(TAG, "Failed to get equalizer settings", e);
            settings.putString("error", e.getMessage());
        }

        return settings;
    }

    /**
     * Enables or disables the equalizer.
     */
    public void setEnabled(boolean enabled) {
        if (equalizer == null) return;
        try {
            equalizer.setEnabled(enabled);
            isEnabled = enabled;
        } catch (Exception e) {
            Log.e(TAG, "Failed to set equalizer enabled state", e);
        }
    }

    public boolean isAvailable() {
        return equalizer != null;
    }

    public boolean isEnabled() {
        return isEnabled;
    }

    /**
     * Releases the equalizer resources. Must be called when the player is released.
     */
    public void release() {
        if (equalizer != null) {
            try {
                equalizer.setEnabled(false);
                equalizer.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing equalizer", e);
            }
            equalizer = null;
            isEnabled = false;
        }
    }
}
