import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioReactiveState {
  intensity: number;      // 0-1 overall audio level
  isBeat: boolean;        // true during beat detection
  lowFreq: number;        // 0-1 bass level
  midFreq: number;        // 0-1 mid level
  highFreq: number;       // 0-1 treble level
}

interface UseAudioReactiveOptions {
  enabled?: boolean;
  sensitivity?: number;   // 1-10, higher = more reactive
  smoothing?: number;     // 0-1, higher = smoother
}

export const useAudioReactive = (
  options: UseAudioReactiveOptions = {}
): AudioReactiveState & { isAnalyzing: boolean } => {
  const { enabled = true, sensitivity = 5, smoothing = 0.8 } = options;
  
  const [state, setState] = useState<AudioReactiveState>({
    intensity: 0,
    isBeat: false,
    lowFreq: 0,
    midFreq: 0,
    highFreq: 0,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastBeatTimeRef = useRef<number>(0);
  const prevIntensityRef = useRef<number>(0);

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
      lowFreq: Math.min(1, lowFreq),
      midFreq: Math.min(1, midFreq),
      highFreq: Math.min(1, highFreq),
    });
    
    animationRef.current = requestAnimationFrame(analyze);
  }, [sensitivity, smoothing]);

  useEffect(() => {
    if (!enabled) {
      setState({ intensity: 0, isBeat: false, lowFreq: 0, midFreq: 0, highFreq: 0 });
      setIsAnalyzing(false);
      return;
    }

    // Find the YouTube iframe's audio
    const connectToYouTube = () => {
      // YouTube doesn't expose its audio directly, so we'll use a simulated approach
      // based on the video's playback state. For real audio analysis, we'd need
      // to capture system audio which requires user permission.
      
      // For now, we'll create a simulated audio reactivity based on time
      // This gives the visual effect without needing audio access
      let phase = 0;
      
      const simulateAudio = () => {
        phase += 0.05;
        
        // Create pseudo-random but smooth variations
        const baseLow = (Math.sin(phase * 0.7) + 1) / 2;
        const baseMid = (Math.sin(phase * 1.3 + 1) + 1) / 2;
        const baseHigh = (Math.sin(phase * 2.1 + 2) + 1) / 2;
        
        // Add some randomness for more natural feel
        const noise = Math.random() * 0.2;
        
        const lowFreq = Math.min(1, baseLow * 0.8 + noise);
        const midFreq = Math.min(1, baseMid * 0.6 + noise);
        const highFreq = Math.min(1, baseHigh * 0.4 + noise);
        
        const intensity = (lowFreq * 0.5 + midFreq * 0.3 + highFreq * 0.2) * (sensitivity / 5);
        
        // Simulated beat on low frequency peaks
        const now = performance.now();
        const isBeat = lowFreq > 0.7 && now - lastBeatTimeRef.current > 400;
        if (isBeat) lastBeatTimeRef.current = now;
        
        setState({
          intensity: Math.min(1, intensity),
          isBeat,
          lowFreq,
          midFreq,
          highFreq,
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
  }, [enabled, sensitivity, smoothing, analyze]);

  return { ...state, isAnalyzing };
};