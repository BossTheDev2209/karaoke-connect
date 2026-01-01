import { useState, useEffect, useRef, useCallback } from 'react';

interface UseMicrophoneReturn {
  isSpeaking: boolean;
  volume: number;
  isEnabled: boolean;
  toggleMic: (initialEQ?: number[]) => void;
  applyEQ: (settings: number[]) => void;
  error: string | null;
}

const VOLUME_THRESHOLD = 0.02;
const SMOOTHING = 0.8;

export const useMicrophone = (onSpeakingChange?: (isSpeaking: boolean, level: number) => void): UseMicrophoneReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const lastSpeakingRef = useRef(false);
  const lastUpdateRef = useRef(0);
  const lastLevelRef = useRef(0);

  const analyze = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedVolume = Math.min(1, average / 128); // Boost sensitivity a bit
    
    setVolume(prev => prev * SMOOTHING + normalizedVolume * (1 - SMOOTHING));
    
    const speaking = normalizedVolume > VOLUME_THRESHOLD;
    const now = Date.now();
    
    // Throttle updates to ~10fps or if speaking status changes
    if (speaking !== lastSpeakingRef.current || (now - lastUpdateRef.current > 100 && Math.abs(normalizedVolume - lastLevelRef.current) > 0.05)) {
      lastSpeakingRef.current = speaking;
      lastUpdateRef.current = now;
      lastLevelRef.current = normalizedVolume;
      setIsSpeaking(speaking);
      onSpeakingChange?.(speaking, normalizedVolume);
    }

    animationRef.current = requestAnimationFrame(analyze);
  }, [onSpeakingChange]);

  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);

  const applyEQ = useCallback((settings: number[]) => {
    if (eqFiltersRef.current.length === 0) return;
    settings.forEach((gain, i) => {
      if (eqFiltersRef.current[i]) {
        eqFiltersRef.current[i].gain.setTargetAtTime(gain, audioContextRef.current?.currentTime || 0, 0.1);
      }
    });
  }, []);

  const startMic = useCallback(async (initialEQ?: number[]) => {
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
      
      // Create EQ Chain
      const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const filters = bands.map((freq, i) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = i === 0 ? 'lowshelf' : i === bands.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        filter.gain.value = initialEQ?.[i] || 0;
        return filter;
      });

      // Connect filters in series
      let lastNode: AudioNode = source;
      filters.forEach(filter => {
        lastNode.connect(filter);
        lastNode = filter;
      });

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      lastNode.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;
      eqFiltersRef.current = filters;

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
    eqFiltersRef.current = [];
    
    setIsEnabled(false);
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  const toggleMic = useCallback((initialEQ?: number[]) => {
    if (isEnabled) {
      stopMic();
    } else {
      startMic(initialEQ);
    }
  }, [isEnabled, startMic, stopMic]);

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  return { isSpeaking, volume, isEnabled, toggleMic, applyEQ, error };
};
