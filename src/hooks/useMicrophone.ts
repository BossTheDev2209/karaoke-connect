import { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

export type AudioEffectType = 'none' | 'reverb' | 'echo' | 'studio';

interface WebRTCStats {
  connectedPeers: number;
  avgLatency: number; // in ms
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';
}

interface UseMicrophoneReturn {
  isSpeaking: boolean;
  volume: number;
  isEnabled: boolean;
  toggleMic: (initialEQ?: number[]) => void;
  applyEQ: (settings: number[]) => void;
  setEffect: (effect: AudioEffectType) => void;
  currentEffect: AudioEffectType;
  error: string | null;
  remoteAudioLevels: Record<string, number>;
  webrtcStats: WebRTCStats;
}

// Helper to create reverb impulse response
const createReverbImpulse = (ctx: AudioContext, duration: number = 2.0, decay: number = 2.0): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = i; // sample index
    // Simple exponential decay white noise
    // Using a logarithmic decay for more natural sound
    const gain = Math.pow(1 - n / length, decay); 
    
    // Add some "room" reflections
    const val = (Math.random() * 2 - 1) * gain;
    
    left[i] = val;
    right[i] = val;
  }
  return impulse;
};

// Higher threshold to avoid false positives - requires real voice input
const VOLUME_THRESHOLD = 0.08;
const SMOOTHING = 0.88;
// Minimum speech duration to avoid flicker (ms)
const MIN_SPEECH_DURATION = 150;
// Cooldown after speech ends to prevent rapid toggling
const SPEECH_COOLDOWN = 200;

// Enhanced ICE servers for better connectivity
// STUN servers help with NAT traversal (peer discovery)
// TURN servers relay traffic when P2P fails (firewall bypass)
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google STUN servers (free, reliable)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Twilio STUN (backup)
    { urls: 'stun:global.stun.twilio.com:3478' },
    // OpenRelay free TURN server (for firewall bypass)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
};

interface PeerState {
  pc: RTCPeerConnection;
  audioEl?: HTMLAudioElement;
}

// Modify SDP to set Opus audio quality parameters
// This improves voice quality from ~32kbps default to 64kbps
const setOpusQuality = (sdp: string): string => {
  // Find the Opus codec line and add parameters
  // Format: a=fmtp:111 minptime=10;useinbandfec=1
  const opusPayloadMatch = sdp.match(/a=rtpmap:(\d+) opus/);
  if (!opusPayloadMatch) return sdp;
  
  const opusPayload = opusPayloadMatch[1];
  const fmtpRegex = new RegExp(`a=fmtp:${opusPayload} (.+)`);
  
  if (fmtpRegex.test(sdp)) {
    // Append to existing fmtp line
    return sdp.replace(fmtpRegex, `a=fmtp:${opusPayload} $1;maxaveragebitrate=64000;stereo=0;sprop-stereo=0`);
  } else {
    // Add new fmtp line after rtpmap
    return sdp.replace(
      new RegExp(`(a=rtpmap:${opusPayload} opus[^\\r\\n]+)`),
      `$1\r\na=fmtp:${opusPayload} minptime=10;maxaveragebitrate=64000;stereo=0;sprop-stereo=0;useinbandfec=1`
    );
  }
};

