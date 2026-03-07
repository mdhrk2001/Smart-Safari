// src/utils/AudioNarrator.ts

import * as Speech from 'expo-speech';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

// Supported languages as per the project requirements
export type SupportedLanguage = 'en' | 'si' | 'ta';

const LANGUAGE_CODES: Record<SupportedLanguage, string> = {
    'en': 'en-US', // English
    'si': 'si-LK', // Sinhala (Requires Sinhala TTS pack on device)
    'ta': 'ta-IN'  // Tamil (ta-IN is more reliably pre-installed offline than ta-LK)
};

/**
 * Speaks the provided text in the specified language, overriding silent mode
 * and ducking background music. Accepts callbacks to update UI state when finished.
 */
export const speakNarration = async (
    text: string, 
    lang: SupportedLanguage = 'en',
    onDoneCallback?: () => void,
    onErrorCallback?: () => void
) => {
    // 1. Stop any ongoing speech before starting a new one
    Speech.stop();

    // 2. Configure the OS Audio Session
    try {
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true, // Forces audio even if iPhone switch is on Silent
            interruptionModeIOS: InterruptionModeIOS.DuckOthers,
            interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
        });
    } catch (error) {
        console.warn('Failed to set audio mode for ducking:', error);
    }

    // 3. Play the narration
    Speech.speak(text, {
        language: LANGUAGE_CODES[lang],
        pitch: 1.0,
        rate: 0.9, // Slightly slower rate for clearer educational narration
        onDone: () => {
            console.log('Narration finished');
            if (onDoneCallback) onDoneCallback();
        },
        onStopped: () => {
            console.log('Narration stopped manually');
            // Depending on your UI needs, you might also want to trigger onDoneCallback here
            // if you want a manual stop to also reset external states automatically, 
            // but usually your UI handles the manual stop state directly.
        },
        onError: (err) => {
            console.error('TTS Error:', err);
            if (onErrorCallback) onErrorCallback();
        },
    });
};

/**
 * Stops the current narration.
 */
export const stopNarration = () => {
    Speech.stop();
};