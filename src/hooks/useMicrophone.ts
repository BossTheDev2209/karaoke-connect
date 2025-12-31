import { useState, useEffect, useRef, useCallback } from 'react';

interface UseMicrophoneReturn {
  isSpeaking: boolean;
  volume: number;
  isEnabled: boolean;
  toggleMic: () => void;
  error: string | null;
}

const VOLUME_THRESHOLD = 0.02;
const SMOOTHING = 0.8;

export const useMicrophone = (onSpeakingChange?: (isSpeaking: boolean) => void): UseMicrophoneReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const lastSpeakingRef = useRef(false);

  const analyze = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedVolume = average / 255;
    
    setVolume(prev => prev * SMOOTHING + normalizedVolume * (1 - SMOOTHING));
    
    const speaking = normalizedVolume > VOLUME_THRESHOLD;
    if (speaking !== lastSpeakingRef.current) {
      lastSpeakingRef.current = speaking;
      setIsSpeaking(speaking);
      onSpeakingChange?.(speaking);
    }

    animationRef.current = requestAnimationFrame(analyze);
  }, [onSpeakingChange]);

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;

      analyze();
      setIsEnabled(true);
      setError(null);
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Could not access microphone');
    }
  }, [analyze]);

  const stopMic = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    
    setIsEnabled(false);
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  const toggleMic = useCallback(() => {
    if (isEnabled) {
      stopMic();
    } else {
      startMic();
    }
  }, [isEnabled, startMic, stopMic]);

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  return { isSpeaking, volume, isEnabled, toggleMic, error };
};