export const useMicrophone = (
  onSpeakingChange?: (isSpeaking: boolean, level: number) => void,
  channel?: RealtimeChannel | null,
  currentUserId?: string,
  roomUsers?: { id: string }[],
  userVolumes?: Record<string, number>
): UseMicrophoneReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteAudioLevels, setRemoteAudioLevels] = useState<Record<string, number>>({});
  const [webrtcStats, setWebrtcStats] = useState<WebRTCStats>({
    connectedPeers: 0,
    avgLatency: 0,
    connectionQuality: 'disconnected',
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null); // For sending DSP audio
  const effectStateRef = useRef<AudioEffectType>('none'); // To track current effect without re-renders affecting graph
  const [currentEffect, setCurrentEffect] = useState<AudioEffectType>('none');
  
  // DSP Nodes Refs
  const dryGainRef = useRef<GainNode | null>(null);
  const reverbGainRef = useRef<GainNode | null>(null);
  const echoGainRef = useRef<GainNode | null>(null);
  
  const animationRef = useRef<number>(0);
  const lastSpeakingRef = useRef(false);
  const lastUpdateRef = useRef(0);
  const lastLevelRef = useRef(0);
  const speechStartTimeRef = useRef(0);
  const speechEndTimeRef = useRef(0);
  const smoothedVolumeRef = useRef(0);

  // WebRTC state
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAnalysersRef = useRef<Map<string, { ctx: AudioContext; analyser: AnalyserNode }>>(new Map());

  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);

  // NOTE: stopMic gets re-created when roomUsers/channel/currentUserId change.
  // If we depend on it directly in an effect cleanup, React will call that cleanup on *every* re-render.
  // This ref ensures we only stop the mic on unmount.
  const stopMicRef = useRef<() => void>(() => {});

  // Analyze remote audio levels
  const analyzeRemoteAudio = useCallback(() => {
    const levels: Record<string, number> = {};
    remoteAnalysersRef.current.forEach((data, odels) => {
      const arr = new Uint8Array(data.analyser.frequencyBinCount);
      data.analyser.getByteFrequencyData(arr);
      let sum = 0;
      for (let i = 0; i < arr.length; i++) sum += arr[i];
      levels[odels] = Math.min(1, (sum / arr.length) / 128);
    });
    setRemoteAudioLevels(levels);
  }, []);

  const analyze = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Focus on voice frequency range (85Hz - 3000Hz)
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const binWidth = sampleRate / (analyserRef.current.fftSize);
    const voiceStartBin = Math.floor(85 / binWidth);
    const voiceEndBin = Math.min(Math.floor(3000 / binWidth), dataArray.length);
    
    let voiceEnergy = 0;
    let totalWeight = 0;
    
    for (let i = voiceStartBin; i < voiceEndBin; i++) {
      const freq = i * binWidth;
      const weight = freq >= 100 && freq <= 500 ? 2.0 : 1.0;
      voiceEnergy += dataArray[i] * weight;
      totalWeight += weight;
    }
    
    const voiceAverage = voiceEnergy / totalWeight;
    
    const subBassEnd = Math.floor(80 / binWidth);
    let subBassEnergy = 0;
    for (let i = 0; i < subBassEnd && i < dataArray.length; i++) {
      subBassEnergy += dataArray[i];
    }
    const subBassAverage = subBassEnergy / Math.max(1, subBassEnd);
    
    const highFreqStart = Math.floor(4000 / binWidth);
    let highFreqEnergy = 0;
    let highFreqCount = 0;
    for (let i = highFreqStart; i < dataArray.length; i++) {
      highFreqEnergy += dataArray[i];
      highFreqCount++;
    }
    const highFreqAverage = highFreqEnergy / Math.max(1, highFreqCount);
    
    const isLikelySystemAudio = subBassAverage > voiceAverage * 0.8 || highFreqAverage > voiceAverage * 0.6;
    
    const rawVolume = isLikelySystemAudio ? 0 : Math.min(1, voiceAverage / 120);
    
    smoothedVolumeRef.current = smoothedVolumeRef.current * SMOOTHING + rawVolume * (1 - SMOOTHING);
    const normalizedVolume = smoothedVolumeRef.current;
    
    setVolume(normalizedVolume);
    
    const now = Date.now();
    const isAboveThreshold = normalizedVolume > VOLUME_THRESHOLD;
    
    let speaking = false;
    
    if (isAboveThreshold) {
      if (!lastSpeakingRef.current) {
        if (speechStartTimeRef.current === 0) {
          speechStartTimeRef.current = now;
        }
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
        if (speechEndTimeRef.current === 0) {
          speechEndTimeRef.current = now;
        }
        if (now - speechEndTimeRef.current >= SPEECH_COOLDOWN) {
          speaking = false;
        } else {
          speaking = true;
        }
      }
    }
    
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

    // Analyze remote audio levels
    analyzeRemoteAudio();

    animationRef.current = requestAnimationFrame(analyze);
  }, [onSpeakingChange, analyzeRemoteAudio]);



  // Close peer connection
  const closePeerConnection = useCallback((remoteUserId: string) => {
    const peer = peersRef.current.get(remoteUserId);
    if (peer) {
      peer.pc.close();
      if (peer.audioEl) {
        peer.audioEl.srcObject = null;
      }
      peersRef.current.delete(remoteUserId);
    }
    pendingCandidatesRef.current.delete(remoteUserId);
    
    const remote = remoteAnalysersRef.current.get(remoteUserId);
    if (remote) {
      remote.ctx.close();
      remoteAnalysersRef.current.delete(remoteUserId);
    }
  }, []);

  // Create peer connection for voice sharing
  const createPeerConnection = useCallback((remoteUserId: string, _isInitiator: boolean) => {
    console.log(`[Mic] Creating peer connection for ${remoteUserId}`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local tracks - Use PROCESSED stream if available, otherwise raw
    const streamToSend = processedStreamRef.current || streamRef.current;
    
    if (streamToSend) {
      streamToSend.getTracks().forEach(track => {
        pc.addTrack(track, streamToSend);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channel && currentUserId) {
        channel.send({
          type: 'broadcast',
          event: 'mic_signal',
          payload: {
            type: 'ice_candidate',
            from: currentUserId,
            to: remoteUserId,
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[Mic] Connection state with ${remoteUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        closePeerConnection(remoteUserId);
      }
    };

    // Handle remote audio
    pc.ontrack = (event) => {
      console.log(`[Mic] Received audio track from ${remoteUserId}`);
      const [remoteStream] = event.streams;
      
      // Create audio element for playback
      let audioEl = peersRef.current.get(remoteUserId)?.audioEl;
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        // Important: Prevent pause from other tabs or system
        audioEl.setAttribute('playsinline', '');
      }
      audioEl.srcObject = remoteStream;
      
      // Apply user volume if set, default to max if not specified
      if (userVolumes && userVolumes[remoteUserId] !== undefined) {
        audioEl.volume = userVolumes[remoteUserId] / 100;
      } else {
        audioEl.volume = 1.0; // Full volume by default
      }

      // Explicitly try to play the audio (required by browser autoplay policies)
      const playAudio = async () => {
        try {
          await audioEl!.play();
          console.log(`[Mic] Audio playback started for ${remoteUserId}`);
        } catch (playError) {
          console.warn(`[Mic] Audio autoplay blocked for ${remoteUserId}:`, playError);
          // Add a click handler to resume playback on user interaction
          const resumeAudio = async () => {
            try {
              await audioEl!.play();
              console.log(`[Mic] Audio resumed for ${remoteUserId} after user interaction`);
              document.removeEventListener('click', resumeAudio);
              document.removeEventListener('keydown', resumeAudio);
            } catch (e) {
              console.warn(`[Mic] Failed to resume audio for ${remoteUserId}:`, e);
            }
          };
          document.addEventListener('click', resumeAudio, { once: true });
          document.addEventListener('keydown', resumeAudio, { once: true });
        }
      };
      playAudio();

      // Create analyser for this remote user
      try {
        const ctx = new AudioContext();
        // Resume AudioContext if suspended (browser autoplay policy)
        if (ctx.state === 'suspended') {
          ctx.resume().catch(console.warn);
        }
        const source = ctx.createMediaStreamSource(remoteStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        remoteAnalysersRef.current.set(remoteUserId, { ctx, analyser });
      } catch (err) {
        console.warn('[Mic] Could not create remote analyser:', err);
      }

      const peer = peersRef.current.get(remoteUserId);
      if (peer) {
        peer.audioEl = audioEl;
      }
    };

    peersRef.current.set(remoteUserId, { pc });
    return pc;
  }, [channel, currentUserId, closePeerConnection, userVolumes]);

  // Handle signaling messages
  useEffect(() => {
    if (!channel || !isEnabled || !currentUserId) return;

    const handleSignal = async ({ payload }: { payload: any }) => {
      const { type, from, to, offer, answer, candidate } = payload;
      
      if (to !== currentUserId) return;

      console.log(`[Mic] Received signal: ${type} from ${from}`);

      if (type === 'offer') {
        let pc = peersRef.current.get(from)?.pc;
        
        // Check if we already have a connection in stable state
        // This means we already completed the handshake - don't process duplicate offers
        if (pc && pc.signalingState === 'stable' && pc.connectionState === 'connected') {
          console.log(`[Mic] Ignoring duplicate offer from ${from} - already connected`);
          return;
        }
        
        // If we have a connection in wrong state, close it and create new one
        if (pc && pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {
          console.log(`[Mic] Closing peer ${from} in bad state: ${pc.signalingState}`);
          closePeerConnection(from);
          pc = undefined;
        }
        
        if (!pc) {
          pc = createPeerConnection(from, false);
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          
          const pending = pendingCandidatesRef.current.get(from) || [];
          for (const c of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidatesRef.current.delete(from);

          const answerDesc = await pc.createAnswer();
          // Enhance Opus quality before setting local description
          const enhancedAnswer = new RTCSessionDescription({
            type: answerDesc.type,
            sdp: setOpusQuality(answerDesc.sdp || ''),
          });
          await pc.setLocalDescription(enhancedAnswer);

          channel.send({
            type: 'broadcast',
            event: 'mic_signal',
            payload: {
              type: 'answer',
              from: currentUserId,
              to: from,
              answer: enhancedAnswer,
            },
          });
        } catch (err) {
          console.error(`[Mic] Error handling offer from ${from}:`, err);
          // Close and let them retry
          closePeerConnection(from);
        }
      } else if (type === 'answer') {
        const pc = peersRef.current.get(from)?.pc;
        if (pc && pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            
            const pending = pendingCandidatesRef.current.get(from) || [];
            for (const c of pending) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidatesRef.current.delete(from);
          } catch (err) {
            console.error(`[Mic] Error handling answer from ${from}:`, err);
          }
        } else {
          console.log(`[Mic] Ignoring answer from ${from} - wrong state: ${pc?.signalingState}`);
        }
      } else if (type === 'ice_candidate') {
        const pc = peersRef.current.get(from)?.pc;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          const pending = pendingCandidatesRef.current.get(from) || [];
          pending.push(candidate);
          pendingCandidatesRef.current.set(from, pending);
        }
      } else if (type === 'mic_join') {
        // Another user enabled their mic - initiate connection if we have lower ID
        if (currentUserId < from) {
          const pc = createPeerConnection(from, true);
          const offerDesc = await pc.createOffer();
          // Enhance Opus quality before setting local description
          const enhancedOffer = new RTCSessionDescription({
            type: offerDesc.type,
            sdp: setOpusQuality(offerDesc.sdp || ''),
          });
          await pc.setLocalDescription(enhancedOffer);

          channel.send({
            type: 'broadcast',
            event: 'mic_signal',
            payload: {
              type: 'offer',
              from: currentUserId,
              to: from,
              offer: enhancedOffer,
            },
          });
        }
      } else if (type === 'mic_leave') {
        closePeerConnection(from);
      }
    };

    channel.on('broadcast', { event: 'mic_signal' }, handleSignal);

    return () => {
      // Don't unsubscribe from the whole channel, just stop handling
    };
  }, [channel, isEnabled, currentUserId, createPeerConnection, closePeerConnection]);

  // Announce mic enabled to establish WebRTC connections
  const announceJoin = useCallback(async () => {
    if (!channel || !currentUserId || !roomUsers) return;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    for (const user of roomUsers) {
      if (user.id !== currentUserId) {
        channel.send({
          type: 'broadcast',
          event: 'mic_signal',
          payload: {
            type: 'mic_join',
            from: currentUserId,
            to: user.id,
          },
        });
      }
    }
  }, [channel, currentUserId, roomUsers]);

  // Announce mic disabled
  const announceLeave = useCallback(() => {
    if (!channel || !currentUserId || !roomUsers) return;
    
    for (const user of roomUsers) {
      if (user.id !== currentUserId) {
        channel.send({
          type: 'broadcast',
          event: 'mic_signal',
          payload: {
            type: 'mic_leave',
            from: currentUserId,
            to: user.id,
          },
        });
      }
    }
  }, [channel, currentUserId, roomUsers]);

  const startMic = useCallback(async (initialEQ?: number[]) => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      
      const preferredDevice = audioInputs.find(d => 
        d.label.toLowerCase().includes('microphone') ||
        d.label.toLowerCase().includes('mic') ||
        d.label.toLowerCase().includes('headset')
      );

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: preferredDevice?.deviceId ? { ideal: preferredDevice.deviceId } : undefined,
          // Quality settings for singing
          sampleRate: { ideal: 48000 },       // High sample rate for quality
          sampleSize: { ideal: 16 },          // 16-bit audio
          channelCount: { ideal: 1 },          // Mono is fine for voice
          // Processing settings
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
      
      console.log('[Mic] Requesting microphone with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[Mic] Got microphone stream:', stream.getTracks().map(t => t.label));

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      
      // High-pass filter to remove low rumble and plosives
      const highpassFilter = audioContext.createBiquadFilter();
      highpassFilter.type = 'highpass';
      highpassFilter.frequency.value = 80;  // Cut below 80Hz (room rumble)
      highpassFilter.Q.value = 0.7;
      
      // Low-pass filter - set high to preserve voice clarity!
      // Previous value of 4000Hz was cutting off brightness and clarity
      const lowpassFilter = audioContext.createBiquadFilter();
      lowpassFilter.type = 'lowpass';
      lowpassFilter.frequency.value = 12000;  // Keep up to 12kHz for clear vocals
      lowpassFilter.Q.value = 0.7;
      
      const bands = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const filters = bands.map((freq, i) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = i === 0 ? 'lowshelf' : i === bands.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        filter.gain.value = initialEQ?.[i] || 0;
        return filter;
      });

      source.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      
      let lastNode: AudioNode = lowpassFilter;
      filters.forEach(filter => {
        lastNode.connect(filter);
        lastNode = filter;
      });

      // --- DSP EFFECT ROUTING ---
      
      // Create Destination for WebRTC
      const destination = audioContext.createMediaStreamDestination();
      processedStreamRef.current = destination.stream;

      // 1. Dry Path (Original Signal)
      const dryGain = audioContext.createGain();
      dryGain.gain.value = 1.0; // Default on
      lastNode.connect(dryGain);
      dryGain.connect(destination);
      dryGainRef.current = dryGain;

      // 2. Reverb Path (Convolver)
      const reverbGain = audioContext.createGain();
      reverbGain.gain.value = 0.0; // Default off
      
      const convolver = audioContext.createConvolver();
      convolver.buffer = createReverbImpulse(audioContext, 2.5, 2.0); // 2.5s reverb tail
      
      // Optional: Pre-delay for reverb to make vocals clearer
      const reverbPreDelay = audioContext.createDelay();
      reverbPreDelay.delayTime.value = 0.02; // 20ms pre-delay

      lastNode.connect(reverbGain);
      reverbGain.connect(reverbPreDelay);
      reverbPreDelay.connect(convolver);
      convolver.connect(destination);
      reverbGainRef.current = reverbGain;

      // 3. Echo Path (Delay)
      const echoGain = audioContext.createGain();
      echoGain.gain.value = 0.0; // Default off
      
      const echoDelay = audioContext.createDelay();
      echoDelay.delayTime.value = 0.25; // 250ms echo
      
      const echoFeedback = audioContext.createGain();
      echoFeedback.gain.value = 0.4; // 40% feedback

      lastNode.connect(echoGain);
      echoGain.connect(echoDelay);
      echoDelay.connect(echoFeedback);
      echoFeedback.connect(echoDelay); // Feedback loop
      echoDelay.connect(destination);
      echoGainRef.current = echoGain;

      // Apply initial effect state
      const currentEffect = effectStateRef.current;
      if (currentEffect === 'reverb' || currentEffect === 'studio') {
        dryGain.gain.value = 1.0;
        reverbGain.gain.value = 0.4;
        echoGain.gain.value = 0.0;
      } else if (currentEffect === 'echo') {
        dryGain.gain.value = 1.0;
        reverbGain.gain.value = 0.0;
        echoGain.gain.value = 0.5;
      } else {
        dryGain.gain.value = 1.0;
        reverbGain.gain.value = 0.0;
        echoGain.gain.value = 0.0;
      }

      // Connect to Analyser (Visualize the PROCESSED output)
      // Note: connecting destination to analyser doesn't work well in all browsers.
      // Better to connect the dry/wet gains to the analyser too.
      // Or just use a master gain before destination.
      const masterGain = audioContext.createGain();
      masterGain.gain.value = 1.0;
      
      dryGain.connect(masterGain);
      convolver.connect(masterGain);
      echoDelay.connect(masterGain);
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      
      masterGain.connect(analyser);
      // We already connected to destination above independently.
      // Whatever, let's keep the graph simple:
      // Nodes -> routing -> [dry/rev/echo] -> destination
      // We can also tap [dry/rev/echo] -> analyser.
      
      // Let's reconnect properly to ensure Analyser sees the same as WebRTC
      // Disconnect previous destination connections
      dryGain.disconnect(destination);
      convolver.disconnect(destination);
      echoDelay.disconnect(destination);

      // Connect to Master
      dryGain.connect(masterGain);
      convolver.connect(masterGain);
      echoDelay.connect(masterGain);

      // Connect Master to Destination (sending) and Analyser (visuals)
      masterGain.connect(destination);
      masterGain.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;
      eqFiltersRef.current = filters;
      smoothedVolumeRef.current = 0;
      speechStartTimeRef.current = 0;
      speechEndTimeRef.current = 0;

      analyze();
      console.log('[Mic] Mic enabled');
      setIsEnabled(true);
      setError(null);

      // Announce to other users for WebRTC
      await announceJoin();
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Could not access microphone');
    }
  }, [analyze, announceJoin]);

  const stopMic = useCallback(() => {
    console.log('[Mic] stopMic called');
    // Announce leaving before cleanup
    announceLeave();

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Close all peer connections
    peersRef.current.forEach((_, odels) => closePeerConnection(odels));
    peersRef.current.clear();
    pendingCandidatesRef.current.clear();
    remoteAnalysersRef.current.forEach(data => data.ctx.close());
    remoteAnalysersRef.current.clear();

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
    setRemoteAudioLevels({});
    
    lastSpeakingRef.current = false;
    
    // DSP Cleanup
    processedStreamRef.current = null;
    dryGainRef.current = null;
    reverbGainRef.current = null;
    echoGainRef.current = null;
  }, [announceLeave, closePeerConnection]);

  // Keep latest stopMic in a ref so our unmount cleanup doesn't fire on every re-render.
  useEffect(() => {
    stopMicRef.current = stopMic;
  }, [stopMic]);

  const toggleMic = useCallback((initialEQ?: number[]) => {
    if (isEnabled) {
      stopMic();
    } else {
      startMic(initialEQ);
    }
  }, [isEnabled, startMic, stopMic]);

  // Update remote audio volumes when userVolumes changes
  useEffect(() => {
    if (!userVolumes) return;
    
    peersRef.current.forEach((peer, odels) => {
      if (peer.audioEl && userVolumes[odels] !== undefined) {
        peer.audioEl.volume = userVolumes[odels] / 100;
      }
    });
  }, [userVolumes]);

  // Global handler to resume all audio on user interaction (browser autoplay policy workaround)
  useEffect(() => {
    if (!isEnabled) return;

    const resumeAllAudio = async () => {
      // Resume all peer audio elements
      for (const [userId, peer] of peersRef.current) {
        if (peer.audioEl && peer.audioEl.paused) {
          try {
            await peer.audioEl.play();
            console.log(`[Mic] Resumed audio for ${userId} on user interaction`);
          } catch (e) {
            // Ignore errors, audio might not be ready
          }
        }
      }
      
      // Resume all remote AudioContexts
      for (const [userId, data] of remoteAnalysersRef.current) {
        if (data.ctx.state === 'suspended') {
          try {
            await data.ctx.resume();
            console.log(`[Mic] Resumed AudioContext for ${userId}`);
          } catch (e) {
            // Ignore errors
          }
        }
      }
    };

    // Resume audio on any user interaction
    document.addEventListener('click', resumeAllAudio);
    document.addEventListener('keydown', resumeAllAudio);
    document.addEventListener('touchstart', resumeAllAudio);

    return () => {
      document.removeEventListener('click', resumeAllAudio);
      document.removeEventListener('keydown', resumeAllAudio);
      document.removeEventListener('touchstart', resumeAllAudio);
    };
  }, [isEnabled]);

  // Handle users leaving the room
  useEffect(() => {
    if (!roomUsers) return;
    
    const currentPeerIds = Array.from(peersRef.current.keys());
    const roomUserIds = roomUsers.map(u => u.id);
    
    for (const peerId of currentPeerIds) {
      if (!roomUserIds.includes(peerId)) {
        closePeerConnection(peerId);
      }
    }
  }, [roomUsers, closePeerConnection]);

  // Track WebRTC connection stats
  useEffect(() => {
    if (!isEnabled) {
      setWebrtcStats({ connectedPeers: 0, avgLatency: 0, connectionQuality: 'disconnected' });
      return;
    }

    const measureStats = async () => {
      const peers = Array.from(peersRef.current.values());
      const connectedPeers = peers.filter(p => p.pc.connectionState === 'connected').length;
      
      if (connectedPeers === 0) {
        setWebrtcStats({ connectedPeers: 0, avgLatency: 0, connectionQuality: 'disconnected' });
        return;
      }

      // Get RTT from peer connections
      let totalRtt = 0;
      let rttCount = 0;

      for (const peer of peers) {
        if (peer.pc.connectionState !== 'connected') continue;
        
        try {
          const stats = await peer.pc.getStats();
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime !== undefined) {
                totalRtt += report.currentRoundTripTime * 1000; // Convert to ms
                rttCount++;
              }
            }
          });
        } catch {
          // Stats not available
        }
      }

      const avgLatency = rttCount > 0 ? Math.round(totalRtt / rttCount) : 0;
      
      // Determine quality based on latency
      let connectionQuality: WebRTCStats['connectionQuality'];
      if (avgLatency === 0) {
        connectionQuality = connectedPeers > 0 ? 'good' : 'disconnected';
      } else if (avgLatency < 50) {
        connectionQuality = 'excellent';
      } else if (avgLatency < 100) {
        connectionQuality = 'good';
      } else if (avgLatency < 200) {
        connectionQuality = 'fair';
      } else {
        connectionQuality = 'poor';
      }

      setWebrtcStats({ connectedPeers, avgLatency, connectionQuality });
    };

    // Measure immediately and then every 2 seconds
    measureStats();
    const interval = setInterval(measureStats, 2000);

    return () => clearInterval(interval);
  }, [isEnabled]);

  // Stop mic only on unmount (NOT whenever stopMic callback identity changes)
  // Stop mic only on unmount (NOT whenever stopMic callback identity changes)
  useEffect(() => {
    return () => {
      stopMicRef.current?.();
    };
  }, []);

  const setEffect = useCallback((effect: AudioEffectType) => {
    setCurrentEffect(effect);
    effectStateRef.current = effect;

    // Apply gains immediately if mic is running
    const ctx = audioContextRef.current;
    if (ctx && dryGainRef.current) {
      const now = ctx.currentTime;
      const ramp = 0.1; // 100ms fade

      if (effect === 'reverb' || effect === 'studio') {
        dryGainRef.current.gain.setTargetAtTime(1.0, now, ramp);
        reverbGainRef.current?.gain.setTargetAtTime(0.4, now, ramp);
        echoGainRef.current?.gain.setTargetAtTime(0.0, now, ramp);
      } else if (effect === 'echo') {
        dryGainRef.current.gain.setTargetAtTime(1.0, now, ramp);
        reverbGainRef.current?.gain.setTargetAtTime(0.0, now, ramp);
        echoGainRef.current?.gain.setTargetAtTime(0.5, now, ramp);
      } else {
        dryGainRef.current.gain.setTargetAtTime(1.0, now, ramp);
        reverbGainRef.current?.gain.setTargetAtTime(0.0, now, ramp);
        echoGainRef.current?.gain.setTargetAtTime(0.0, now, ramp);
      }
    }
  }, []);

  const applyEQ = useCallback((settings: number[]) => {
    if (eqFiltersRef.current.length > 0) {
      eqFiltersRef.current.forEach((filter, i) => {
        if (settings[i] !== undefined) {
          filter.gain.setTargetAtTime(settings[i], audioContextRef.current?.currentTime || 0, 0.1);
        }
      });
    }
  }, []);

  return { 
    isSpeaking, 
    volume, 
    isEnabled, 
    toggleMic, 
    applyEQ, 
    setEffect,
    currentEffect,
    error, 
    remoteAudioLevels, 
    webrtcStats 
  };
};
