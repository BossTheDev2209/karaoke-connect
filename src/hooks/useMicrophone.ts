import { useState, useEffect, useRef, useCallback } from 'react';

interface UseMicrophoneReturn {
  isSpeaking: boolean;
  volume: number;
  isEnabled: boolean;
  toggleMic: (initialEQ?: number[]) => void;
  applyEQ: (settings: number[]) => void;
  error: string | null;
}

// Higher threshold to avoid false positives
const VOLUME_THRESHOLD = 0.03;
const SMOOTHING = 0.85;
// Minimum speech duration to avoid flicker (ms)
const MIN_SPEECH_DURATION = 150;
// Cooldown after speech ends to prevent rapid toggling
const SPEECH_COOLDOWN = 200;

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
  const speechStartTimeRef = useRef(0);
  const speechEndTimeRef = useRef(0);
  const smoothedVolumeRef = useRef(0);

  const analyze = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Focus on voice frequency range (85Hz - 3000Hz) - human speech fundamentals
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const binWidth = sampleRate / (analyserRef.current.fftSize);
    const voiceStartBin = Math.floor(85 / binWidth);
    const voiceEndBin = Math.min(Math.floor(3000 / binWidth), dataArray.length);
    
    // Calculate voice-focused energy with proper weighting
    let voiceEnergy = 0;
    let totalWeight = 0;
    
    for (let i = voiceStartBin; i < voiceEndBin; i++) {
      // Weight towards fundamental speech frequencies (100-500Hz)
      const freq = i * binWidth;
      const weight = freq >= 100 && freq <= 500 ? 2.0 : 1.0;
      voiceEnergy += dataArray[i] * weight;
      totalWeight += weight;
    }
    
    const voiceAverage = voiceEnergy / totalWeight;
    
    // Calculate sub-bass energy (20-80Hz) - this is typically system noise
    const subBassEnd = Math.floor(80 / binWidth);
    let subBassEnergy = 0;
    for (let i = 0; i < subBassEnd && i < dataArray.length; i++) {
      subBassEnergy += dataArray[i];
    }
    const subBassAverage = subBassEnergy / Math.max(1, subBassEnd);
    
    // High frequency energy (4000Hz+) - often system noise
    const highFreqStart = Math.floor(4000 / binWidth);
    let highFreqEnergy = 0;
    let highFreqCount = 0;
    for (let i = highFreqStart; i < dataArray.length; i++) {
      highFreqEnergy += dataArray[i];
      highFreqCount++;
    }
    const highFreqAverage = highFreqEnergy / Math.max(1, highFreqCount);
    
    // Reject if sub-bass or high-freq dominates (likely system audio)
    const isLikelySystemAudio = subBassAverage > voiceAverage * 0.8 || highFreqAverage > voiceAverage * 0.6;
    
    // Normalize volume with rejection of system audio
    const rawVolume = isLikelySystemAudio ? 0 : Math.min(1, voiceAverage / 120);
    
    // Apply stronger smoothing
    smoothedVolumeRef.current = smoothedVolumeRef.current * SMOOTHING + rawVolume * (1 - SMOOTHING);
    const normalizedVolume = smoothedVolumeRef.current;
    
    setVolume(normalizedVolume);
    
    const now = Date.now();
    const isAboveThreshold = normalizedVolume > VOLUME_THRESHOLD;
    
    // Debounce speech detection
    let speaking = false;
    
    if (isAboveThreshold) {
      if (!lastSpeakingRef.current) {
        // Start tracking potential speech
        if (speechStartTimeRef.current === 0) {
          speechStartTimeRef.current = now;
        }
        // Only mark as speaking after minimum duration
        if (now - speechStartTimeRef.current >= MIN_SPEECH_DURATION) {
          speaking = true;
        }
      } else {
        speaking = true;
      }
      speechEndTimeRef.current = 0;
    } else {
      speechStartTimeRef.current = 0;
      if (lastSpeakingRef.current) {
        // Track when speech potentially ended
        if (speechEndTimeRef.current === 0) {
          speechEndTimeRef.current = now;
        }
        // Only stop speaking after cooldown
        if (now - speechEndTimeRef.current >= SPEECH_COOLDOWN) {
          speaking = false;
        } else {
          speaking = true; // Keep speaking during cooldown
        }
      }
    }
    
    // Throttle updates to reduce network traffic
    const shouldUpdate = 
      speaking !== lastSpeakingRef.current || 
      (now - lastUpdateRef.current > 150 && Math.abs(normalizedVolume - lastLevelRef.current) > 0.08);
    
    if (shouldUpdate) {
      lastSpeakingRef.current = speaking;
      lastUpdateRef.current = now;
      lastLevelRef.current = normalizedVolume;
      setIsSpeaking(speaking);
      onSpeakingChange?.(speaking, speaking ? normalizedVolume : 0);
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
      // Get list of audio devices to find a microphone (not system audio)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      
      // Try to find a physical microphone (avoid virtual/system devices)
      const preferredDevice = audioInputs.find(d => 
        d.label.toLowerCase().includes('microphone') ||
        d.label.toLowerCase().includes('mic') ||
        d.label.toLowerCase().includes('headset')
      );

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Use specific device if found
          deviceId: preferredDevice?.deviceId ? { ideal: preferredDevice.deviceId } : undefined,
          // Aggressive noise/echo handling
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          // Disable any system audio capture
          // Prefer closer mic if available
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
        } as MediaTrackConstraints,
      });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      
      // High-pass filter to cut sub-bass (system rumble, speaker bleed)
      const highpassFilter = audioContext.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.value = 80;
      highpassFilter.Q.value = 0.7;
      
      // Low-pass filter to cut high frequency noise
      const lowpassFilter = audioContext.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = 4000;
      lowpassFilter.Q.value = 0.7;
      
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

      // Connect: source -> highpass -> lowpass -> EQ chain -> analyser
      source.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      
      let lastNode: AudioNode = lowpassFilter;
      filters.forEach(filter => {
        lastNode.connect(filter);
        lastNode = filter;
      });

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512; // More frequency bins for better analysis
      analyser.smoothingTimeConstant = 0.7;
      
      lastNode.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;
      eqFiltersRef.current = filters;
      smoothedVolumeRef.current = 0;
      speechStartTimeRef.current = 0;
      speechEndTimeRef.current = 0;

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
    smoothedVolumeRef.current = 0;
    speechStartTimeRef.current = 0;
    speechEndTimeRef.current = 0;
    
    setIsEnabled(false);
    setIsSpeaking(false);
    setVolume(0);
    
    // Notify that mic is off
    lastSpeakingRef.current = false;
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
