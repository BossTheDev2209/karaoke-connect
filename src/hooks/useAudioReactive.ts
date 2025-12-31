import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioReactiveState {
  intensity: number;      // 0-1 overall audio level
  isBeat: boolean;        // true during beat detection
  beatPhase: number;      // 0-1 phase within beat cycle (for smooth animations)
  lowFreq: number;        // 0-1 bass level
  midFreq: number;        // 0-1 mid level
  highFreq: number;       // 0-1 treble level
  bpm: number;            // estimated BPM
}

interface UseAudioReactiveOptions {
  enabled?: boolean;
  sensitivity?: number;   // 1-10, higher = more reactive
  smoothing?: number;     // 0-1, higher = smoother
  targetBpm?: number;     // target BPM for simulation (default: 120)
}

export const useAudioReactive = (
  options: UseAudioReactiveOptions = {}
): AudioReactiveState & { isAnalyzing: boolean } => {
  const { enabled = true, sensitivity = 5, smoothing = 0.8, targetBpm = 120 } = options;
  
  const [state, setState] = useState<AudioReactiveState>({
    intensity: 0,
    isBeat: false,
    beatPhase: 0,
    lowFreq: 0,
    midFreq: 0,
    highFreq: 0,
    bpm: targetBpm,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastBeatTimeRef = useRef<number>(0);
  const prevIntensityRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const analyze = useCallback(() => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Split into frequency bands
    const lowEnd = Math.floor(bufferLength * 0.1);
    const midEnd = Math.floor(bufferLength * 0.5);
    
    let lowSum = 0, midSum = 0, highSum = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i] / 255;
      if (i < lowEnd) {
        lowSum += value;
      } else if (i < midEnd) {
        midSum += value;
      } else {
        highSum += value;
      }
    }
    
    const lowFreq = lowSum / lowEnd;
    const midFreq = midSum / (midEnd - lowEnd);
    const highFreq = highSum / (bufferLength - midEnd);
    
    // Calculate overall intensity with weighting
    const rawIntensity = (lowFreq * 0.5 + midFreq * 0.3 + highFreq * 0.2) * (sensitivity / 5);
    const intensity = Math.min(1, prevIntensityRef.current * smoothing + rawIntensity * (1 - smoothing));
    prevIntensityRef.current = intensity;
    
    // Beat detection - look for sudden increases in low frequency
    const now = performance.now();
    const beatThreshold = 0.6 + (10 - sensitivity) * 0.04;
    const isBeat = lowFreq > beatThreshold && 
                   now - lastBeatTimeRef.current > 200 && // Min 200ms between beats
                   lowFreq > prevIntensityRef.current * 1.3;
    
    if (isBeat) {
      lastBeatTimeRef.current = now;
    }
    
    setState({
      intensity,
      isBeat,
      beatPhase: 0,
      lowFreq: Math.min(1, lowFreq),
      midFreq: Math.min(1, midFreq),
      highFreq: Math.min(1, highFreq),
      bpm: targetBpm,
    });
    
    animationRef.current = requestAnimationFrame(analyze);
  }, [sensitivity, smoothing, targetBpm]);

  useEffect(() => {
    if (!enabled) {
      setState({ intensity: 0, isBeat: false, beatPhase: 0, lowFreq: 0, midFreq: 0, highFreq: 0, bpm: targetBpm });
      setIsAnalyzing(false);
      return;
    }

    // Simulate BPM-synced audio reactivity
    const connectToYouTube = () => {
      startTimeRef.current = performance.now();
      
      const msPerBeat = 60000 / targetBpm;
      
      const simulateAudio = () => {
        const now = performance.now();
        const elapsed = now - startTimeRef.current;
        
        // Calculate beat phase (0-1, where 0 is the beat moment)
        const beatPhase = (elapsed % msPerBeat) / msPerBeat;
        
        // Detect beat at the start of each cycle
        const isBeat = beatPhase < 0.08 && now - lastBeatTimeRef.current > msPerBeat * 0.8;
        if (isBeat) lastBeatTimeRef.current = now;
        
        // Create audio-like variations synced to beat
        // Peak at beat (beatPhase = 0), decay afterward
        const beatCurve = Math.exp(-beatPhase * 4); // Exponential decay from beat
        
        // Add some variation between beats
        const noise = Math.random() * 0.1;
        const variation = Math.sin(elapsed * 0.001) * 0.2;
        
        const lowFreq = Math.min(1, beatCurve * 0.8 + variation + noise);
        const midFreq = Math.min(1, beatCurve * 0.5 + Math.sin(elapsed * 0.002) * 0.3 + noise);
        const highFreq = Math.min(1, Math.sin(elapsed * 0.003) * 0.3 + noise);
        
        const intensity = (lowFreq * 0.5 + midFreq * 0.3 + highFreq * 0.2) * (sensitivity / 5);
        
        setState({
          intensity: Math.min(1, intensity),
          isBeat,
          beatPhase,
          lowFreq,
          midFreq,
          highFreq,
          bpm: targetBpm,
        });
        
        animationRef.current = requestAnimationFrame(simulateAudio);
      };
      
      setIsAnalyzing(true);
      animationRef.current = requestAnimationFrame(simulateAudio);
    };

    connectToYouTube();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      setIsAnalyzing(false);
    };
  }, [enabled, sensitivity, smoothing, targetBpm, analyze]);

  return { ...state, isAnalyzing };
};